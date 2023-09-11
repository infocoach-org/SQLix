export enum Keyword {
  create = "create",
  select = "select",
  table = "table",
  insert = "insert",
  into = "into",
  values = "values",
  primary = "primary",
  from = "from",
  foreign = "foreign",
  key = "key",
  references = "references",
  constraint = "constraint",
  inner = "inner",
  left = "left",
  right = "right",
  outer = "outer",
  join = "join",
  order = "order",
  where = "where",
  group = "group",
  by = "by",
  having = "having",
  null = "null",
  as = "as",
  auto = "auto",
  increment = "increment",
  is = "is",
  betweeen = "betweeen",
  and = "and",
  or = "or",
  in = "in",
  like = "like",
  not = "not",
  offset = "offset",
  limit = "limit",
  union = "union",
  asc = "asc",
  desc = "desc",
  true = "true",
  false = "false",
  default = "default",
}

export enum Operator {
  equal = "=",
  notEqual = "<>",
  greater = ">",
  greaterEqual = ">=",
  lesser = "<",
  lesserEqual = "<=",
  plus = "+",
  minus = "-",
  multiply = "*",
  divide = "/",
}

export enum TokenType {
  keyword = "keyword",
  operator = "operator",
  identifier = "identifier",
  number = "number",
  string = "string",
  dot = ".",
  openParantheses = "(",
  semicolon = ")",
  comma = ",",
  closedParantheses = ")",
  eof = "end of input",
}

// TODO: improve tokenId?
export type Token = { tokenId?: any } & (
  | { type: TokenType.keyword; tokenId: Keyword }
  | { type: TokenType.operator; tokenId: Operator }
  | { type: TokenType.identifier; identifier: string }
  | { type: TokenType.number; value: number; hasPoint: boolean }
  | { type: TokenType.string; value: string }
  | { type: TokenType.dot }
  | { type: TokenType.semicolon }
  | { type: TokenType.comma }
  | { type: TokenType.openParantheses }
  | { type: TokenType.closedParantheses }
  | { type: TokenType.eof }
);

export type TokenLocation = {
  type: TokenType;
  begin: number;
  end: number;
} & Token;

enum TokenStatus {
  valid,
  invalid,
  finished,
}

enum TokenErrorType {
  characterNotUnderstood,
  notValidToken,
}

export class TokenError {
  constructor(public information: TokenErrorInformation) {}
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

abstract class TokenGenerator {
  public status: TokenStatus = TokenStatus.valid;
  public abstract type: TokenType | null;

  abstract reset(): void;

  abstract feed(char: string | null): void;

  /// begin inclusive, end exclusive
  abstract createToken(text: string, begin: number, end: number): Token | null;

  checkFinishedToken(text: string, begin: number, end: number): boolean {
    return true;
  }

  public abstract useForError: boolean;
  abstract createErrorMessage(): string | null;
}

class WhitespaceTokenGenerator extends TokenGenerator {
  public type = null;
  private wasWhitespace = false;
  reset(): void {
    this.wasWhitespace = false;
  }

  feed(char: string | null): void {
    const isWhitespace =
      char === " " || char === "\n" || char === "\t" || char === "\r";

    if (this.wasWhitespace) {
      if (!isWhitespace) {
        this.status = TokenStatus.finished;
      }
    } else {
      if (isWhitespace) {
        this.wasWhitespace = true;
      } else {
        this.status = TokenStatus.invalid;
      }
    }
  }

  createToken(): TokenLocation | null {
    return null;
  }

  public useForError = false;

  createErrorMessage(): string | null {
    return null;
  }
}

class SingleCharTokenGenerator extends TokenGenerator {
  constructor(public type: TokenType, public char: string) {
    super();
  }

  private hasChar = false;
  reset(): void {
    this.hasChar = false;
  }
  feed(char: string | null): void {
    if (this.hasChar) {
      this.status = TokenStatus.finished;
    } else if (char == this.char) {
      this.hasChar = true;
    } else {
      this.status = TokenStatus.invalid;
    }
  }

  createToken(_text: string, _begin: number, _end: number): Token | null {
    return { type: this.type, tokenId: this.type } as Token;
  }

