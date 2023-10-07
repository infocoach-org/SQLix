import { Database } from "../src/database";
import { SqlBaseError } from "../src/error";
import { SingleStatementSQLRunner } from "../src/single_statement_runner";
import { createConfig } from "../src/statements/create";
import { insertConfig } from "../src/statements/insert";
import { Keyword } from "../src/tokenizer";
import consoleErrorFormat from "../src/utils/console_error_format";

const database = new Database();

const executor = new SingleStatementSQLRunner(
  {
    statements: [createConfig, insertConfig],
    notAllowedStatements: [Keyword.select],
  },
  database
);

function exe(text: string, print: boolean = false) {
  const res = executor.execute(text);
  if (res.error) {
    if (res.error instanceof SqlBaseError) {
      console.log(consoleErrorFormat(text, res.error));
      console.error(res.error.message);
      console.log("\n\n");
    } else {
      console.log("\n\n" + text);
      console.error(res);
    }
  } else if (print) {
    if (print) console.log("\n\n" + text);
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
