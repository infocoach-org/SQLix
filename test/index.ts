import { Database } from "../src/database";
import { SingleStatementExecutor } from "../src/nparser";
import { ParseError } from "../src/parse_error";
import { CreateParserManager } from "../src/statements/create";
import { InsertParserManager } from "../src/statements/insert";

const database = new Database();

const parsers = [new CreateParserManager(), new InsertParserManager()];

const executor = new SingleStatementExecutor(database, parsers);

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

// does not exist
exe(
  `
insert into b (a, b) values (10, 10);
`,
  true
);

while (1) 0;
