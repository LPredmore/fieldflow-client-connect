

# Add Debugging to Availability Shading

There are two possible failure points, and without logging we can't distinguish them:

1. **`slotPropGetter` is never called or returns empty** -- meaning the availability data isn't reaching the callback
2. **`slotPropGetter` IS applying the class, but the CSS is invisible** -- the gradient uses very low opacity values on a near-white background that may be imperceptible

## Changes

### `src/components/Calendar/RBCCalendar.tsx`

Add console logging at three points:

1. **After the availability map is built** -- log the map contents and `hasAvailability` flag so we can confirm the data arrived and was parsed correctly
2. **Inside `slotPropGetter`** -- log the first few calls to confirm it's being invoked and what it returns (throttled to avoid console spam -- only log once per unique day+hour combination)
3. **Log the `availabilitySlots` raw data** from the hook to confirm the fetch returned rows

### `src/styles/react-big-calendar.css`

Temporarily make the unavailable shading extremely obvious (bright red background at full opacity) so that if the class IS being applied, it will be impossible to miss. This eliminates the "is it there but invisible?" question entirely.

```css
.rbc-slot-unavailable {
  background: rgba(255, 0, 0, 0.3) !important;
}
```

Once we confirm which layer is broken (data vs. CSS), we can fix it and then restore subtle styling.

## No other files change

- No database changes
- No new files
- Two files modified with temporary debugging code

