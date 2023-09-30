import { BaseStatementExecutor } from "../base_statement_executor";
import { BaseStatementParser } from "../base_statement_parser";
import {
  ColumnMetdata as ColumnMetadata,
  Data,
  DataType,
  Relation,
  Table,
} from "../database";
import { ParseError } from "../error";
import {
  StatementConfig,
  StatementData,
  StatementParserType,
} from "../nparser";
import { Keyword, TokenType } from "../tokenizer";

interface InsertData extends StatementData {
  tableName: string;
  rowsToInsert: any[][];
  columnsToInsert: string[] | null;
}

// currently all columns that have been given,
// must be filled out, if no columns were given,
// all columns musst be filled out
class InsertParser
  extends BaseStatementParser
  implements StatementParserType<InsertData>
{
  tableName: string | undefined;
  rowsToInsert: Data[][] = [];
  columnsToInsert: string[] | null = null;

  public parse(): void {
    this.expectKeyword(Keyword.into);
    this.tableName = this.expectIdentifier("table name");

    if (this.tokens.read().type === TokenType.openParantheses) {
      this.tokens.consume();
      this.parseExplicitGivenColumns();
    }
    this.expectKeyword(Keyword.values);
    this.parseMoreThanOne(this.parseAndInsertValueRow);
  }

  private expectValue(): Data {
    const token = this.tokens.consume();
    switch (token.type) {
      case TokenType.string:
      case TokenType.number:
        return token.value;
      case TokenType.keyword:
        switch (token.tokenId) {
          case Keyword.null:
            return null;
          case Keyword.true:
            return true;
          case Keyword.false:
            return false;
        }
    }
    throw new ParseError(
      "constant value expected, such as a string, number, boolean or null",
      token
    );
  }

  private parseAndInsertValueRow() {
    this.expectType(TokenType.openParantheses);
    let row = [];
    let firstValue = true;
    while (this.tokens.read().type != TokenType.eof) {
      if (!firstValue) {
        if (this.tokens.read().type != TokenType.comma) {
          break;
        }
      } else {
        firstValue = false;
      }
      row.push(this.expectValue());
    }
    this.expectType(TokenType.closedParantheses);
    this.rowsToInsert.push(row);
  }

  private parseExplicitGivenColumns() {
    // TODO: replace parseMoreThanOne, as insert into a () also allowed
    this.columnsToInsert = [];
    this.parseMoreThanOne(() => {
      const columnName = this.expectIdentifier("column name");
      if (this.columnsToInsert!.some((column) => column === columnName)) {
        this.lastExpectedTokenError(
          `column ${columnName} cannot be inserted twice`
        );
      }
      this.columnsToInsert!.push(columnName);
    });
    this.expectType(TokenType.closedParantheses);
  }
}

class InsertExecutor extends BaseStatementExecutor<InsertData> {
  private table: Table | null = null;
  private relativeTokenIndex = 3;
  private tableRowLength: number = NaN;
  private rowIndex: number = NaN;
  private columns: ColumnMetadata[] | undefined;
  private rowsToInsert: any[][] = [];

  public execute(): void {
    this.checkTable();
    this.checkColumns();
    this.checkRows();
    this.table!.rows.push(...this.rowsToInsert);
  }

  private static *combineIterator<T>(
    a: Iterable<T>,
    b: Iterable<T>
  ): Iterable<T> {
    yield* a;
    yield* b;
  }

  private checkTable() {
    this.table = this.database.getTable(this.data.tableName);
    if (this.table) {
      this.relativeTokenError(
        `cannot insert into table ${this.data.tableName}, does not exist`,
        2
      );
    }
    this.tableRowLength =
      1 +
      this.table!.columnMetadata.length +
      this.table!.externalRelationsMetadata.length;
    this.rowIndex = this.table!.rows.length;
  }

  private checkColumns() {
    if (this.data.columnsToInsert) {
      this.relativeTokenIndex = 6 + this.data.columnsToInsert.length * 2;
      this.columns = this.data.columnsToInsert.map((columnName, index) => {
        const column = this.table!.nameColumnMapping[columnName];
        if (!column) {
          this.relativeTokenError(
            `column ${column} does not exist in table ${this.data.tableName}`,
            4 + index * 2
          );
        }
        return column;
      });
      for (const column of this.table!.columnMetadata) {
        if (!this.columns.includes(column) && !column.nullable) {
          this.relativeTokenError(
            `columns that should be inserted should contain column ${column.name}, as it is not nullable`,
            3,
            this.columns.length * 2
          );
        }
      }
    } else {
      this.relativeTokenIndex = 5;
      this.columns = this.table!.columnMetadata;
    }
    // at the end the relativeTokenIndex should be at the token of the first value of the first frow
  }

  private columnNames(columns: ColumnMetadata[]): string {
    return columns.reduce((s, column, index, arr) => {
      if (index === 0) {
        return column.name;
      }
      if (index === arr.length - 1) {
        return `${s}, ${column.name}`;
      }
      return `${s} and ${column.name}`;
    }, "");
  }

  private throwValueWrongDataTypeError(
    columnName: string,
    expected: string,
    actual: string
  ): never {
    this.relativeTokenError(
      `column ${columnName} is of type ${expected} and cannot accept a value of type ${actual.toUpperCase()}`,
      this.relativeTokenIndex
    );
  }

