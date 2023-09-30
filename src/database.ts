export enum DataType {
  int = "int",
  float = "float",
  text = "text",
  boolean = "boolean",
}

export class Database {
  private tables: Map<string, Table> = new Map();

  getTable(name: string): Table | null {
    return this.tables.get(name) ?? null;
  }

  setTable(name: string, table: Table) {
    this.tables.set(name, table);
  }

  printTableSchema(name: string) {
    if (!this.tables.has(name))
      return console.error(`table ${name} does not exist`);
    const table = this.getTable(name)!
      .columnMetadata.map(
        (metadata) =>
          `${metadata.name} ${metadata.type.toUpperCase()}${
            metadata.primary
              ? " PRIMARY KEY"
              : metadata.nullable
              ? ""
              : " NOT NULL"
          }`
      )
      .map((entry) => ({ [name]: entry }));
    console.table(table, [name]);
  }

  printAllTableSchemas() {
    for (const tableEntry of this.tables) {
      console.log(tableEntry);
      this.printTableSchema(tableEntry[0]);
    }
  }
}

class DatabaseHydrator {
  constructor(storedDatabase: Object | string | number | null) {}
}

interface DatabaseHydrator {}

// const rowRelationsKey = Symbol();
// const rowForeignRelationsKey = Symbol();

// type Row = {
//   [rowRelationsKey]: Record<string, Row>;
//   [rowForeignRelationsKey]: Record<string, Row[]>;
// } & Record<symbol, string>;

export type Data = string | number | boolean | null;

// class Table {
//   primaryKeyMetadata: string[];
//   rowMetadata: Record<string, { nullable: boolean; dataType: DataType }>;
//   rowLinearMetadata: { name: string; nullable: boolean; dataType: DataType }[];
//   relationMedataData: Record<
//     symbol,
//     { table: string; rowMapping: Record<string, string> }
//   >;

//   rows: Row[] = [];
// }

interface BaseColumnMetadata {
  name: string;
  type: DataType;
  primary: boolean;
  relationsTo: Relation[];
  columnIndex: number; // real column index is columnIndex + 1 // should not be stored
}

// type Metadata = BaseMetadata &
//   (
//     | {
//         type: DataType;
//         nullable: boolean;
//         primary: false;
//       }
//     | {
//         type: DataType.int | DataType.float | DataType.text;
//         primary: true;
//         // primary can never be nullable (even if multiple)
//         nullable: false;
//       }
//   );

// interface Relation {
//   from: Table;
//   fromColumns: number[];
//   to: Table;
// }

// class Table {
//   primaryKeyCount: number = 0;
//   columnMetadata: Metadata[] = [];
//   fromRelationsMetdata: Relation[] = []; // only from relations are in columns
//   toRelationsMetdata: Relation[] = [];
//   // first columns (and before that all primaries keys), then from relations
//   rows: any[][] = [];

//   constructor();
// }

export type ColumnMetadata = BaseColumnMetadata &
  (
    | {
        nullable: boolean;
        primary: false;
      }
    | {
        primary: true; // primary can never be nullable (even if multiple)
        nullable: false;
      }
  );

export interface Relation {
  from: Table;
  fromColumnIds: number[];
  to: Table;
  toColumnIds: number[];
}

export interface Table {
  name: string;
  primaryColumnIds: ColumnMetadata[];
  nameColumnMapping: Record<string, ColumnMetadata>;
  columnMetadata: ColumnMetadata[];
  // foreign keys are stored in the other table, it stores the reference to this table
  externalRelationsMetadata: Relation[]; // only external relations are in columns
  internalRelationsMetadata: Relation[];
  rows: any[][]; // first index of row, then columns, then external relations
  //[index of row, ...column metadata, ...external relations]
  // index of row actually be exaclty the index
  // external relations can each eather be an array of the other relation, or undefined (if no relations exist)
}

interface DataSource {
  getValue(table: string | null, column: string): Data;
  skipRows(howMany: number): void;
  rowExists(): boolean;
}

// class LengthDataSource implements DataSource {
//   constructor(
//     private source: DataSource,
//     private skip: number,
//     private length: number
//   ) {
//     source.skipRows(skip);
//   }

//   getValue(table: string | null, column: string): Data {
//     throw new Error("Method not implemented.");
//   }
//   nextRow(): void {
//     throw new Error("Method not implemented.");
//   }
// }
