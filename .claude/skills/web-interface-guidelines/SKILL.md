---
name: web-interface-guidelines
description: Audit side panel and overlay UI code against the Web Interface Guidelines (accessibility, focus, forms, motion, typography, content handling, i18n). Use before merging UI changes or when asked to review UI.
---

# Web Interface Guidelines audit

Read `guidelines.md` in this folder: a pinned copy of the Web Interface Guidelines
(see `../README.md` for the source commit). Check the files you are given against
every rule and report findings in the format it describes.

Project rules in `docs/design/DIRECTION.md` win where they differ. In particular:

- **Sentence case** for headings and buttons, not Title Case (Chrome and our i18n
  strings use sentence case).
- Extension pages have no URL bar, so "URL reflects state" doesn't apply to the
  side panel.
- There is no server rendering, so the hydration rules don't apply.
