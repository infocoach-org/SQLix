import { Database } from "../src/database";
import { SingleStatementExecutor } from "../src/nparser";
import { ParseError } from "../src/parse_error";
import { CreateParserManager } from "../src/statements/create";

const database = new Database();

const parsers = [new CreateParserManager()];

const executor = new SingleStatementExecutor(database, parsers);

function exe(text: string) {
  const res = executor.execute(text);
  console.log("\n\n" + text);
  if (res.isError) {
    if (res.error instanceof ParseError) {
      console.log(text.substring(res.error.start, res.error.end));
      console.error(res.error.message);
    } else {
      console.error(res);
    }
  } else {
    database.printAllTableSchemas();
  }
}

exe(
  `
CREATE TABLE a (
  a int not null,
  b int not null,
  abcdefghijklmnop boolean,
  asdfasdfadsfa boolean,
  primary key (a, b)
);
`
);

exe(
  `
CREATE TABLE b (
  a int not null,
  b int not null,
  abcdefghijklmnop boolean,
  asdfasdfadsfa boolean,
  foreign key (a, b) references a(a,b)
);
`
);

while (1) 0;