  public useForError = false;

  createErrorMessage(): string | null {
    throw new Error("Method not implemented.");
  }
}

class OperatorTokenGenerator extends TokenGenerator {
  public type = TokenType.operator;
  private inOperator = false;
  operator: Operator | undefined;
  static operatorCharacters: (string | null)[] = [
    "+",
    "-",
    "*",
    "/",
    "=",
    "<",
    ">",
    "&",
    "%",
    "$",
    "?",
  ];
  reset(): void {
    this.inOperator = false;
  }
  feed(char: string | null): void {
    if (OperatorTokenGenerator.operatorCharacters.includes(char)) {
      this.inOperator = true;
    } else if (this.inOperator) {
      this.status = TokenStatus.finished;
    } else {
      this.status = TokenStatus.invalid;
    }
  }
  createToken(): Token | null {
    return { type: TokenType.operator, tokenId: this.operator! };
  }

  checkFinishedToken(text: string, begin: number, end: number): boolean {
    const operatorStringCandidate = text.substring(begin, end);
    for (const operator in Operator) {
      const operatorString = (Operator as any)[operator];
      if (operatorStringCandidate === operatorString) {
        this.operator = operator as Operator;
        return true;
      }
    }
    return false;
  }

  public useForError = true;

  createErrorMessage(): string | null {
    if (this.inOperator) return "is not a valid operato";
    return null;
  }
}

class KeywordTokenGenerator extends TokenGenerator {
  public type = TokenType.keyword;
  private inKeyword = false;
  keyword: Keyword | undefined;

  reset(): void {
    this.inKeyword = false;
  }

  feed(char: string | null): void {
    if (
      char !== null &&
      char.charCodeAt(0) >= 97 &&
      char.charCodeAt(0) <= 122
    ) {
      this.inKeyword = true;
    } else if (this.inKeyword) {
      this.status = TokenStatus.finished;
    } else {
      this.status = TokenStatus.invalid;
    }
  }

  createToken(): Token | null {
    return { type: TokenType.keyword, tokenId: this.keyword! };
  }

  checkFinishedToken(text: string, begin: number, end: number): boolean {
    const operatorStringCandidate = text.substring(begin, end);
    for (const keyword in Keyword) {
      const keywordString = (Keyword as any)[keyword];
      if (operatorStringCandidate === keywordString) {
        this.keyword = keyword as Keyword;
        return true;
      }
    }
    return false;
  }

  public useForError = false;

  createErrorMessage(): string | null {
    return null;
  }
}

class IdentifierTokenGenerator extends TokenGenerator {
  public type = TokenType.identifier;
  private startingKey: '"' | "`" | "" | null = null;
  keyword: Keyword | undefined;
  startsWrong: boolean = false;
  nothingAfterQuote: boolean = false;
  endingQuoteExpected: boolean = false;
  firstChar: boolean = true;
  finished = false;

  get hasProblem(): boolean {
    return (
      this.startsWrong || this.nothingAfterQuote || this.endingQuoteExpected
    );
  }

  reset(): void {
    this.startsWrong = false;
    this.startingKey = null;
    this.firstChar = true;
    this.endingQuoteExpected = false;
    this.nothingAfterQuote = false;
    this.finished = false;
  }

  private validChar(char: string | null, onlyNonFirst: boolean): boolean {
    if (char === null) return false;
    const nonFirst =
      (char.charCodeAt(0) >= 48 && char.charCodeAt(0) <= 57) ||
      char === "-" ||
      char === "_";
    if (onlyNonFirst) return nonFirst;
    return nonFirst || (char.charCodeAt(0) >= 97 && char.charCodeAt(0) <= 122);
  }

  feed(char: string | null): void {
    if (this.finished) {
      this.status = this.hasProblem
        ? TokenStatus.invalid
        : TokenStatus.finished;
      return;
    }
    if (this.startingKey === null) {
      if (char === "`" || char === '"') {
        this.startingKey = char;
        return;
      } else {
        this.startingKey = "";
      }
    }
    if (this.firstChar) {
      if (this.validChar(char, false)) {
        if (this.validChar(char, true)) {
          this.startsWrong = true;
        }
      } else {
        this.nothingAfterQuote = this.startingKey !== "";
        this.status = TokenStatus.invalid;
      }
    } else if (!this.validChar(char, false)) {
      if (this.startingKey === "") {
        this.status = this.hasProblem
          ? TokenStatus.invalid
          : TokenStatus.finished;
      } else if (char === this.startingKey) {
        this.finished = true;
      } else {
        this.endingQuoteExpected = true;
      }
    }
    this.firstChar = false;
  }

