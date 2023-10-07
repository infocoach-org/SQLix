import { StatementConfig } from "../../nparser";
import { Keyword } from "../../tokenizer";
import SelectData from "./data";
import SelectExecutor from "./executor";
import SelectParser from "./parser";

export const selectConfig: StatementConfig<SelectData> = {
  name: "",
  description: "",
  begin: Keyword.true,
  parser: SelectParser,
  executor: SelectExecutor,
};
