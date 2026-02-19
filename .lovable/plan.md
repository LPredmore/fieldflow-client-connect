
# Remove All "FieldFlow" References

## What's Happening

The text "Loading FieldFlow..." is hard-coded in `index.html` as a static HTML fallback that renders *before* React even loads. This is what the user sees in the brief moment the browser has downloaded the HTML but has not yet executed the JavaScript bundle. Once React starts, it clears that `div` and takes over.

There are also several other FieldFlow references scattered through the file in meta tags (description, author, og:title, etc.) that are invisible to the user but exist in the page source.

Outside of `index.html`, the other occurrences are either:
- A comment in `src/index.css` ("FieldFlow Material Design System") — invisible to users
- A comment in `src/styles/react-big-calendar.css` — invisible to users
- Old database migration SQL files — already deployed, cannot cause visible text

None of those other files produce any visible text.

## Files to Change

### 1. `index.html` — the only file causing visible output

**Line 57** — the loading text the user actually sees:
```
Change: <div>Loading FieldFlow...</div>
To:     <div>Loading...</div>
```

**Lines 8-9** — invisible meta tags, but should be cleaned up:
- Remove `content="...FieldFlow."` from the description meta
- Remove `content="FieldFlow"` from the author meta

**Lines 43-44** — Open Graph meta tags (used by link previews on social/Slack/etc.):
- Remove `og:title` "FieldFlow - Field Service Management Platform"
- Remove `og:description` references to FieldFlow

### 2. `src/index.css` — line 7 comment only

```css
/* FieldFlow Material Design System - All colors MUST be HSL */
```
Change to a neutral comment (e.g., `/* Design System - All colors MUST be HSL */`). This is invisible to users but keeps the codebase clean.

### 3. `src/styles/react-big-calendar.css` — line 2 comment only

```css
/* Integrates with FieldFlow Material Design System */
```
Change to a neutral comment. Again invisible, but clean.

## What Is NOT Being Changed

- The database migration files — these are historical SQL files that have already been executed. They cannot produce visible text and must not be touched.
- Any application logic, routing, or component files — none of them reference FieldFlow.

## Summary of Visible Impact

The only change a user will ever see is the initial loading splash going from `Loading FieldFlow...` to `Loading...`. Everything else is invisible cleanup in comments and meta tags.
