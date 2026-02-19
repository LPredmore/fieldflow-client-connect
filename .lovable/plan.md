

# Invert Calendar Shading: Highlight Available Times

## What changes

Instead of shading **unavailable** slots, the calendar will apply a subtle wash of your Secondary Brand Color to **available** time slots. Everything outside your availability stays plain/white, and the times you're open for appointments get a gentle colored highlight.

This is arguably more intuitive: "colored = open for business."

## Changes (2 files)

### 1. `src/components/Calendar/RBCCalendar.tsx`

Flip the logic in `slotPropGetter`:

- Currently: applies class when slot is **outside** availability
- New: applies class when slot is **inside** availability
- Rename the class from `rbc-slot-unavailable` to `rbc-slot-available` for clarity
- Update the legend text from "Dimmed = outside availability" to something like "Highlighted = available hours"

Concretely, line 92-94 changes from:

```js
const isUnavailable = !windows || !windows.some(w => ...);
if (isUnavailable) {
  return { className: 'rbc-slot-unavailable' };
}
```

to:

```js
const isAvailable = windows && windows.some(w => ...);
if (isAvailable) {
  return { className: 'rbc-slot-available' };
}
```

### 2. `src/styles/react-big-calendar.css`

Rename `.rbc-slot-unavailable` to `.rbc-slot-available` (and its `.dark` variant). The rule itself stays the same -- solid semi-transparent secondary brand color fill at 15% (light) / 25% (dark) opacity.

### No other files change

The `BrandColorProvider` changes from the approved plan still apply as-is (injecting `--brand-secondary`). This plan just inverts which slots get the color.

