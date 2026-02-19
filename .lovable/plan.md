

# Fix: Availability Shading Not Visible on Calendar

## Root Cause

The entire custom calendar stylesheet (`src/styles/react-big-calendar.css`) has never been loaded. The import path in `src/index.css` is wrong:

```
Current (broken):  @import '../styles/react-big-calendar.css';
Correct:           @import './styles/react-big-calendar.css';
```

From `src/index.css`, the `../` prefix navigates up to the project root, then looks for `styles/react-big-calendar.css` at the root level. That directory is empty. The actual file is at `src/styles/react-big-calendar.css`, which requires `./styles/` (staying within `src/`).

Vite silently drops the broken import rather than throwing a build error, so the app loads fine -- but none of the custom calendar CSS rules ever take effect. This means:

- The `.rbc-slot-unavailable` shading rule never applied (even the bright red debug version)
- All other custom calendar theming in that file (border-radius, theme-colored headers, dark mode, etc.) has also been absent

The debug logging confirmed every other layer works: the database returns availability slots, the map is built correctly, `slotPropGetter` fires and returns `{ className: 'rbc-slot-unavailable' }` for the right slots. The class is on the DOM elements. There is just no CSS rule loaded to style it.

## Changes

### 1. `src/index.css` (line 151) -- Fix the import path

Change `'../styles/react-big-calendar.css'` to `'./styles/react-big-calendar.css'`.

One character change. This loads the entire stylesheet, fixing both the availability shading and all existing calendar theme customizations.

### 2. `src/styles/react-big-calendar.css` -- Restore production styling

Replace the bright red debug rule with the intended subtle shading for unavailable slots. Use a repeating diagonal stripe pattern at low opacity for light mode and slightly higher opacity for dark mode:

```css
.rbc-slot-unavailable {
  background: repeating-linear-gradient(
    135deg,
    hsl(var(--muted) / 0.35),
    hsl(var(--muted) / 0.35) 4px,
    hsl(var(--muted) / 0.15) 4px,
    hsl(var(--muted) / 0.15) 8px
  ) !important;
}

.dark .rbc-slot-unavailable {
  background: repeating-linear-gradient(
    135deg,
    hsl(var(--muted) / 0.5),
    hsl(var(--muted) / 0.5) 4px,
    hsl(var(--muted) / 0.25) 4px,
    hsl(var(--muted) / 0.25) 8px
  ) !important;
}
```

### 3. `src/components/Calendar/RBCCalendar.tsx` -- Remove debug logging

Strip out the three debug additions:
- Remove the `useEffect` that logs raw availability data and map contents
- Remove the `slotPropGetterLoggedRef` Set and the throttled console logging inside `slotPropGetter`
- Keep the actual availability logic (the `useMemo` map, the `slotPropGetter` callback, the legend indicator) exactly as-is

### No other files change

- No database changes
- No new files
- No logic changes to the availability calculation

