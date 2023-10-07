import { SqlBaseError } from "../error";

const reset = "\x1b[0m";
const bright = "\x1b[1m";
const underscore = "\x1b[4m";
const fgRed = "\x1b[31m";

function consoleErrorFormat(sql: string, error: SqlBaseError) {
  return (
    sql.substring(0, error.start) +
    bright +
    underscore +
    fgRed +
    sql.substring(error.start, error.end) +
    reset +
    sql.substring(error.end)
  );
}

export default consoleErrorFormat;
