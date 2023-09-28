import { Data, Database } from "./database";
import { ExecutionError, ParseError, SqlBaseError, TokenError } from "./error";
import {
  Keyword,
  ListTokenSource,
  TokenLocation,
  TokenSource,
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

export abstract class BaseSQLRunner {
  protected statementParserMap: {
    [T in Keyword]?: StatementConfig<StatementParser>;
  };

  constructor(
    protected database: Database,
    protected statementParsers: StatementConfig<StatementParser>[]
  ) {
    this.statementParserMap = {};
    for (const parser of statementParsers) {
      this.statementParserMap[parser.firstKeyword] = parser;
    }
  }

  execute(
    sql: string
  ):
    | { error: TokenError | ParseError }
    | { error: null; results: Iterable<StatementExecutionResult> } {
    const tokenizer = new Tokenizer(sql);
    const tokenError = tokenizer.tokenize();
    if (tokenError) return { error: tokenError };
    return this.run(new ListTokenSource(tokenizer.tokens));
  }

  protected abstract run(tokens: TokenSource):
    | {
        error: ParseError;
      }
    | { error: null; results: Iterable<StatementExecutionResult> };
}

export abstract class MultipleStatementSQLRunner extends BaseSQLRunner {}

export interface StatementConfig<T extends StatementParser> {
  readonly statementName: string;
  readonly statementDescription: string;
  readonly firstKeyword: Keyword;
  readonly parserConstructor: StatementParserConstructor<T>;
  readonly executorFactory: StatementExecutorFactory<T>;
}

export interface StatementParserConstructor<T extends StatementParser> {
  new (tokens: TokenSource, database: Database): T;
}

export interface StatementExecutorFactory<T extends StatementParser> {
  new (
    database: Database,
    runnerConfig: StatementConfig<StatementParser>[],
    parser: T,
    statementInformation: StatementConfig<StatementParser>,
    start: TokenLocation,
    end: TokenLocation
  ): StatementExecutor<T>;
}

export interface StatementExecutionResult {
  // TODO: should be added?
  readonly database: Database;
  readonly runnerConfig: StatementConfig<StatementParser>[];
  readonly error: ExecutionError | null;
  readonly informationStrings: string[] | [];
  readonly statementInformation: StatementConfig<StatementParser>;
  readonly result: ResultSet | null;
  readonly start: TokenLocation;
  readonly end: TokenLocation;
}

// soll extra klasse sein?
export abstract class StatementExecutor<T extends StatementParser>
  implements StatementExecutionResult
{
  public error: ExecutionError | null = null;
  public result: ResultSet | null = null;
  public informationStrings: string[] = [];

  constructor(
    public database: Database,
    public runnerConfig: StatementConfig<StatementParser>[],
    public parser: T,
    public statementInformation: StatementConfig<StatementParser>,
    public start: TokenLocation,
    public end: TokenLocation
  ) {}

  public abstract execute(): void;
}

export abstract class StatementParser {
  constructor(protected tokens: TokenSource, protected database: Database) {}

  public abstract parse(): void;
}
