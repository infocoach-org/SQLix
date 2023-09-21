import { ColumnMetdata, DataType, Relation, Table } from "../database";
import { StatementParser, StatementConfig, typeMapping } from "../nparser";
import { Keyword, TokenLocation, TokenType } from "../tokenizer";

// FOREIGN KEYS => foreign key(a,b) references a(a,b), cannot be a(b,a)

export const typeMapping: Record<string, DataType | undefined> = {
  int: DataType.int,
  integer: DataType.int,
  float: DataType.float,
  real: DataType.float,
  number: DataType.float,
  text: DataType.text,
  varchar: DataType.text,
  boolean: DataType.boolean,
};

interface ColumnToInsert {
  name: string;
  type: DataType;
  nullable: boolean;
}

interface RelationToInsert {
  tokenStart: TokenLocation;
  tokenEnd: TokenLocation;
  tableTo: string;
  columnsFrom: string[];
  // if columnsTo is null, columnsFrom can only be not null
  columnsTo: string[] | null;
}

export class CreateParserManager extends StatementConfig<null> {
  statementName = "create tables";
  statementDescription = "create new tables with references to other tables";
  firstKeyword = Keyword.create;
  requiredStatementState = null;
  parser = CreateParser;
}

export class CreateParser extends StatementParser {
  private tableName: string = "";
  private primaryKeyIsSet = false;
  private primaryKeys: string[] = [];
  private columns: ColumnToInsert[] = [];
  private relations: RelationToInsert[] = [];
  private primaryKeyTokens?: [TokenLocation, TokenLocation];

  private static relationEqual(
    a: RelationToInsert,
    b: RelationToInsert
  ): boolean {
    if (a.tableTo !== b.tableTo) {
      return false;
    }
    if (
      a.columnsFrom.length !== b.columnsFrom.length ||
      a.columnsTo?.length !== b.columnsTo?.length
    ) {
      return false;
    }
    if (a.columnsTo === null) {
      if (a.columnsFrom[0] === b.columnsFrom[0]) {
        return true;
      } else {
        return false;
      }
    }

    // check if each column maps to same column in both relation
    for (
      let columnIndex = 0;
      columnIndex < a.columnsFrom.length;
      columnIndex++
    ) {
      const existingColumnFromName = a.columnsFrom[columnIndex];
      const existingColumnToName = a.columnsTo![columnIndex];
      const newColumnFromNameIndex = b.columnsFrom.indexOf(
        existingColumnFromName
      );
      if (newColumnFromNameIndex === -1) {
        return false;
      }
      if (existingColumnToName !== b.columnsTo![newColumnFromNameIndex]) {
        return false;
      }
    }
    return true;
  }

  private newRelation(relation: RelationToInsert) {
    if (
      this.relations.some((existingRelation) =>
        CreateParser.relationEqual(relation, existingRelation)
      )
    )
      return;
    this.relations.push(relation);
  }

