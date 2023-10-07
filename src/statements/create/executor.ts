import { BaseStatementExecutor } from "../../base_statement_executor";
import { ColumnMetadata, Relation, Table } from "../../database";
import { ExecutionError, ParseError } from "../../error";
import CreateData from "./data";

export default class CreateExecutor extends BaseStatementExecutor<CreateData> {
  public execute(): void {
    if (this.database.getTable(this.data.tableName) !== null) {
      throw `table ${this.data.tableName} already exists`;
    }
    this.createNewTable();
  }

  private createNewTable() {
    // check if primary keys exist
    for (const primaryKey of this.data.primaryKeys) {
      if (!this.data.columns.some((column) => column.name === primaryKey)) {
        throw new ExecutionError(
          `PRIMARY KEY ${primaryKey} does not exist in table ${this.data.tableName}`,
          ...this.data.primaryKeyTokens!
        );
      }
    }
    const columns: ColumnMetadata[] = this.data.columns.map((column, index) => {
      if (this.data.primaryKeys.includes(column.name)) {
        return {
          name: column.name,
          primary: true,
          nullable: false,
          type: column.type,
          relationsTo: [],
          columnIndex: index,
        };
      }
      return {
        name: column.name,
        primary: false,
        nullable: column.nullable,
        type: column.type,
        relationsTo: [],
        columnIndex: index,
      };
    });
    const nameColumnMapping: Record<string, ColumnMetadata> = {};
    for (let columnIndex = 0; columnIndex < columns.length; columnIndex++) {
      const column = columns[columnIndex];
      nameColumnMapping[column.name] = column;
    }

    const table: Table = {
      name: this.data.tableName,
      rows: [],
      columnMetadata: columns,
      externalRelationsMetadata: [],
      internalRelationsMetadata: [],
      nameColumnMapping,
      primaryColumnIds: this.data.primaryKeys.map(
        (primaryColumnName) =>
          columns.find((column) => column.name === primaryColumnName)!
      ),
    };

    this.database.setTable(this.data.tableName, table);

    for (const rawRelation of this.data.relations) {
      const toTable = this.database.getTable(rawRelation.tableTo);
      if (toTable === null) {
        throw new ParseError(
          `relation ${rawRelation.tableTo} does not exist`,
          rawRelation.tokenStart,
          rawRelation.tokenEnd
        );
      }
      let toColumns: ColumnMetadata[];
      if (rawRelation.columnsTo === null) {
        toColumns = toTable.primaryColumnIds.map(
          ({ columnIndex: id }) => toTable.columnMetadata[id]
        );
        if (toColumns.length !== rawRelation.columnsFrom.length) {
          throw new ParseError(
            `PRIMARY KEY of relation ${rawRelation.tableTo} does not contain the same number of columns as the FOREIGN KEY`,
            rawRelation.tokenStart,
            rawRelation.tokenEnd
          );
        }
      } else {
        // check if columns given match exactly order of columns
        toColumns = rawRelation.columnsTo.map((columnName) => {
          const column = toTable.columnMetadata.find(
            (column) => column.name === columnName
          );
          if (!column) {
            throw new ParseError(
              `column ${columnName} not found in relation ${rawRelation.tableTo}`,
              rawRelation.tokenStart,
              rawRelation.tokenEnd
            );
          }
          return column;
        });
        if (
          toColumns.length !== toTable.primaryColumnIds.length ||
          toColumns.some((column) => !column.primary)
        ) {
          throw new ParseError(
            `FOREIGN KEY has to reference the full PRIMARY KEY of relation ${rawRelation.tableTo}`,
            rawRelation.tokenStart,
            rawRelation.tokenEnd
          );
        }
      }
      // compare columns, and check if from columns exist (is already checked if fromColumn are duplicated)
      for (let i = 0; i < toColumns.length; i++) {
        const fromColumnName = rawRelation.columnsFrom[i];
        const fromColumn = table.columnMetadata.find(
          (column) => column.name === fromColumnName
        );
        if (!fromColumn) {
          throw new ParseError(
            `column ${fromColumnName} does not exist in table ${this.data.tableName}`,
            rawRelation.tokenStart,
            rawRelation.tokenEnd
          );
        }
        if (fromColumn.type !== toColumns[i].type) {
          throw new ParseError(
            "FOREIGN KEY and PRIMARY KEY columns do not match types",
            rawRelation.tokenStart,
            rawRelation.tokenEnd
          );
        }
      }
      const relation: Relation = {
        fromColumnIds: rawRelation.columnsFrom.map((columnName) =>
          table.columnMetadata.findIndex((column) => column.name === columnName)
        ),
        from: table,
        to: toTable,
        toColumnIds: toColumns.map((column) => column.columnIndex),
      };
      table.internalRelationsMetadata.push(relation);
      toTable.externalRelationsMetadata.push(relation);
      toTable.rows.forEach((row) => row.length++); // TODO: allowed?
    }
  }
}
