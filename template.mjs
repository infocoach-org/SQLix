#!/usr/local/bin/node

import * as fs from "fs-extra";
import p from "replace-in-file";
const { replaceInFile } = p;
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
const name = process.argv[3];
if (!name) {
  console.error("name missing, command is: " + commandString);
  process.exit(1);
}
const camelCase = changeCase.camelCase(name);

path += "/" + changeCase.snakeCase(camelCase);

const workingDirectory = process.argv[1].replace(/\/[^/]*$/, "");
const templateDirectory = workingDirectory + "/src/statements/template";

try {
  await fs.copy(templateDirectory, path, {
    errorOnExist: true,
    overwrite: false,
  });
} catch (e) {
  console.error(
    "could not copy to '" +
      path +
      "', maybe a folder or file already exists there"
  );
  process.exit(1);
}

const pascalCase = changeCase.pascalCase(camelCase);

await replaceInFile({
  files: path + "/*.ts",
  from: /Template/g,
  to: pascalCase,
});

await replaceInFile.sync({
  files: path + "/*.ts",
  from: /template/g,
  to: camelCase,
});
