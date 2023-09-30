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
    [T in Keyword]?: StatementConfig<StatementData>;
  };

  constructor(
    protected database: Database,
    protected statementParsers: StatementConfig<StatementData>[]
  ) {
    this.statementParserMap = {};
    for (const parser of statementParsers) {
      this.statementParserMap[parser.begin] = parser;
    }
  }

  execute(sql: string):
    | { error: TokenError | ParseError }
    | {
        error: null;
        results: Iterable<StatementExecutionResult<StatementData>>;
      } {
    const tokenizer = new Tokenizer(sql);
    const tokenError = tokenizer.tokenize();
    if (tokenError) return { error: tokenError };
    return this.run(new ListTokenSource(tokenizer.tokens));
  }

  protected abstract run(tokens: TokenSource):
    | {
        error: ParseError;
      }
    | {
        error: null;
        results: Iterable<StatementExecutionResult<StatementData>>;
      };
}

export abstract class MultipleStatementSQLRunner extends BaseSQLRunner {}

export interface StatementConfig<T extends StatementData> {
  readonly name: string;
  readonly description: string;
  readonly begin: Keyword;
  readonly parser: StatementParserConstructor<T>;
  readonly executor: StatementExecutorConstructor<T>;
}

export type StatementData = Readonly<Record<string, NotUndefined<any>>>;

export type NotUndefined<T> = T extends undefined ? never : T;

export interface StatementParserConstructor<T extends StatementData> {
  new (tokens: TokenSource): StatementParserType<T>;
}

export type StatementParserType<T extends StatementData> = StatementParser & {
  [Key in keyof T]: T[Key] | undefined;
};

export abstract class StatementParser {
  constructor(protected tokens: TokenSource) {}

  public abstract parse(): void;
}

export interface StatementExecutorConstructor<T extends StatementData> {
  new (
    database: Database,
    finishedTokenSource: TokenSource,
    runnerConfig: StatementConfig<StatementParserType<StatementData>>[],
    data: T,
    statementInformation: StatementConfig<StatementParserType<T>>,
    start: TokenLocation,
    end: TokenLocation
  ): StatementExecutor<T>;
}

export interface StatementExecutionResult<T extends StatementData> {
  // TODO: should be added?
  readonly database: Database;
  readonly runnerConfig: StatementConfig<StatementParserType<StatementData>>[];
  readonly error: ExecutionError | null;
  readonly informationStrings: string[] | [];
  readonly statementInformation: StatementConfig<StatementParserType<T>>;
  readonly result: ResultSet | null;
  readonly start: TokenLocation;
  readonly end: TokenLocation;
}

// soll extra klasse sein?
export abstract class StatementExecutor<T extends StatementData>
  implements StatementExecutionResult<T>
{
  public error: ExecutionError | null = null;
  public result: ResultSet | null = null;
  public informationStrings: string[] = [];

  constructor(
    public database: Database,
    public finishedTokenSource: TokenSource,
    public runnerConfig: StatementConfig<StatementParserType<StatementData>>[],
    public data: T,
    public statementInformation: StatementConfig<StatementParserType<T>>,
    public start: TokenLocation,
    public end: TokenLocation
  ) {}

  public abstract execute(): void;
}
