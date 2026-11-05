import { test } from "node:test";
import assert from "node:assert/strict";
import { csvCell, csvRow } from "../lib/csv.ts";

test("a value cannot break out of its column", () => {
  assert.equal(csvCell("Acme, Inc."), '"Acme, Inc."');
  assert.equal(csvCell('He said "pay"'), '"He said ""pay"""');
  assert.equal(csvCell("line one\nline two"), '"line one line two"');
  assert.equal(csvCell(null), '""');
});

test("a value cannot become a formula in the reader's spreadsheet", () => {
  for (const dangerous of ["=1+1", "+1", "-1", "@SUM(A1)", "\tcmd"]) {
    assert.equal(csvCell(dangerous).startsWith('"\'') || csvCell(dangerous).startsWith('"\t'), true,
      "leading " + JSON.stringify(dangerous) + " must be neutralised");
  }
  assert.equal(csvCell("=1+1"), '"\'=1+1"');
  // A hyphen inside a value is not a formula and must survive untouched.
  assert.equal(csvCell("SF-0001"), '"SF-0001"');
});

test("a row keeps its shape even when a name is hostile", () => {
  const row = csvRow(["ab4d7139", '=HYPERLINK("http://evil","click")', "250.00"]);
  assert.equal(row.split('","').length >= 3, true);
  assert.equal(row.includes('"\'=HYPERLINK(""http://evil"",""click"")"'), true);
});
