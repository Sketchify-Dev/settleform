# Self-hosted typefaces

Two variable fonts, committed so the build never asks the network for type. Both
were fetched from the Google Fonts API on 2026-11-03 and are unmodified: the
`latin` subset of each family, which is the same subset and the same axis ranges
`next/font/google` was previously asked for.

| File | Family | Axes | Upstream |
| --- | --- | --- | --- |
| `Archivo-Variable-latin.woff2` | Archivo | `wght` 100..900, `wdth` 62..125 | `https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,100..900` |
| `MartianMono-Variable-latin.woff2` | Martian Mono | `wght` 100..800, `wdth` 75..112.5 | `https://fonts.googleapis.com/css2?family=Martian+Mono:wdth,wght@75..112.5,100..800` |

The width axes are the point of both faces: display type is set at `wdth` 112 and
Martian Mono at its widest, so a static file would quietly change the design. Each
file was checked for a `fvar` table carrying those axes after download.

Loaded through `next/font/local` in `app/layout.tsx`, which emits `@font-face`
rules with `font-stretch` ranges and a metric-adjusted Arial fallback, as the
Google loader did.

Licences: both families are under the SIL Open Font License 1.1, beside the files
as `OFL-Archivo.txt` and `OFL-MartianMono.txt`.

To refresh a file, download the `latin` `woff2` from the URL in the table, replace
the file under the same name, and check the new one still has the axis ranges above.
