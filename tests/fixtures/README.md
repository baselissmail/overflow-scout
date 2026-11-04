# Detection corpus

Each `.html` file is a small page that the engine scans in real Chromium
(`tests/engine/corpus.test.ts`). Annotations state what a person would see,
and the test compares the engine's findings with them.

## Annotating

- `data-expect="<kinds>"` on the element whose text is affected: `hidden`,
  `truncated`, `spilling`, `page-scroll` or `input`. List several kinds
  separated by spaces (`"spilling page-scroll"`).
- `data-expect="ok"` marks an element that must not be reported. A finding on
  any element without an annotation also counts as a false positive.
- `data-limitation="<reason>"` marks a known gap. The mismatch is still counted
  in precision and recall but does not fail the test. Remove it when fixed.
- `<meta name="fixture-viewport" content="375x667">` changes the viewport (the
  default is 1024×768).

## Folders

| Folder         | Contents                                                  |
| -------------- | --------------------------------------------------------- |
| `clipping/`    | Text cut off by `overflow: hidden`/`clip`, with no cue    |
| `truncation/`  | Ellipsis and line-clamp, including flex and grid patterns |
| `spill/`       | Text that visibly overflows its box                       |
| `page/`        | Elements and text that cause horizontal page scroll       |
| `inputs/`      | Placeholders and read-only values that don't fit          |
| `shadow/`      | Shadow DOM and slotted content                            |
| `i18n/`        | RTL, CJK and Thai text                                    |
| `layout/`      | Transforms, zoom, sticky/fixed, `content-visibility`      |
| `known-good/`  | Ordinary pages that must produce no findings at all       |
| `limitations/` | Documented gaps (`data-limitation`)                       |

## Writing a good case

- Make the outcome unambiguous: text at least twice as wide as its box, or
  clearly fitting. Font metrics differ between macOS and the Linux CI runners.
- Every false positive or negative found while dogfooding becomes a case here,
  written so that it fails before the fix and passes after it.
