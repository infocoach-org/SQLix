import { TableCreate, TableInserter } from "../src/create";
import { Database } from "../src/database";
import { ParseError } from "../src/parse_error";
import { Tokenizer } from "../src/tokenizer";

// const text = `SELECT a.b

// ' as

// '
// `;
// const tokenizer = new Tokenizer(text);

// console.log(tokenizer.tokenize());

// console.log(tokenizer.tokens);

// while (true) {}

const database = new Database();

const inserter = new TableInserter(database);

const createTable = new TableCreate(inserter);

const text = `
CREATE TABLE a (
  a int not null,
  b int not null,
  abcdefghijklmnop boolean,
  asdfasdfadsfa boolean,
  primary key (a,b)
);
`;

const tokenizer = new Tokenizer(text);
const error = tokenizer.tokenize();
if (error) console.log();

const tokens = tokenizer.tokens;
try {
  createTable.parse(tokens, 1);
  inserter.insertTables();
} catch (e) {
  if (e instanceof ParseError) {
    console.error(e.message);
  } else {
    console.error(e);
  }
}
database.printTableSchema("a");

while (true) {}
