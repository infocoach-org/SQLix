import { ColumnMetdata, Data, DataType, Relation, Table } from "../database";
import { StatementParser, StatementParserManager } from "../nparser";
import { ParseError } from "../parse_error";
import { Keyword, TokenLocation, TokenType } from "../tokenizer";

export class InsertParserManager extends StatementParserManager<null> {
  statementName = "insert rows";
  statementDescription = "create new tables with references to other tables";
  firstKeyword = Keyword.insert;
  requiredStatementState = null;
  parser = InsertParser;
}

// currently all columns that have been given,
// must be filled out, if no columns were given,
// all columns musst be filled out
export class InsertParser extends StatementParser {
  table: Table | null = null;
  rowsToInsert: any[][] = [];
  tableRowLength: number = NaN;
  rowIndex: number = NaN;
  columnsToInsert: ColumnMetdata[] = [];

  public parseAndExecute(): void {
    this.expectKeyword(Keyword.into);
    const tableName = this.expectIdentifier("table name");
    const tableNameToken = this.lastExpectedToken as TokenLocation & {
      type: TokenType.identifier;
    };
    this.table = this.database.getTable(tableName);
    this.tableRowLength =
      1 +
      this.table!.columnMetadata.length +
      this.table!.externalRelationsMetadata.length;
    this.rowIndex = this.table!.rows.length;
    if (this.table === null) {
      throw new ParseError(
        `cannot insert into table ${tableName}, does not exist`,
        tableNameToken
      );
    }
    if (this.tokens.read().type === TokenType.openParantheses) {
      this.parseColumns(this.tokens.consume());
    } else {
      this.columnsToInsert = this.table.columnMetadata;
    }
    this.expectKeyword(Keyword.values);
    this.parseMoreThanOne(this.parseAndInsertValueRow);
    this.table.rows.push(...this.rowsToInsert);
  }

  private expectValue(column: ColumnMetdata): Data {
    const allowedDataType = column.type;
    const token = this.tokens.consume();
    const notAllowed = (actualType: string) => {
      throw new ParseError(
        `${actualType} not allowed in column ${column.name}, ` +
          `type ${allowedDataType} expected`,
        token
      );
    };
    switch (token.type) {
      case TokenType.number:
        if (allowedDataType !== DataType.float) {
          if (allowedDataType === DataType.int) {
            if (token.hasPoint) {
              throw new ParseError(
                `only integers, not floating point numbers, are allowed in column ${column.name}`,
                token
              );
            }
          } else notAllowed("NUMBER");
        }
        return token.value;
      case TokenType.string:
        if (allowedDataType !== DataType.text) {
          notAllowed("text");
        }
        return token.value;
      case TokenType.keyword:
        if (token.tokenId === Keyword.null) {
          if (!column.nullable) {
            throw new ParseError(
              `column ${column.name} is not nullable`,
              token
            );
          }
        } else if (token.tokenId === Keyword.default) {
          if (!column.nullable) {
            throw new ParseError(
              `default of column ${column.name} is null, but column ${column.name} is not nullable`,
              token
            );
          }
        } else if (
          token.tokenId === Keyword.true ||
          token.tokenId === Keyword.false
        ) {
          const val = token.tokenId === Keyword.true;
          if (allowedDataType !== DataType.boolean) {
            if (
              allowedDataType === DataType.int ||
              allowedDataType === DataType.float
            ) {
              return +val;
            } else {
              notAllowed("BOOLEAN");
            }
          }
          return val;
        }
    }
    if (token.type === TokenType.closedParantheses) {
      throw new ParseError(
        `A constant value has to be given for column ${column.name}`,
        token
      );
    } else {
      throw new ParseError(
        `Not a valid value, a value of type ${allowedDataType} is expected for the column ${column.name}`,
        token
      );
    }
  }

