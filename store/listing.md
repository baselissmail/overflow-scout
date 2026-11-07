# Chrome Web Store listing: Overflow Scout 1.0

Copy for the [developer dashboard](https://chrome.google.com/webstore/devconsole). This is an **update to the existing item** (`mfinclnlokodigpdeefonldgmcdgnpim`), not a new one. The steps are in [docs/RELEASING.md](../docs/RELEASING.md).

## Store listing tab

**Name:** Overflow Scout (comes from the package)

**Summary** (from the package, 114 of 132 characters):

> Find text that’s cut off or overflowing, test with translation-length text, and get CSS fixes checked on the page.

**Description** (paste as is; the store keeps the line breaks):

```text
Overflow Scout finds text on a web page that is cut off, truncated or overflowing, and shows how the layout holds up once the text is translated.

It opens in Chrome's side panel, next to the page, and changes nothing until you ask.

WHAT IT DOES
• Scan page: lists every text that is clipped with no cue, ends in an ellipsis, runs out of its box, or makes the page scroll sideways, and how much doesn't fit.
• Test with longer text: makes every text as long as a translation would be (or uses pseudo-locale, long words, or real German, Finnish, Russian, Arabic, Japanese or Thai text), shows what breaks, and puts the page back exactly with one click.
• What to do: each result comes with CSS fixes, and each fix is tried on the page for a moment, so you know whether it works and how the box changes.
• Measure an element: pick any element, see how many characters fit, and try real names, products, links, emails or your own text, live.
• Reports: copy a Markdown report for GitHub or Jira, copy a cropped screenshot, or save everything as JSON.
• Ignore results you accept, per site. Keyboard shortcuts and a command palette (Ctrl+K or ⌘K). Light and dark themes.

PRIVATE BY DESIGN
Everything runs in your browser. Overflow Scout collects no data, has no analytics, and makes no network requests. It works on a page only after you click its toolbar button (or allow a site yourself), and only on that tab.

NEW IN 1.0
A complete rebuild: a side panel instead of a popup, a much more precise scanner, fixes checked on the page, reports and screenshots, and it no longer needs access to all your websites.
```

**Category:** Developer Tools. **Language:** English.

**Graphic assets** (all in this folder):

| Field                                 | File                                                  |
| ------------------------------------- | ----------------------------------------------------- |
| Store icon (128×128)                  | `icon-128.png`                                        |
| Screenshots (1280×800), in this order | `screenshots/1-scan.png` … `screenshots/5-report.png` |
| Small promo tile (440×280)            | `promo-small-440x280.png`                             |
| Marquee promo tile (1400×560)         | `marquee-1400x560.png`                                |

**Official URL / homepage:** `https://baselissmail.github.io/overflow-scout/` once the site is live (see RELEASING.md). **Support URL:** `https://github.com/baselissmail/overflow-scout/issues` (needs a public repository).

## Privacy practices tab

**Single purpose:**

> Overflow Scout finds text on the current web page that is cut off, truncated or overflowing its box, and tests how the page's layout handles longer (translated) text, so developers can fix it.

**Permission justifications:**

| Permission                                               | Justification                                                                                                                                                                                                      |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `activeTab`                                              | Reads and measures the current tab only after the user clicks the toolbar button, presses the keyboard shortcut, or uses the right-click menu.                                                                     |
| `scripting`                                              | Injects the scanner into that tab when the user starts working on it. Nothing runs on pages otherwise.                                                                                                             |
| `sidePanel`                                              | The extension's whole interface is a side panel next to the page.                                                                                                                                                  |
| `storage`                                                | Saves settings and per-site ignore rules on the device (`chrome.storage.local`), and hands the latest toolbar click to the panel (`chrome.storage.session`).                                                       |
| `contextMenus`                                           | Adds "Measure this element with Overflow Scout" to the page's right-click menu.                                                                                                                                    |
| Host permissions (optional, `http://*/*`, `https://*/*`) | Never requested at install. Requested for one site at a time, only when the user chooses "Always allow on this site", so the panel can work there without a click each time. The user can remove them in Settings. |

**Remote code:** No, I am not using remote code. All code is in the package.

**Data usage:** tick none of the data types. Then certify all three statements: not sold or transferred, not used for purposes unrelated to the single purpose, not used for creditworthiness or lending.

**Privacy policy URL:** `https://baselissmail.github.io/overflow-scout/privacy.html` (the page is in `site/privacy.html`).

## For existing users

Version 0.1.0 asked to "read and change all your data on all websites" and ran a content script on every page. 1.0 drops that warning: it works only on the tab you click, and asks for a site only if you choose "Always allow". Existing installs update without a new permission prompt.
