import { Database } from "./database";
import { ParseError } from "./error";
import {
  BaseSQLRunner,
  StatementConfig,
  StatementData,
  StatementExecutionResult,
  StatementParser,
} from "./nparser";
import { Keyword, TokenSource, TokenType } from "./tokenizer";

type SingleStatementSQLRunnerConfig = {
  atLeastOneStatement: boolean;
};

export class SingleStatementSQLRunner extends BaseSQLRunner {
  private config: SingleStatementSQLRunnerConfig;

  constructor(
    database: Database,
    statementParsers: StatementConfig<StatementData>[],
    config?: { atLeastOneStatement?: boolean }
  ) {
    config ??= {};
    config.atLeastOneStatement ??= false;
    super(database, statementParsers);
    this.config = config as SingleStatementSQLRunnerConfig;
  }

  protected run(tokens: TokenSource):
    | {
        error: ParseError;
      }
    | {
        error: null;
        results: Iterable<StatementExecutionResult<StatementData>>;
      } {
    while (tokens.read().type === TokenType.semicolon) {
      tokens.consume();
    }
    const startToken = tokens.consume();
    if (startToken.type === TokenType.eof) {
      if (this.config.atLeastOneStatement) {
        return {
          error: new ParseError(
            "at least one statement expected",
            tokens.tryToGetTokenAtIndex(0) ?? startToken,
            tokens.tryToGetLastToken() ?? startToken
          ),
        };
      } else {
        return { error: null, results: [] };
      }
    }
    if (startToken.type !== TokenType.keyword) {
      return {
        error: new ParseError("statements begin with a keyword", startToken),
      };
    }
    const keyword = startToken.tokenId as Keyword;
    if (!(keyword in this.statementParserMap)) {
      return {
        error: new ParseError(
          `no statement begins with the keyword ${keyword}`,
          startToken
        ),
      };
    }
    const statementConfig = this.statementParserMap[keyword]!;
    const statementParser = new statementConfig.parserConstructor(
      tokens,
      this.database
    );
    try {
      statementParser.parse(); // TokenSource musst be on eof or semicolon, no other statement allowed
    } catch (e) {
      if (e instanceof ParseError) {
        return {
          error: e,
        };
      } else {
        throw e;
      }
    }
    const endToken = tokens.before() ?? startToken;
    if (
      tokens.read().type !== TokenType.semicolon &&
      tokens.read().type !== TokenType.eof
    ) {
      return {
        error: new ParseError(
          `${statementConfig.statementName.toUpperCase()} statement is already finished, unexpected token`,
          tokens.read()
        ),
      };
    }
    tokens.consume();
    while (tokens.read().type === TokenType.semicolon) {
      tokens.consume();
    }
    if (tokens.read().type !== TokenType.eof) {
      return {
        error: new ParseError("only one statement allowed", tokens.read()),
      };
    }
    const executor = new statementConfig.executorConstructor(
      this.database,
      this.statementParsers as any,
      statementParser,
      statementConfig as any,
      startToken,
      endToken
    );
    executor.execute();
    if (executor.error) {
      return { error: executor.error };
    }
    return { results: [executor], error: null };
  }
}
