#!/usr/local/bin/node

import * as fs from "fs-extra";
import * as replaceInFile from "replace-in-file";
import * as changeCase from "change-case";

const commandString = `
template_creator [path] [name in PascalCase]

Example for the select statement in the current directory:
  template_creator . Select
`;

let path = process.argv[2];
if (!path) {
  console.error("path missing, command is: " + commandString);
  process.exit(1);
}
path = path.replace(/\/$/, "");
process.argv[3];
let name = process.argv[3];
if (!name) {
  console.error("name missing, command is: " + commandString);
}
name = changeCase.camelCase(name);

path += "/" + changeCase.snakeCase(name);

const workingDirectory = process.argv[1].replace(/\/[^/]*$/, "");
const templateDirectory = workingDirectory + "../src/statements/template";

fs.copySync(templateDirectory, path);

const camelCase = changeCase.pascalCase(name);

replaceInFile.sync({ files: path + "/*.ts", from: /Template/g, to: name });
replaceInFile.sync({ files: path + "/*.ts", from: /template/g, to: camelCase });
