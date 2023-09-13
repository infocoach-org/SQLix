import { Data, DataType, Database } from "./database";
import { ParseError } from "./parse_error";
import {
  Keyword,
  Token,
  TokenError,
  TokenLocation,
  TokenType,
  Tokenizer,
} from "./tokenizer";

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

interface OutputRecorder {
  addComment(message: string): void;
  addError(message: string, beginToken?: Token, endToken?: Token): void;
  setResult(result: ResultSet): void;
}

interface OutputError {
  message: string;
  beginToken: TokenLocation;
  endToken: TokenLocation;
}

interface OutputReplay {
  getStatement(): {
    manager: StatementParserManager<any>;
    beginToken: TokenLocation;
    endToken: TokenLocation;
    comments: string[];
    error: null | OutputError;
    result: null | ResultSet;
  };
  nextStatement(): boolean;
}

export abstract class BaseStatementExecutor {
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

export class SingleStatementExecutor extends BaseStatementExecutor {
  protected parseAndExecute(
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

export abstract class StatementExecutor extends BaseStatementExecutor {}

export abstract class StatementContextState {
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

export abstract class StatementParserManager<
  T extends StatementContextState | null
> {
  public abstract statementName: string;
  public abstract statementDescription: string;
  public abstract firstKeyword: Keyword;
  public abstract requiredStatementState: T extends StatementContextState
    ? StatementContextStateConstructor<T>
    : null;
  public abstract parser: T extends StatementContextState
    ? ContextStatementParserConstructor<T>
    : StatementParserConstructor;
}

export abstract class StatementParser {
  constructor(
    protected tokens: TokenSource,
    protected database: Database,
    protected outputRecorder: OutputRecorder
  ) {}

  public abstract parseAndExecute(): void;

  private _lastExpectedToken: TokenLocation | undefined;

  protected get lastExpectedToken(): TokenLocation {
    return this._lastExpectedToken!;
  }

  protected currentTokenError(message: string): never {
    throw new ParseError(message, this.tokens.read());
  }

  protected lastExpectedTokenError(message: string): never {
    throw new ParseError(message, this.lastExpectedToken!);
  }

  protected expectType(
    type: TokenType,
    afterErrorMessage?: string | undefined,
    error?: string | undefined
  ): TokenLocation {
    this._lastExpectedToken = this.tokens.read();
    if (this._lastExpectedToken.type !== type) {
      throw error ?? `${type} expected` + (afterErrorMessage ?? "");
    }
    return this.tokens.consume();
  }
  protected expectKeyword(
    keyword: Keyword,
    afterErrorMessage?: string | undefined,
    error?: string | undefined
  ): TokenLocation {
    this._lastExpectedToken = this.tokens.consume();
    if (this._lastExpectedToken.tokenId !== keyword) {
      throw (
        error ??
        `expected keyword ${keyword.toUpperCase()}${
          afterErrorMessage ? " " + afterErrorMessage : ""
        }`
      );
    }
    return this._lastExpectedToken;
  }

  protected expectIdentifier(identifierName: string): string {
    this._lastExpectedToken = this.tokens.consume();
    if (this._lastExpectedToken.type !== TokenType.identifier) {
      throw `expected ${identifierName}${
        this._lastExpectedToken.type === TokenType.keyword
          ? `, keyword ${this._lastExpectedToken.tokenId} cannot be used as a identifier`
          : ""
      }`;
    }
    return this._lastExpectedToken.identifier;
  }

  protected parseMoreThanOne(parseFunction: () => void): void {
    parseFunction = parseFunction.bind(this);
    parseFunction();
    while (this.tokens.read().type === TokenType.comma) {
      this.tokens.consume();
      parseFunction();
    }
  }

  protected parseIdentifierList(identifierName: string): string[] {
    const arr = [this.expectIdentifier(identifierName)];
    while (this.tokens.read().type === TokenType.comma) {
      this.tokens.consume();
      const identifier = this.expectIdentifier(identifierName);
      if (arr.includes(identifier)) {
        throw `already mentioned ${identifierName} ${identifier}`;
      }
      arr.push(identifier);
    }
    return arr;
  }
}

export abstract class ContextStatementParser<
  T extends StatementContextState
> extends StatementParser {
  constructor(
    tokens: TokenSource,
    database: Database,
    outputRecorder: OutputRecorder,
    protected context: T
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
