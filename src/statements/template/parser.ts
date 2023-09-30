import { BaseStatementParser } from "../../base_statement_parser";
import { StatementParserType } from "../../nparser";
import TemplateData from "./data";

export default class TemplateParser
  extends BaseStatementParser
  implements StatementParserType<TemplateData>
{
  public parse(): void {}
}
