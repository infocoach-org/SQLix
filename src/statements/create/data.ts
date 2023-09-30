import { DataType } from "../../database";
import { TokenLocation } from "../../tokenizer";

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

export interface ColumnToInsert {
  name: string;
  type: DataType;
  nullable: boolean;
}

export interface RelationToInsert {
  tokenStart: TokenLocation;
  tokenEnd: TokenLocation;
  tableTo: string;
  columnsFrom: string[];
  // if columnsTo is null, columnsFrom can only be not null
  columnsTo: string[] | null;
}

export default interface CreateData {
  tableName: string;
  primaryKeyIsSet: boolean;
  primaryKeys: string[];
  columns: ColumnToInsert[];
  relations: RelationToInsert[];
  primaryKeyTokens?: [TokenLocation, TokenLocation];
}
