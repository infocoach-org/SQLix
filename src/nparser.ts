import { Data, Database } from "./database";
import { ExecutionError, ParseError, SqlBaseError, TokenError } from "./error";
import {
  Keyword,
  ListTokenSource,
  TokenLocation,
  TokenSource,
  TokenType,
  Tokenizer,
} from "./tokenizer";

/// new concept:

/// three modes for MultipleStatementRunner:

// 1. executing error found while parsing => no execution at all (discrimination between errors? runtime vs compile time?)

// 2. one executing error => rest of program does not run

// 3. does not matter if program gives execution error (no discrimination)

interface ResultSet {
  columnNames(): string[];
  getRow(): Data[];
  nextRow(): boolean;
}

export abstract class BaseSQLRunner<Config extends RunnerConfig> {
  private statementParserMap: {
    [T in Keyword]?: StatementConfig<any>;
  };

  constructor(protected config: Config, protected database: Database) {
    this.statementParserMap = {};
    for (const parser of config.statements) {
      this.statementParserMap[parser.begin] = parser;
    }
  }

  execute(sql: string):
    | { error: TokenError | ParseError }
    | {
        error: null;
        results: Iterable<StatementExecutionResult<any>>;
      } {
    const tokenizer = new Tokenizer(sql);
    const tokenError = tokenizer.tokenize();
    if (tokenError) return { error: tokenError };
    return this.run(new ListTokenSource(tokenizer.tokens));
  }

  getStatementConfig(
    token: TokenLocation & { type: TokenType.keyword }
  ): StatementConfig<any> {
    const statementConfig = this.statementParserMap[token.tokenId as Keyword];
    if (!statementConfig) {
      if (this.config.notAllowedStatements.includes(token.tokenId)) {
        throw new ParseError(
          `Statement ${(
            token.tokenId as Keyword
          ).toUpperCase()} not allowed, allowed statements: ${this.config.statements.map(
            (statement) => statement.begin
          )}`,
          token
        );
      }
      throw new ParseError(
        `no statement begins with the keyword ${token.tokenId}`,
        token
      );
    }
    return statementConfig;
  }

  protected abstract run(tokens: TokenSource):
    | {
        error: ParseError;
      }
    | {
        error: null;
        results: Iterable<StatementExecutionResult<any>>;
      };
}

export abstract class MultipleStatementSQLRunner extends BaseSQLRunner<RunnerConfig> {}

export interface RunnerConfig {
  readonly statements: StatementConfig<any>[];
  readonly notAllowedStatements: Keyword[];
}

export interface StatementConfig<T> {
  readonly name: string;
  readonly description: string;
  readonly begin: Keyword;
  readonly parser: StatementParserConstructor<T>;
  readonly executor: StatementExecutorConstructor<T>;
}

export interface StatementParserConstructor<T> {
  new (tokens: TokenSource): StatementParserType<T>;
}

export type StatementParserType<T> = StatementParser & {
  [Key in keyof T]: T[Key] | undefined;
};

export abstract class StatementParser {
  constructor(protected tokens: TokenSource) {}

  public abstract parse(): void;
}

export interface StatementExecutorConstructor<T> {
  new (
    database: Database,
    runnerConfig: RunnerConfig,
    finishedTokenSource: TokenSource,
    data: T,
    statementInformation: StatementConfig<StatementParserType<T>>,
    start: TokenLocation,
    end: TokenLocation
  ): StatementExecutor<T>;
}

export interface StatementExecutionResult<T> {
  // TODO: should be added?
  readonly database: Database;
  readonly runnerConfig: RunnerConfig;
  readonly error: ExecutionError | null;
  readonly informationStrings: string[] | [];
  readonly statementInformation: StatementConfig<StatementParserType<T>>;
  readonly result: ResultSet | null;
  readonly start: TokenLocation;
  readonly end: TokenLocation;
}

// soll extra klasse sein?
export abstract class StatementExecutor<T>
  implements StatementExecutionResult<T>
{
  public error: ExecutionError | null = null;
  public result: ResultSet | null = null;
  public informationStrings: string[] = [];

  constructor(
    public database: Database,
    public runnerConfig: RunnerConfig,
    public finishedTokenSource: TokenSource,
    public data: T,
    public statementInformation: StatementConfig<StatementParserType<T>>,
    public start: TokenLocation,
    public end: TokenLocation
  ) {}

  public abstract execute(): void;
}
