import { TokenLocation, TokenType } from "./tokenizer";

export abstract class SqlBaseError extends Error {
  start: number;
  end: number;
  message: string;

  constructor(errorMessage: string, start: number, end?: number) {
    super();
    this.message = errorMessage;
    this.start = start;
    this.end = end ?? start;
  }
}

export enum TokenErrorType {
  characterNotUnderstood,
  notValidToken,
}

export class TokenError extends SqlBaseError {
  constructor(public information: TokenErrorInformation) {
    let message: string;
    let start: number;
    let end: number | undefined;
    if (information.type === TokenErrorType.characterNotUnderstood) {
      message = "character not understood";
      start = information.character;
    } else {
      message =
        information.customErrorString ??
        `token type ${information.tokenType} is wrong`;
      start = information.tokenBegin;
      end = information.tokenErrorCharacter;
    }
    super(message, start, end);
  }
}

export type TokenErrorInformation =
  | { type: TokenErrorType.characterNotUnderstood; character: number }
  | {
      type: TokenErrorType.notValidToken;
      tokenType: TokenType;
      tokenBegin: number;
      tokenErrorCharacter: number;
      customErrorString: string | null;
    };

export abstract class TokenBasedError extends SqlBaseError {
  constructor(
    errorMessage: string,
    private startToken: TokenLocation,
    private endToken?: TokenLocation
  ) {
    super(errorMessage, startToken.begin, endToken?.end ?? startToken.end);
  }
}

export class ParseError extends TokenBasedError {}

export class ExecutionError extends TokenBasedError {}
