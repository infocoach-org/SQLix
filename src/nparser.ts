import { DataType, Database } from "./database";
import { ParseError } from "./parse_error";
import {
  Keyword,
  TokenError,
  TokenLocation,
  TokenType,
  Tokenizer,
} from "./tokenizer";

interface TokenSource {
  consumeToken(): TokenLocation;
  readToken(): TokenLocation;
  peekToken(): TokenLocation;
  // errorOnCurrentToken(message: string): void; kommt in StatementParser
}

class ListTokenSource implements TokenSource {
  private tokenIndex = 0;

  constructor(private tokens: TokenLocation[]) {}

  consumeToken(): TokenLocation {
    return this.tokens[this.tokenIndex++];
  }
  readToken(): TokenLocation {
    return this.tokens[this.tokenIndex];
  }
  peekToken(): TokenLocation {
    return this.tokens[this.tokenIndex + 1];
  }

  // errorOnCurrentToken(message: string): void {
  // throw new Error("Method not implemented.");
  // }
}

interface ResultSet {
  columnNames(): string[];
  rowAvailable(): boolean;
  nextRow(): DataType[];
}

abstract class OutputRecorder {
  // public abstract outputAvailable(): boolean;
  // public abstract writeError(): void;
}

class TestOutputRecorder extends OutputRecorder {
  // public writeError(): void {
  // throw new Error("Method not implemented.");
  // }
  // public outputAvailable(): boolean {
  // return true;
  // }
}

abstract class BaseStatementExecutor {
  protected statementParserMap: {
    [T in Keyword]?: StatementParserManager<null | StatementContextState>;
  } /*Record<
    Keyword,
    StatementParserManager<null | StatementContextState>
  >*/;
  constructor(
    protected database: Database,
    statementParsers: StatementParserManager<null | StatementContextState>[]
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
    const res = this.parseAndExecute(new ListTokenSource(tokenizer.tokens));
    return res;
  }

  protected abstract parseAndExecute(
    tokens: TokenSource
  ):
    | { isError: true; error: ParseError }
    | { isError: false; result: OutputRecorder };
}

class SingleStatementExecutor extends BaseStatementExecutor {
  protected parseAndExecute(
    tokens: TokenSource
  ):
    | { isError: true; error: ParseError }
    | { isError: false; result: OutputRecorder } {
    while (tokens.readToken().type === TokenType.semicolon) {
      tokens.consumeToken();
    }
    const token = tokens.consumeToken();
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
    let statmentParser: StatementParser;
    let contextState: StatementContextState | undefined;
    if (statmentParserManager.requiredStatementState !== null) {
      contextState = new statmentParserManager.requiredStatementState(
        this.database,
        outputRecorder
      );
      statmentParser = new (
        statmentParserManager as StatementParserManager<StatementContextState>
      ).parser(tokens, this.database, contextState, outputRecorder);
    } else {
      statmentParser = new (
        statmentParserManager as StatementParserManager<null>
      ).parser(tokens, this.database, outputRecorder);
    }
    try {
      statmentParser.parseAndExecute(); // TokenSource musst be on eof or semicolon, no other statement allowed
      if (
        tokens.readToken().type !== TokenType.semicolon &&
        tokens.readToken().type !== TokenType.eof
      ) {
        return {
          isError: true,
          error: new ParseError(
            `${statmentParserManager.statementName.toUpperCase()} statement is already finished`,
            tokens.readToken()
          ),
        };
      }
      tokens.consumeToken();
      while (tokens.readToken().type === TokenType.semicolon) {
        tokens.consumeToken();
      }
      if (tokens.readToken().type !== TokenType.eof) {
        return {
          isError: true,
          error: new ParseError(
            "only one statement allowed",
            tokens.readToken()
          ),
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

abstract class StatementExecutor extends BaseStatementExecutor {}

abstract class StatementContextState {
  // insert and create have to use same context (as create can depend on eachother, but insert has to be after table)
  constructor(
    protected database: Database,
    protected outputRecorder: OutputRecorder
  ) {}

  public abstract execute(): void;
}

interface StatementContextStateConstructor<T extends StatementContextState> {
  new (
    database: Database,
    outputRecorder: OutputRecorder
  ): StatementContextState;
}

abstract class StatementParserManager<T extends StatementContextState | null> {
  public abstract statementName: string;
  public abstract firstKeyword: Keyword;
  public abstract requiredStatementState: T extends StatementContextState
    ? StatementContextStateConstructor<T>
    : null;
  public abstract parser: T extends StatementContextState
    ? ContextStatementParserConstructor<T>
    : StatementParserConstructor;
}

abstract class StatementParser {
  constructor(
    private tokens: TokenSource,
    private database: Database,
    private outputRecorder: OutputRecorder
  ) {}

  public abstract parseAndExecute(): void;
}

abstract class ContextStatementParser<
  T extends StatementContextState
> extends StatementParser {
  constructor(
    tokens: TokenSource,
    database: Database,
    outputRecorder: OutputRecorder,
    private context: T
  ) {
    super(tokens, database, outputRecorder);
  }
}

interface StatementParserConstructor {
  new (
    tokens: TokenSource,
    database: Database,
    outputRecorder: OutputRecorder
  ): StatementParser;
}

interface ContextStatementParserConstructor<T extends StatementContextState> {
  new (
    tokens: TokenSource,
    database: Database,
    contextState: StatementContextState,
    outputRecorder: OutputRecorder
  ): ContextStatementParser<T>;
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