  private checkRowValueDataType(
    column: ColumnMetadata,
    data: string | number | boolean
  ): string | number | boolean {
    const expectedType = column.type;
    switch (expectedType) {
      case DataType.boolean:
        if (data === 1 || data === 0 || data === true || data === false) {
          return data;
        }
        this.throwValueWrongDataTypeError(column.name, "BOOLEAN", typeof data);
      case DataType.int:
      case DataType.float:
        if (data === true) {
          return 1;
        }
        if (data === false) {
          return 0;
        }
        if (
          typeof data === "number" &&
          (expectedType !== DataType.int || Number.isInteger(data))
        ) {
          return data;
        }
        this.throwValueWrongDataTypeError(column.name, "INT", typeof data);
      default:
        if (typeof data === "string") {
          return data;
        }
        this.throwValueWrongDataTypeError(column.name, "TEXT", typeof data);
    }
  }

  private checkRowLength(row: Data[]): void {
    if (row.length < this.columns!.length) {
      const excessColumns = this.columns!.slice(row.length);
      const plural = excessColumns.length > 1 ? "s" : "";
      this.relativeTokenError(
        `value${plural} expected for column${plural}: ${this.columnNames(
          excessColumns
        )}`,
        this.relativeTokenIndex + (row.length - 1) * 2
      );
    } else if (row.length > this.columns!.length) {
      const plural = this.columns!.length > 1 ? "s" : "";
      this.relativeTokenError(
        `only expected ${
          this.columns!.length
        } value${plural} for column${plural}: ${this.columnNames(
          this.columns!
        )}, instead got ${row.length} values`,
        this.relativeTokenIndex,
        this.relativeTokenIndex + (row.length - 1) * 2
      );
    }
  }

  private checkAndCreateRowToInsert(row: Data[]): Data[] {
    const rowToInsert = Array(this.tableRowLength).fill(undefined);
    for (let i = 0; i < row.length; i++) {
      const data = row[i];
      const columnMetadata = this.columns![i];
      if (data === null) {
        if (!columnMetadata.nullable) {
          this.relativeTokenError(
            `column ${columnMetadata.name} is not nullable`,
            this.relativeTokenIndex
          );
        }
        rowToInsert[columnMetadata.columnIndex + 1] = null;
      } else {
        rowToInsert[columnMetadata.columnIndex + 1] =
          this.checkRowValueDataType(columnMetadata, data);
      }
      rowToInsert[0] = this.rowIndex++;
      this.relativeTokenIndex += 2; // relativeTokenIndex is at token of the first value of the next value
    }
    return rowToInsert;
  }

  private checkRowForeignConstraints(
    rowToInsert: Data[],
    rowBegin: number,
    rowEnd: number
  ): void {
    relations: for (const relation of this.table!.internalRelationsMetadata) {
      // if not all relation columns are null => relation has to be checked
      if (relation.fromColumnIds.some((i) => rowToInsert[i + 1] !== null)) {
        // look for row which map
        rows: for (const toRow of relation.to.rows) {
          for (
            let relationColumnIndex = 0;
            relationColumnIndex < relation.fromColumnIds.length;
            relationColumnIndex++
          ) {
            const fromVal =
              rowToInsert[relation.fromColumnIds[relationColumnIndex] + 1];
            const toVal = toRow[relation.toColumnIds[relationColumnIndex] + 1];
            if (fromVal !== toVal) {
              continue rows;
            }
          }
          // insert relation in other table
          const otherTableRelationRowIndex =
            relation.to.columnMetadata.length +
            1 +
            relation.to.externalRelationsMetadata.indexOf(relation);
          const relations: any[][] = toRow[otherTableRelationRowIndex] ?? [];
          relations.push(rowToInsert);
          toRow[otherTableRelationRowIndex] = relations;
          continue relations;
        }
        this.relativeTokenError(
          `could not insert rows, because this row does not fullfill constraint ${this.relationToString(
            relation
          )}`,
          rowBegin,
          rowEnd
        );
      }
    }
  }

  private checkIfRowPrimaryKeyUnique(
    rowToinsert: Data[],
    rowBegin: number,
    rowEnd: number
  ) {
    if (this.table!.primaryColumnIds.length !== 0) {
      // check if primary key is unique
      oldRows: for (const oldRow of InsertExecutor.combineIterator(
        this.table!.rows,
        this.rowsToInsert
      )) {
        for (const { columnIndex } of this.table!.primaryColumnIds) {
          if (rowToinsert[columnIndex + 1] !== oldRow[columnIndex + 1]) {
            continue oldRows;
          }
        }
        throw this.relativeTokenError(
          "could not insert rows, because row already exists with identical primary key",
          rowBegin,
          rowEnd
        );
      }
    }
  }

  private checkRows() {
    for (const row of this.data.rowsToInsert) {
      const rowBegin = this.relativeTokenIndex;
      const rowEnd = rowBegin + (this.columns!.length - 1) * 2;
      this.checkRowLength(row);
      const rowToInsert = this.checkAndCreateRowToInsert(row);
      this.checkIfRowPrimaryKeyUnique(rowToInsert, rowBegin, rowEnd);
      this.checkRowForeignConstraints(rowToInsert, rowBegin, rowEnd);
      this.rowsToInsert.push(rowToInsert);
    }
    this.relativeTokenIndex += 2; // relativeTokenIndex is at token of the first value of the next row
  }

  private relationToString(relation: Relation): string {
    return `FOREIGN KEY (${relation.fromColumnIds.map(
      (index) => relation.from.columnMetadata[index].name
    )}) REFERENCES ${relation.to.name} (${relation.toColumnIds.map(
      (index) => relation.to.columnMetadata[index].name
    )})`;
  }
}

export const insertConfig: StatementConfig<InsertData> = {
  name: "insert rows",
  description: "create new tables with references to other tables",
  begin: Keyword.insert,
  parser: InsertParser,
  executor: InsertExecutor,
};