  createToken(text: string, begin: number, end: number): Token | null {
    if (this.startingKey !== "") {
      begin++;
      end--;
    }
    return {
      type: TokenType.identifier,
      identifier: text.substring(begin, end),
    };
  }

  public useForError = true;

  createErrorMessage(): string | null {
    if (this.startsWrong) return "identifier should start with a letter";
    if (this.nothingAfterQuote)
      return `after a ${this.startingKey} an identifier is expected`;
    if (this.endingQuoteExpected)
      return `ending quote ${this.startingKey} expected`;
    return null;
  }
}

class StringTokenGenerator extends TokenGenerator {
  public type = TokenType.string;
  private hasQuote = false;
  private finished = false;
  private lastCharacterWasBackslash = false;
  private value = ""; // could be optimised
  reset(): void {
    this.hasQuote = false;
    this.finished = false;
    this.lastCharacterWasBackslash = false;
    this.value = "";
  }
  feed(char: string | null): void {
    if (this.finished) {
      this.status = TokenStatus.finished;
      return;
    }
    if (!this.hasQuote) {
      if (char !== "'") {
        this.status = TokenStatus.invalid;
      } else {
        this.hasQuote = true;
      }
    } else if (this.lastCharacterWasBackslash) {
      this.value += char === "n" ? "\n" : char;
      this.lastCharacterWasBackslash = false;
    } else if (char === "'") {
      this.finished = true;
    } else {
      this.value += char;
    }
  }
  createToken(): Token | null {
    return { type: TokenType.string, value: this.value };
  }
  public useForError = true;
  createErrorMessage(): string | null {
    if (this.hasQuote) {
      return "expected string to be closed by a single quote (')";
    }
    return null;
  }
}

enum NumericTokenGeneratorStatus {
  beforeToken,
  beforeDot,
  onDot,
  afterDot,
}

/// under identifier
class NumericTokenGenerator extends TokenGenerator {
  public type = TokenType.number;
  private genStatus = NumericTokenGeneratorStatus.beforeToken;

  private numericChar(char: string | null): boolean {
    return (
      char !== null && char.charCodeAt(0) >= 48 && char.charCodeAt(0) <= 57
    );
  }

  reset(): void {
    this.genStatus = NumericTokenGeneratorStatus.beforeToken;
  }

  feed(char: string | null): void {
    switch (this.genStatus) {
      case NumericTokenGeneratorStatus.beforeToken:
        if (char === "-" || this.numericChar(char)) {
          this.genStatus = NumericTokenGeneratorStatus.beforeDot;
        } else {
          this.status = TokenStatus.invalid;
        }
        break;
      case NumericTokenGeneratorStatus.beforeDot:
        if (char === ".") {
          this.genStatus = NumericTokenGeneratorStatus.onDot;
        } else if (!this.numericChar(char)) {
          this.status = TokenStatus.finished;
        }
        break;
      case NumericTokenGeneratorStatus.onDot:
        if (!this.numericChar(char)) {
          this.status = TokenStatus.invalid;
        } else {
          this.genStatus = NumericTokenGeneratorStatus.afterDot;
        }
        break;
      case NumericTokenGeneratorStatus.afterDot:
        if (!this.numericChar(char)) {
          this.status = TokenStatus.finished;
        }
        break;
    }
  }
  createToken(text: string, begin: number, end: number): Token | null {
    const value = Number.parseFloat(text.substring(begin, end));
    return {
      type: TokenType.number,
      value,
      hasPoint: this.genStatus !== NumericTokenGeneratorStatus.beforeDot,
    };
  }
  public useForError = true;

