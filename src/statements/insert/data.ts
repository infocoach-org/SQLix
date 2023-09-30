export default interface InsertData {
  tableName: string;
  rowsToInsert: any[][];
  columnsToInsert: string[] | null;
}
