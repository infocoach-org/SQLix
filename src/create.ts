// create table abc(a int primary key, b int primary key); (not possible)

import { ColumnMetdata, DataType, Database } from "./database";
import { ParseError } from "./parse_error";
import { typeMapping } from "./nparser";
import { Keyword, TokenLocation, TokenType } from "./tokenizer";

// create table abc(a int primary key not null); (possible)
// create table abc(a int not null primary key); (possible)

// => not null and primary/foreign keys can just be listed without any specific order

// works, for some reason :sob:
// create table abcd(
// a int primary key references abcde);

// create table abcde(
// a int primary key references abcd);

interface TableToInsert {
  nameToken: TokenLocation;
  primaryKeys: string[];
  columns: ColumnToInsert[];
}

interface ColumnToInsert {
  name: string;
  type: DataType;
  nullable: boolean;
}

interface RelationToInsert {
  tokenStart: TokenLocation;
  tokenEnd: TokenLocation;
  tableFrom: string;
  tableTo: string;
  columnsFrom: string[];
  // if columnsTo is null, columnsFrom can only be not null
  columnsTo: string[] | null;
}

export class TableInserter {
  constructor(private database: Database) {}
  tables: Record<string, TableToInsert> = {};
  relations: RelationToInsert[] = [];
  tableExists(name: string): boolean {
    return !!this.database.getTable(name) || name in this.tables;
  }

