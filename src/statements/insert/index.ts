import { StatementConfig } from "../../nparser";
import { Keyword } from "../../tokenizer";
import InsertData from "./data";
import InsertExecutor from "./executor";
import InsertParser from "./parser";

export const insertConfig: StatementConfig<InsertData> = {
  name: "insert rows",
  description: "create new tables with references to other tables",
  begin: Keyword.insert,
  parser: InsertParser,
  executor: InsertExecutor,
};
