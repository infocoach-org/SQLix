import { Data, DataType, Database } from "./database";
import { ExecutionError, ParseError, SqlBaseError } from "./error";
import { Keyword, TokenLocation, TokenSource, TokenType, Tokenizer } from "./tokenizer";

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
    private statementParsers: StatementConfig<StatementParser>[]
  ) {
    this.statementParserMap = {};
    for (const parser of statementParsers) {
      this.statementParserMap[parser.firstKeyword] = parser;
    }
  }

  execute(
    sql: string
  ):
    | { isError: true; error: TokenError | ParseError }
    | { isError: false; result: OutputRecorder } {
    const tokenizer = new Tokenizer(sql);
    const tokenError = tokenizer.tokenize();
    if (tokenError) return { isError: true, error: tokenError };
    const res = this.run(new ListTokenSource(tokenizer.tokens));
    return res;
  }

  protected abstract run(tokens: TokenSource): {
    error: ParseError

  } | {error: null | };
}

export abstract class MultipleStatementSQLRunner extends BaseSQLRunner {}

export abstract class StatementConfig<T extends StatementParser> {
  public abstract statementName: string;
  public abstract statementDescription: string;
  public abstract firstKeyword: Keyword;
  public abstract parserFactory: StatementParserFactory<T>;
  public abstract executorFactory: StatementExecutorFactory<T>;
}

export type StatementParserFactory<T extends StatementParser> = 
  (tokens: TokenSource, database: Database) => T;


export type StatementExecutorFactory<T extends StatementParser> =
  (database: Database, ) => StatementExecutor<T>;

// soll extra klasse sein?
export abstract class StatementExecutor<T extends StatementParser> {
  public abstract execute(): void;
  public error: ExecutionError | null = null
  public informationStrings: string[] | []
  public statement: StatementConfig<StatementParser>;
  public start: TokenLocation;
  public end: TokenLocation;
}

export abstract class StatementParser {
  constructor(protected tokens: TokenSource, protected database: Database) {}

  public abstract parse(): void;

  public abstract execute(): void; // should return error / meers/ sasdx^
}
