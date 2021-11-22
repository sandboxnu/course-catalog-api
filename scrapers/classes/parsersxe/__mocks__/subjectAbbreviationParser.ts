import data from "./subjectAbbreviationTable.json";

export function getSubjectAbbreviations(): Record<string, string> {
  return data;
}
