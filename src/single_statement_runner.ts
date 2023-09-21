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
