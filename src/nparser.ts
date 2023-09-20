import { Data, DataType, Database } from "./database";
import { SqlBaseError } from "./error";
import { ParseError } from "./parse_error";
import {
  Keyword,
  TokenError,
  TokenLocation,
  TokenType,
  Tokenizer,
} from "./tokenizer";

/// new concept:

/// three modes for MultipleStatementRunner:

// 1. executing error found while parsing => no execution at all (discrimination between errors? runtime vs compile time?)

// 2. one executing error => rest of program does not run

// 3. does not matter if program gives execution error (no discrimination)

interface TokenSource {
  consume(): TokenLocation;
  read(): TokenLocation;
  peek(): TokenLocation;
  // errorOnCurrentToken(message: string): void; kommt in StatementParser
}

class ListTokenSource implements TokenSource {
  private tokenIndex = 0;

  constructor(private tokens: TokenLocation[]) {}

  consume(): TokenLocation {
    return this.tokens[this.tokenIndex++];
  }
  read(): TokenLocation {
    return this.tokens[this.tokenIndex];
  }
  peek(): TokenLocation {
    return this.tokens[this.tokenIndex + 1];
  }

  // errorOnCurrentToken(message: string): void {
  // throw new Error("Method not implemented.");
  // }
}

interface ResultSet {
  columnNames(): string[];
  getRow(): Data[];
  nextRow(): boolean;
}

export abstract class BaseSQLRunner {
  protected statementParserMap: {
    [T in Keyword]?: StatementConfig<StatementHandler>;
  };

  constructor(
    protected database: Database,
    statementParsers: StatementConfig<StatementHandler>[]
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

  protected abstract run(
    tokens: TokenSource
  ):
    | { isError: true; error: ParseError }
    | { isError: false; result: OutputRecorder };
}

export class SingleStatementSQLRunner extends BaseSQLRunner {
  protected run(
    tokens: TokenSource
  ):
    | { isError: true; error: ParseError }
    | { isError: false; result: OutputRecorder } {
    while (tokens.read().type === TokenType.semicolon) {
      tokens.consume();
    }
    const token = tokens.consume();
    if (token.type !== TokenType.keyword) {
      return {
        isError: true,
        error: new ParseError("statement has to begin with a keyword", token),
      };
    }
    const keyword = token.tokenId as Keyword;
    if (!(keyword in this.statementParserMap)) {
      return {
        isError: true,
        error: new ParseError(
          `no statement begins with the keyword ${keyword}`,
          token
        ),
      };
    }
    const outputRecorder = new TestOutputRecorder();
    const statmentParserManager = this.statementParserMap[keyword]!;
    let statmentParser: StatementHandler;
    let contextState: StatementContextState | undefined;
    if (statmentParserManager.requiredStatementState !== null) {
      contextState = new statmentParserManager.requiredStatementState(
        this.database,
        outputRecorder
      );
      statmentParser = new (
        statmentParserManager as StatementConfig<StatementContextState>
      ).parser(tokens, this.database, contextState, outputRecorder);
    } else {
      statmentParser = new (
        statmentParserManager as StatementConfig<null>
      ).parser(tokens, this.database, outputRecorder);
    }
    try {
      statmentParser.parse(); // TokenSource musst be on eof or semicolon, no other statement allowed
      if (
        tokens.read().type !== TokenType.semicolon &&
        tokens.read().type !== TokenType.eof
      ) {
        return {
          isError: true,
          error: new ParseError(
            `${statmentParserManager.statementName.toUpperCase()} statement is already finished`,
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
          isError: true,
          error: new ParseError("only one statement allowed", tokens.read()),
        };
      }
      contextState?.execute();
      return {
        isError: false,
        result: outputRecorder,
      };
    } catch (e) {
      if (e instanceof ParseError) {
        return {
          isError: true,
          error: e,
        };
      } else {
        throw e;
      }
    }
  }
}

export abstract class MultipleStatementSQLRunner extends BaseSQLRunner {}

export abstract class StatementConfig<T extends StatementHandler> {
  public abstract statementName: string;
  public abstract statementDescription: string;
  public abstract firstKeyword: Keyword;
  public abstract handlerConstructor: StatementHandlerConstructor<T>;
}

export interface StatementHandlerConstructor<T extends StatementHandler> {
  new (tokens: TokenSource, database: Database): T;
}

// soll extra klasse sein?
export interface StatementExecutor {
  execute(): SqlBaseError;
  statement: StatementConfig<StatementHandler>;
  start: TokenLocation;
  end: TokenLocation;
}

export type ExecutionResult = { error: null | ExecutionError };

export abstract class StatementHandler {
  constructor(protected tokens: TokenSource, protected database: Database) {}

  public abstract parse(): void;

  public abstract execute(): void; // should return error / meers/ sasdx^
}

export const typeMapping: Record<string, DataType | undefined> = {
  int: DataType.int,
  integer: DataType.int,
  float: DataType.float,
  real: DataType.float,
  number: DataType.float,
  text: DataType.text,
  varchar: DataType.text,
  boolean: DataType.boolean,
};
