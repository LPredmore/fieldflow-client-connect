

# Fix: Move CSS @import to Top of File

## Problem

The `@import './styles/react-big-calendar.css'` on line 151 of `src/index.css` is ignored by the browser because CSS spec requires all `@import` statements to appear before any other rules. The `@tailwind` directives on lines 1-3 count as rules, so the browser silently discards the import.

## Change

**`src/index.css`** -- two edits:

1. Add `@import './styles/react-big-calendar.css';` as the very first line of the file (before `@tailwind base;`)
2. Delete the current import and its comment on lines 150-151

No other files change. No logic changes. No database changes.

