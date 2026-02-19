
# Remove Calendar Indicator Labels

## Summary

Remove the two informational badges from the calendar header: the "Highlighted = available hours" legend and the "Showing times in America/New_York" timezone mismatch indicator.

## Change

**`src/components/Calendar/RBCCalendar.tsx`** (lines 284-293)

Delete the two `<span>` elements and their conditional wrappers:

```text
// REMOVE these lines (284-293):
{hasAvailability && (
  <span className="text-xs text-muted-foreground px-2 py-1 rounded border border-border">
    Highlighted = available hours
  </span>
)}
{tzMismatch && (
  <span className="text-xs text-yellow-700 bg-yellow-100 ...">
    Showing times in {authStaffTimezone}
  </span>
)}
```

The surrounding `<div className="flex items-center gap-2">` on line 283 stays -- it still wraps the Block Time and settings buttons.

No other files are affected. The `hasAvailability` and `tzMismatch` variables may become unused; if so, their declarations will also be cleaned up to avoid lint warnings.
