import { TokenLocation } from "./tokenizer";

export class ParseError {
  start: number;
  end: number;
  message: string;

  constructor(errorMessage: string, start: TokenLocation, end?: TokenLocation) {
    this.message = errorMessage;
    this.start = start.begin;
    this.end = end?.end ?? start.end;
  }
}
