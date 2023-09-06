import { DataType, Database } from "./database";
import { Keyword, TokenLocation } from "./tokenizer";

interface TokenSource {
  consumeToken(): TokenLocation;
  readToken(): TokenLocation;
  errorOnCurrentToken(message: string): void;
}

abstract class BaseStatementExecutor {
  constructor(protected statementParsers: StatementParserConstructor) {}

  execute(sql: string) {}

  protected abstract executeFromTokens(tokens: TokenSource) {
    if(tokens.)
  }
}

class SingleStatementExecutor extends BaseStatementExecutor {}

class StatementExecutor extends BaseStatementExecutor {}

abstract class StatementContextState {
  // insert and create have to use same context (as create can depend on eachother, but insert has to be after table)
}

interface StatementContextStateConstructor<T extends StatementContextState> {
  new (database: Database): StatementContextState;
}

abstract class StatementParserManager<T extends StatementContextState | null> {
  public abstract firstKeyword: Keyword;
  public abstract requiredStatementState: T extends StatementContextState
    ? StatementContextStateConstructor<T>
    : null;
  public abstract parser: T extends StatementContextState
    ? ContextStatementParserConstructor<T>
    : StatementParserConstructor;
}

abstract class StatementParser {
  constructor(private tokens: TokenSource) {}
}

abstract class ContextStatementParser<
  T extends StatementContextState
> extends StatementParser {
  constructor(tokens: TokenSource, private context: T) {
    super(tokens);
  }
}

interface StatementParserConstructor {
  new (tokens: TokenSource): StatementParser;
}

interface ContextStatementParserConstructor<T extends StatementContextState> {
  new (
    tokens: TokenSource,
    contextState: StatementContextState
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