  private createNewTable() {
    // check if primary keys exist
    for (const primaryKey of this.primaryKeys) {
      if (!this.columns.some((column) => column.name === primaryKey)) {
        throw new ParseError(
          `PRIMARY KEY ${primaryKey} does not exist in table ${this.tableName}`,
          this.primaryKeyTokens![0],
          this.primaryKeyTokens![1]
        );
      }
    }
    const columns: ColumnMetdata[] = this.columns.map((column, index) => {
      if (this.primaryKeys.includes(column.name)) {
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
    const columnsMapping: Record<string, ColumnMetdata> = {};
    for (let columnIndex = 0; columnIndex < columns.length; columnIndex++) {
      const column = columns[columnIndex];
      columnsMapping[column.name] = column;
    }

    const table: Table = {
      name: this.tableName,
      rows: [],
      columnMetadata: columns,
      externalRelationsMetadata: [],
      internalRelationsMetadata: [],
      nameColumnIndexMapping: columnsMapping,
      primaryColumnIds: this.primaryKeys.map(
        (primaryColumnName) =>
          columns.find((column) => column.name === primaryColumnName)!
      ),
    };

    this.database.setTable(this.tableName, table);

    for (const rawRelation of this.relations) {
      const toTable = this.database.getTable(rawRelation.tableTo);
      if (toTable === null) {
        throw new ParseError(
          `relation ${rawRelation.tableTo} does not exist`,
          rawRelation.tokenStart,
          rawRelation.tokenEnd
        );
      }
      let toColumns: ColumnMetdata[];
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
            `column ${fromColumnName} does not exist in table ${this.tableName}`,
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
      toTable.rows.forEach((row) => row.push([]));
    }
  }

  public parse(): void {
    try {
      this.expectKeyword(Keyword.table, "for CREATE TABLE statement");
      const identifierToken = this.tokens.consume();
      if (identifierToken.type === TokenType.identifier) {
        this.tableName = identifierToken.identifier;
        if (this.database.getTable(this.tableName) !== null) {
          throw `table ${this.tableName} already exists`;
        }
      } else {
        throw "table name expected";
      }
      this.expectType(TokenType.openParantheses);

      this.parseMoreThanOne(this.parseColumnOrConstraintDefinition);

      this.expectType(
        TokenType.closedParantheses,
        undefined,
        "expected either ')' to end table definition or ',' for next column/constraint defintion"
      );
      this.createNewTable();
    } catch (e) {
      if (e instanceof ParseError) {
        throw e;
      } else if (typeof e === "string") {
        throw new ParseError(e, this.tokens.read());
      }
    }
  }

  private parseColumnOrConstraintDefinition() {
    const token = this.tokens.consume();
    if (token.tokenId === Keyword.constraint) {
      if (this.tokens.consume().type === TokenType.identifier) {
        if (token.tokenId === Keyword.foreign) {
          this.parseForeignConstraint();
        } else if (token.tokenId === Keyword.primary) {
          this.parsePrimaryConstraint();
        }
      } else {
        throw "expected constraint name";
      }
    } else if (token.tokenId === Keyword.foreign) {
      this.parseForeignConstraint();
    } else if (token.tokenId === Keyword.primary) {
      this.parsePrimaryConstraint();
    } else if (token.type === TokenType.identifier) {
      this.parseColumn(token.identifier);
    } else {
      throw "expected column name for a column definition or a constraint definition";
    }
  }

  private parseForeignConstraint() {
    const firstToken = this.expectKeyword(Keyword.key);
    this.expectType(TokenType.openParantheses);
    const foreignKeys = this.parseIdentifierList("column name");
    this.expectType(TokenType.closedParantheses);
    this.expectKeyword(Keyword.references);
    const foreignTableName = this.expectIdentifier("table name");
    this.expectType(TokenType.openParantheses);
    const foreignPrimaryKeys = this.parseIdentifierList(
      `${foreignTableName} column name`
    );
    if (new Set(foreignKeys).size < foreignKeys.length) {
      throw "FOREIGN KEY cannot contain columns more than once";
    }
    const lastToken = this.expectType(TokenType.closedParantheses);
    this.newRelation({
      tokenStart: firstToken,
      tokenEnd: lastToken,
      tableTo: foreignTableName,
      columnsFrom: foreignKeys,
      columnsTo: foreignPrimaryKeys,
    });
  }

  private parsePrimaryConstraint() {
    this.expectKeyword(Keyword.key);
    if (this.primaryKeyIsSet) {
      throw (
        "PRIMARY KEY constraint is already set, " +
        "to set multiple primary keys, " +
        "use one PRIMARY KEY constaint, " +
        "with all columns that should be included in the PRIMARY KEY"
      );
    }
    this.expectType(TokenType.openParantheses);
    this.primaryKeys = this.parseIdentifierList("column name");
    if (new Set(this.primaryKeys).size < this.primaryKeys.length) {
      throw "PRIMARY KEY cannot contain columns more than once";
    }
    this.expectType(TokenType.closedParantheses);
    this.primaryKeyIsSet = true;
  }

  // if (
  //   table.primaryColumnIds.length !== 1 ||
  //   !(columnName in table.nameColumnIndexMapping) ||
  //   !table.columnMetadata[table.primaryColumnIds[0]].primary
  // ) {
  //   throw `column ${columnName} is not the only PRIMARY KEY qualified column of table ${tableName}`;

  private parseColumn(name: string) {
    if (this.columns.some((column) => column.name === name)) {
      throw "column with same name already exists";
    }
    const typeToken = this.tokens.consume();
    let typeName: DataType;
    if (typeToken.type === TokenType.identifier) {
      const maybeTypeName = typeMapping[typeToken.identifier];
      if (maybeTypeName === undefined) {
        throw `type '${typeToken.identifier}' does not exist`;
      } else {
        typeName = maybeTypeName;
      }
    } else {
      throw "column type expected";
    }
    if (this.tokens.read().type === TokenType.openParantheses) {
      // for types such as varchar(30)
      this.tokens.consume();
      this.expectType(TokenType.number, undefined, "expected type length");
      this.expectType(TokenType.closedParantheses);
    }
    let nullable = true;
    let foreignKeySet = false;
    while (true) {
      const token = this.tokens.read();
      if (token.tokenId === Keyword.references) {
        this.tokens.consume();
        if (foreignKeySet) {
          throw "for a column to reference more than another column use a FOREIGN KEY constraint";
        }
        foreignKeySet = true;
        const tableName = this.expectIdentifier("table name");
        let explicitForeignKeyColumnName: string | null = null;
        if (this.tokens.read().type === TokenType.openParantheses) {
          this.tokens.consume();
          explicitForeignKeyColumnName = this.expectIdentifier("column name");
          this.expectType(TokenType.closedParantheses);
        }
        this.newRelation({
          tokenStart: token,
          tokenEnd: this.tokens.consume(),
          tableTo: tableName,
          columnsFrom: [name],
          columnsTo: explicitForeignKeyColumnName
            ? [explicitForeignKeyColumnName]
            : null,
        });
      } else if (token.tokenId === Keyword.primary) {
        this.tokens.consume();
        this.expectKeyword(Keyword.key);
        if (this.primaryKeyIsSet) {
          throw (
            "PRIMARY KEY constraint is already set, " +
            "to set multiple primary keys, " +
            "use the PRIMARY KEY constaint, " +
            "with all columns that should be included in the primary key"
          );
        }
        this.primaryKeyIsSet = true;
        // if (typeName === DataType.boolean) {
        // throw "PRIMARY KEY can only be of data type INT/INTEGER, FLOAT/NUMBER or TEXT";
        // }
        this.primaryKeys = [name];
      } else if (token.tokenId === Keyword.not) {
        this.tokens.consume();
        this.expectKeyword(Keyword.null);
        if (!nullable) {
          throw "NOT NULL attribute can only be set once";
        }
        nullable = false;
      } else {
        break;
      }
    }
    this.columns.push({ nullable, type: typeName, name });
  }
}
