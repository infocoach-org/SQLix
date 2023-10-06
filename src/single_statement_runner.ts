import { Database } from "./database";
import { ExecutionError, ParseError } from "./error";
import {
  BaseSQLRunner,
  RunnerConfig,
  StatementExecutionResult,
} from "./nparser";
import { Keyword, TokenSource, TokenType } from "./tokenizer";

interface SingleStatementSQLRunnerConfig extends RunnerConfig {
  // default false
  atLeastOneStatement?: boolean;
}

export class SingleStatementSQLRunner extends BaseSQLRunner<SingleStatementSQLRunnerConfig> {
  constructor(config: SingleStatementSQLRunnerConfig, database: Database) {
    config.atLeastOneStatement ??= false;
    super(config, database);
    this.config = config as SingleStatementSQLRunnerConfig;
  }

  protected run(tokens: TokenSource):
    | {
        error: ParseError;
      }
    | {
        error: null;
        results: Iterable<StatementExecutionResult<any>>;
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
    const statementConfig = this.getStatementConfig(startToken);

    const statementParser = new statementConfig.parser(tokens);
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
          `${statementConfig.name.toUpperCase()} statement is already finished, unexpected token`,
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
    const executor = new statementConfig.executor(
      this.database,
      this.config,
      tokens,
      statementParser,
      statementConfig as any,
      startToken,
      endToken
    );
    try {
      executor.execute();
    } catch (e) {
      // for multiple statements give option to instantly stop and give back error, or give all results back
      if (e instanceof ExecutionError) {
        return {
          error: e,
        };
      } else {
        throw e;
      }
    }
    return { results: [executor], error: null };
  }
}
