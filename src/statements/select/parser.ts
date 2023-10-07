import { BaseStatementParser } from "../../base_statement_parser";
import { StatementParserType } from "../../nparser";
import SelectData from "./data";

export default class SelectParser
  extends BaseStatementParser
  implements StatementParserType<SelectData>
{
  public parse(): void {}
}