  createErrorMessage(): string | null {
    if (this.genStatus === NumericTokenGeneratorStatus.onDot) {
      return "At least one decimal place expected after the point";
    }
    return null;
  }
}

export class Tokenizer {
  private lowercaseText: string;
  private generators: TokenGenerator[] = [
    new WhitespaceTokenGenerator(),
    new OperatorTokenGenerator(),
    new KeywordTokenGenerator(),
    new IdentifierTokenGenerator(),
    new NumericTokenGenerator(),
    new StringTokenGenerator(),
    new SingleCharTokenGenerator(TokenType.dot, "."),
    new SingleCharTokenGenerator(TokenType.comma, ","),
    new SingleCharTokenGenerator(TokenType.semicolon, ";"),
    new SingleCharTokenGenerator(TokenType.openParantheses, "("),
    new SingleCharTokenGenerator(TokenType.closedParantheses, ")"),
  ];
  public tokens: TokenLocation[] = [];
  private tokenBegin = 0;
  private charIndex = 0;
  private char = "";
  private lastValidGenerator: TokenGenerator | null = null;
  private validGenerator: TokenGenerator | null = null;
  private validErrorGenerator: TokenGenerator | null = null;
  private finishedGenerator: TokenGenerator | null = null;

  constructor(text: string) {
    this.lowercaseText = text.toLowerCase();
  }

  private feedGeneratorChar(generator: TokenGenerator): void {
    if (generator.status === TokenStatus.valid) {
      generator.feed(this.char);
      switch (generator.status as TokenStatus) {
        case TokenStatus.valid:
          this.validGenerator ??= generator;
          if (generator.useForError) {
            this.validErrorGenerator ??= generator;
          }
          break;
        case TokenStatus.finished:
          if (
            generator.checkFinishedToken(
              this.lowercaseText,
              this.tokenBegin,
              this.charIndex
            )
          ) {
            this.finishedGenerator ??= generator;
          }
          break;
      }
    }
  }

  private createError(): TokenError | null {
    if (this.lastValidGenerator?.useForError) {
      const message = this.lastValidGenerator?.createErrorMessage();
      return new TokenError({
        type: TokenErrorType.notValidToken,
        tokenBegin: this.tokenBegin,
        tokenErrorCharacter: this.charIndex,
        tokenType: this.lastValidGenerator.type!,
        customErrorString: message,
      });
    } else {
      return new TokenError({
        type: TokenErrorType.characterNotUnderstood,
        character: this.charIndex,
      });
    }
  }

  private addFinishedToken(): void {
    const token = this.finishedGenerator!.createToken(
      this.lowercaseText,
      this.tokenBegin,
      this.charIndex
    );
    if (token) {
      const tokenLocation = {
        ...token,
        begin: this.tokenBegin,
        end: this.charIndex,
      };
      this.tokens.push(tokenLocation);
    }
  }

  private resetGenerators(): void {
    for (const generator of this.generators) {
      generator.reset();
      generator.status = TokenStatus.valid;
    }
  }

  tokenize(): TokenError | null {
    for (
      this.charIndex = 0;
      this.charIndex <= this.lowercaseText.length;
      this.charIndex++
    ) {
      this.validGenerator = null;
      this.validErrorGenerator = null;
      this.finishedGenerator = null;
      this.char = this.lowercaseText[this.charIndex] ?? null; // for final character (represents EOF)
      for (let generator of this.generators) {
        this.feedGeneratorChar(generator);
      }
      addToken: if (this.finishedGenerator) {
        if (this.validGenerator) {
          const validGeneratorHasPriority =
            this.generators.indexOf(this.validGenerator) >
            this.generators.indexOf(this.finishedGenerator);
          if (validGeneratorHasPriority) break addToken;
        }
        this.addFinishedToken();
        this.tokenBegin = this.charIndex;
        if (this.char !== null) {
          this.charIndex--;
        }
        this.resetGenerators();
      } else if (!this.validGenerator) {
        return this.createError();
      }
      this.lastValidGenerator = this.validErrorGenerator ?? this.validGenerator;
    }
    this.tokens.push({
      type: TokenType.eof,
      begin: this.charIndex,
      end: this.charIndex + 1,
    });
    return null;
  }
}
