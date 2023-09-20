import { Database } from "../src/database";
import { SingleStatementSQLRunner } from "../src/nparser";
import { ParseError } from "../src/parse_error";
import { CreateParserManager } from "../src/statements/create";
import { InsertParserManager } from "../src/statements/insert";

const database = new Database();

const parsers = [new CreateParserManager(), new InsertParserManager()];

const executor = new SingleStatementSQLRunner(database, parsers);

function exe(text: string, print: boolean = false) {
  const res = executor.execute(text);
  if (print) console.log("\n\n" + text);
  if (res.isError) {
    if (res.error instanceof ParseError) {
      console.log(text.substring(res.error.start, res.error.end));
      console.error(res.error.message);
    } else {
      console.error(res);
    }
  } else if (print) {
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
  primary key(a, b),
  foreign key (a, b) references a(b,a)
);
`
);

exe(
  `
insert into a (a, b) values (10, 10), (10, 20);
`,
  true
);

exe(
  `
insert into b (a, b) values (10, 10), (20, 10);
`,
  true
);

// no foreign row
exe(
  `
insert into b (a, b) values (1, 1);
`,
  true
);

// already exists
exe(
  `
insert into b (a, b) values (10, 10);
`,
  true
);

// has to insert in a, b, but only inserting in a
exe(
  `
insert into b (a) values (100);
`,
  true
);

// column mismatch
exe(
  `
insert into b (a, b) values (100);
`,
  true
);

while (1) 0;
