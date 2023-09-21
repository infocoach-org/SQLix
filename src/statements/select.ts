import { ColumnMetdata, DataType, Relation, Table } from "../database";
import { StatementParser, StatementConfig, typeMapping } from "../nparser";
import { ParseError } from "../parse_error";
import { Keyword, TokenLocation, TokenType } from "../tokenizer";

export class SelectParserManager extends StatementConfig<null> {
  statementName = "query tables";
  statementDescription = "retrieve one or more rows from one or more tables";
  firstKeyword = Keyword.create;
  requiredStatementState = null;
  parser = SelectParser;
}

export class SelectParser extends StatementParser {
  public parse(): void {}
}
