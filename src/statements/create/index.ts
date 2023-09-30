import { StatementConfig } from "../../nparser";
import { Keyword } from "../../tokenizer";
import CreateData from "./data";
import CreateExecutor from "./executor";
import CreateParser from "./parser";

export const createConfig: StatementConfig<CreateData> = {
  name: "Create table",
  description:
    "Create a table with columns, their type definitions, primary key constraints and foreign key constraints",
  begin: Keyword.create,
  parser: CreateParser,
  executor: CreateExecutor,
};
