import { Tokenizer } from "../src/tokenizer";

const text = `SELECT a.b

' as

'
`;
const tokenizer = new Tokenizer(text);

console.log(tokenizer.tokenize());

console.log(tokenizer.tokens);

while (true) {}
