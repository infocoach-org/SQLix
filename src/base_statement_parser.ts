import { ParseError } from "./error";
import { StatementParser } from "./nparser";
import { Keyword, TokenLocation, TokenType } from "./tokenizer";

export abstract class BaseStatementParser extends StatementParser {
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
        `expected^ keyword ${keyword.toUpperCase()}${
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
