/**
 * One CSV cell, destined for a spreadsheet an accountant will open.
 *
 * Two jobs, and exporters usually do only the first. Quoting keeps a comma or a
 * quote from shifting the columns. Neutralising a leading `=`, `+`, `-` or `@`
 * keeps a client name like `=HYPERLINK(...)` from being evaluated as a formula
 * when the file opens, which is the oldest trick there is against a file whose
 * content a stranger controls. Both, always.
 *
 * Line breaks inside a value are flattened rather than quoted: a cell that spans
 * lines is legal CSV and still a bad thing to hand someone reconciling a month.
 */
const FORMULA_LEAD = /^[=+\-@\t\r]/;

export function csvCell(value: string | null | undefined): string {
  let text = (value ?? "").replace(/[\r\n]+/g, " ");
  if (FORMULA_LEAD.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}

export function csvRow(values: Array<string | null | undefined>): string {
  return values.map(csvCell).join(",");
}
