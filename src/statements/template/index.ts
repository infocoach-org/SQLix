import { StatementConfig } from "../../nparser";
import { Keyword } from "../../tokenizer";
import TemplateData from "./data";
import TemplateExecutor from "./executor";
import TemplateParser from "./parser";

export const templateConfig: StatementConfig<TemplateData> = {
  name: "",
  description: "",
  begin: Keyword.true,
  parser: TemplateParser,
  executor: TemplateExecutor,
};
