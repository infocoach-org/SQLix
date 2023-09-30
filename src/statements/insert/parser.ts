// currently all columns that have been given,
// must be filled out, if no columns were given,

import { BaseStatementParser } from "../../base_statement_parser";
import { Data } from "../../database";
import { ParseError } from "../../error";
import { StatementParserType } from "../../nparser";
import { Keyword, TokenType } from "../../tokenizer";
import InsertData from "./data";

// all columns musst be filled out
export default class InsertParser
  extends BaseStatementParser
  implements StatementParserType<InsertData>
{
  tableName: string | undefined;
  rowsToInsert: Data[][] = [];
  columnsToInsert: string[] | null = null;

  public parse(): void {
    this.expectKeyword(Keyword.into);
    this.tableName = this.expectIdentifier("table name");

    if (this.tokens.read().type === TokenType.openParantheses) {
      this.tokens.consume();
      this.parseExplicitGivenColumns();
    }
    this.expectKeyword(Keyword.values);
    this.parseMoreThanOne(this.parseAndInsertValueRow);
  }

  private expectValue(): Data {
    const token = this.tokens.consume();
    switch (token.type) {
      case TokenType.string:
      case TokenType.number:
        return token.value;
      case TokenType.keyword:
        switch (token.tokenId) {
          case Keyword.null:
            return null;
          case Keyword.true:
            return true;
          case Keyword.false:
            return false;
        }
    }
    throw new ParseError(
      "constant value expected, such as a string, number, boolean or null",
      token
    );
  }

  private parseAndInsertValueRow() {
    this.expectType(TokenType.openParantheses);
    let row = [];
    let firstValue = true;
    while (this.tokens.read().type != TokenType.eof) {
      if (!firstValue) {
        if (this.tokens.read().type != TokenType.comma) {
          break;
        }
      } else {
        firstValue = false;
      }
      row.push(this.expectValue());
    }
    this.expectType(TokenType.closedParantheses);
    this.rowsToInsert.push(row);
  }

  private parseExplicitGivenColumns() {
    // TODO: replace parseMoreThanOne, as insert into a () also allowed
    this.columnsToInsert = [];
    this.parseMoreThanOne(() => {
      const columnName = this.expectIdentifier("column name");
      if (this.columnsToInsert!.some((column) => column === columnName)) {
        this.lastExpectedTokenError(
          `column ${columnName} cannot be inserted twice`
        );
      }
      this.columnsToInsert!.push(columnName);
    });
    this.expectType(TokenType.closedParantheses);
  }
}