  private static relationEqual(
    a: RelationToInsert,
    b: RelationToInsert
  ): boolean {
    if (a.tableFrom !== b.tableFrom || a.tableTo !== b.tableTo) {
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

  newRelation(relation: RelationToInsert) {
    // check if same relation already exists
    if (
      !this.relations.some((exisitingRelation) =>
        TableInserter.relationEqual(exisitingRelation, relation)
      )
    ) {
      this.relations.push(relation);
    } else {
      console.log("WARNING: duplicate relation cought");
    }
  }

  newTable(name: string, table: TableToInsert) {
    this.tables[name] = table;
  }

  insertTables() {
    for (const tableName in this.tables) {
      const table = this.tables[tableName];
      // check if primary keys exist
      for (const primaryKey of table.primaryKeys) {
        if (!table.columns.some((column) => column.name === primaryKey)) {
          throw new ParseError(
            `PRIMARY KEY ${primaryKey} does not exist in table ${tableName}`,
            table.nameToken
          );
        }
      }
      const columns: ColumnMetdata[] = table.columns.map((column) => {
        if (table.primaryKeys.includes(column.name)) {
          return {
            name: column.name,
            primary: true,
            nullable: false,
            type: column.type,
            relationsTo: [],
          };
        }
        return {
          name: column.name,
          primary: false,
          nullable: column.nullable,
          type: column.type,
          relationsTo: [],
        };
      });
      const columnsMapping: Record<string, number> = {};
      for (let columnIndex = 0; columnIndex < columns.length; columnIndex++) {
        const column = columns[columnIndex];
        columnsMapping[column.name] = columnIndex;
      }

      this.database.setTable(tableName, {
        rows: [],
        columnMetadata: columns,
        fromRelationsMetdata: [],
        toRelationsMetdata: [],
        nameColumnIndexMapping: columnsMapping,
        primaryColumnIds: table.primaryKeys.map((primaryColumnName) =>
          columns.findIndex((column) => column.name === primaryColumnName)
        ),
      });
    }
  }

  insertRelations(): void {}
}

export class TableCreate {
  private tokens: TokenLocation[] = [];
  private tokenIndex: number = 0;
  private tableName: string = "";
  private primaryKeyIsSet = false;
  private primaryKeys: string[] = [];
  private columns: ColumnToInsert[] = [];

  constructor(private inserter: TableInserter) {}

  private readNextToken() {
    return this.tokens[this.tokenIndex++];
  }

  private readCurrentToken() {
    return this.tokens[this.tokenIndex - 1];
  }

  private peekToken() {
    return this.tokens[this.tokenIndex];
  }

  private expectType(
    type: TokenType,
    afterErrorMessage?: string | undefined,
    error?: string | undefined
  ) {
    if (this.readNextToken().type !== type) {
      throw error ?? `${type} expected` + (afterErrorMessage ?? "");
    }
  }
  private expectKeyword(
    keyword: Keyword,
    afterErrorMessage?: string | undefined,
    error?: string | undefined
  ): TokenLocation {
    const token = this.readNextToken();
    if (token.tokenId !== keyword) {
      throw (
        error ??
        `expected keyword ${keyword.toUpperCase()}${
          afterErrorMessage ? " " + afterErrorMessage : ""
        }`
      );
    }
    return token;
  }

  private expectIdentifier(identifierName: string): string {
    const token = this.readNextToken();
    if (token.type !== TokenType.identifier) {
      throw `expected ${identifierName}${
        token.type === TokenType.keyword
          ? `, keyword ${token.tokenId} cannot be used as a identifier`
          : ""
      }`;
    }
    return token.identifier;
  }

  private parseMoreThanOne(parseFunction: () => void): void {
    parseFunction = parseFunction.bind(this);
    parseFunction();
    while (this.peekToken().type === TokenType.comma) {
      this.readNextToken();
      parseFunction();
    }
  }

  private parseIdentifierList(identifierName: string): string[] {
    const arr = [this.expectIdentifier(identifierName)];
    while (this.peekToken().type === TokenType.comma) {
      this.readNextToken();
      const identifier = this.expectIdentifier(identifierName);
      if (arr.includes(identifier)) {
        throw `already mentioned ${identifierName} ${identifier}`;
      }
      arr.push(identifier);
    }
    return arr;
  }

  parse(tokens: TokenLocation[], tokenBeginIndex: number): number {
    this.tokens = tokens;
    this.tokenIndex = tokenBeginIndex;
    try {
      this.expectKeyword(Keyword.table, "for CREATE TABLE statement");
      const identifierToken = this.readNextToken();
      if (identifierToken.type === TokenType.identifier) {
        this.tableName = identifierToken.identifier;
        if (this.inserter.tableExists(this.tableName)) {
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
      this.inserter.newTable(this.tableName, {
        primaryKeys: this.primaryKeys,
        columns: this.columns,
        nameToken: tokens[tokenBeginIndex + 1],
      });
    } catch (e) {
      if (e instanceof ParseError) {
        throw e;
      } else if (typeof e === "string") {
        throw new ParseError(e, this.readCurrentToken());
      }
    }
    return this.tokenIndex - tokenBeginIndex + 1;
  }

  private parseColumnOrConstraintDefinition() {
    const token = this.readNextToken();
    if (token.tokenId === Keyword.constraint) {
      if (this.readNextToken().type === TokenType.identifier) {
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
    const foreignPrimaryKeys = this.parseIdentifierList("column name");
    if (foreignPrimaryKeys.length !== foreignKeys.length) {
      throw `${foreignKeys.length} foreign keys cannot reference ${foreignPrimaryKeys.length} columns in table ${foreignTableName} does not match`;
    }
    this.expectType(TokenType.closedParantheses);
    this.inserter.newRelation({
      tokenStart: firstToken,
      tokenEnd: this.readCurrentToken(),
      tableFrom: this.tableName,
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
    const typeToken = this.readNextToken();
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
    if (this.peekToken().type === TokenType.openParantheses) {
      // for types such as varchar(30)
      this.readNextToken();
      this.expectType(TokenType.number, undefined, "expected type length");
      this.expectType(TokenType.closedParantheses);
    }
    let nullable = true;
    let foreignKeySet = false;
    while (true) {
      const token = this.peekToken();
      if (token.tokenId === Keyword.references) {
        this.readNextToken();
        if (foreignKeySet) {
          throw "for a column to reference more than another column use a FOREIGN KEY constraint";
        }
        foreignKeySet = true;
        const tableName = this.expectIdentifier("table name");
        let explicitForeignKeyColumnName: string | null = null;
        if (this.peekToken().type === TokenType.openParantheses) {
          this.readNextToken();
          explicitForeignKeyColumnName = this.expectIdentifier("column name");
          this.expectType(TokenType.closedParantheses);
        }
        this.inserter.relations.push({
          tokenStart: token,
          tokenEnd: this.readCurrentToken(),
          tableTo: tableName,
          tableFrom: this.tableName,
          columnsFrom: [name],
          columnsTo: explicitForeignKeyColumnName
            ? [explicitForeignKeyColumnName]
            : null,
        });
      } else if (token.tokenId === Keyword.primary) {
        this.readNextToken();
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
        this.readNextToken();
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