  private parseAndInsertValueRow() {
    const beginToken = this.expectType(TokenType.openParantheses);
    let row = Array(this.tableRowLength).fill(undefined);
    for (let i = 0; i < this.columnsToInsert.length; i++) {
      const columnMetadata = this.columnsToInsert[i];
      const value = this.expectValue(columnMetadata);
      row[columnMetadata.columnIndex + 1] = value;
      const isLastColumn = i === this.columnsToInsert.length - 1;
      if (!isLastColumn) {
        const commaToken = this.tokens.consume();
        if (commaToken.type !== TokenType.comma) {
          const nextColumnName = this.columnsToInsert[i + 1].name;
          if (commaToken.type === TokenType.closedParantheses) {
            throw new ParseError(
              `could not insert rows, expected further value for column ${nextColumnName}, for each row ${this.columnsToInsert.length} column values have to be given`,
              commaToken
            );
          }
          throw new ParseError(
            `could not insert rows, comma expected to seperate next value for column ${nextColumnName}`,
            commaToken
          );
        }
      }
    }
    const endToken = this.expectType(TokenType.closedParantheses);
    // check relations, and insert if they exist
    relations: for (const relation of this.table!.internalRelationsMetadata) {
      // if not all relation columns are null => relation has to be checked
      if (relation.fromColumnIds.some((i) => row[i + 1] !== null)) {
        // look for row which map
        rows: for (const toRow of relation.to.rows) {
          for (
            let relationColumnIndex = 0;
            relationColumnIndex < relation.fromColumnIds.length;
            relationColumnIndex++
          ) {
            const fromVal =
              row[relation.fromColumnIds[relationColumnIndex] + 1];
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
          relations.push(row);
          toRow[otherTableRelationRowIndex] = relations;
          continue relations;
        }
        throw new ParseError(
          `could not insert rows, becuase this row does not fullfill constraint ${this.relationToString(
            relation
          )}`,
          beginToken,
          endToken
        );
      }
    }
    // check if primary key exists
    if (this.table!.primaryColumnIds.length !== 0) {
      // check if primary key is unique
      oldRows: for (const oldRow of InsertParser.combineIterator(
        this.table!.rows,
        this.rowsToInsert
      )) {
        for (const { columnIndex } of this.table!.primaryColumnIds) {
          if (row[columnIndex + 1] !== oldRow[columnIndex + 1]) {
            continue oldRows;
          }
        }
        throw new ParseError(
          "could not insert rows, because row already exists with identical primary key",
          beginToken,
          endToken
        );
      }
    }
    // set row index
    row[0] = this.rowIndex++;
    this.rowsToInsert.push(row);
  }

  private relationToString(relation: Relation): string {
    return `FOREIGN KEY (${relation.fromColumnIds.map(
      (index) => relation.from.columnMetadata[index].name
    )}) REFERENCES ${relation.to.name} (${relation.toColumnIds.map(
      (index) => relation.to.columnMetadata[index].name
    )})`;
  }

  private static *combineIterator<T>(
    a: Iterable<T>,
    b: Iterable<T>
  ): Iterable<T> {
    yield* a;
    yield* b;
  }

  private parseColumns(beginToken: TokenLocation) {
    // TODO: replace with parseMoreThanOne, as insert into a () also allowed
    this.parseMoreThanOne(() => {
      const columnName = this.expectIdentifier("column name");
      if (this.columnsToInsert.some((column) => column.name === columnName)) {
        this.lastExpectedTokenError(
          `column ${columnName} cannot be inserted twice`
        );
      }
      if (columnName in this.table!.nameColumnIndexMapping) {
        this.columnsToInsert.push(
          this.table!.nameColumnIndexMapping[columnName]
        );
      } else {
        this.lastExpectedTokenError(`column does not exist`);
      }
    });
    this.expectType(TokenType.closedParantheses);
    for (const column of this.table!.columnMetadata) {
      if (!this.columnsToInsert.includes(column) && !column.nullable) {
        throw new ParseError(
          `columns that should be inserted should contain column ${column.name}, as it is not nullable`,
          beginToken,
          this.lastExpectedToken
        );
      }
    }
  }
}
