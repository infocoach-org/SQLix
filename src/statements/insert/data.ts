import { StatementData } from "../../nparser";

export default interface InsertData extends StatementData {
  tableName: string;
  rowsToInsert: any[][];
  columnsToInsert: string[] | null;
}
