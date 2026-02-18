

# Add Debug Logging to `utcToLocalStrings`

## What

Add a single `console.log` inside `utcToLocalStrings` in `src/lib/appointmentTimezone.ts` (after line 125, before the return) that logs:

- **Inputs**: `utcTimestamp`, `zone`
- **Luxon objects**: `utc.toISO()`, `utc.hour`, `local.toISO()`, `local.hour`, `local.zoneName`
- **Final output**: the `date` and `time` strings

## Where

File: `src/lib/appointmentTimezone.ts`, inside `utcToLocalStrings`, between line 125 (`const local = utc.setZone(zone);`) and line 126 (`return {`).

## The log statement

```ts
console.log('[utcToLocalStrings] DEBUG', {
  input: { utcTimestamp, zone },
  utcObj: { iso: utc.toISO(), hour: utc.hour, isValid: utc.isValid },
  localObj: { iso: local.toISO(), hour: local.hour, zoneName: local.zoneName, offset: local.offset },
  output: { date: local.toFormat('yyyy-MM-dd'), time: local.toFormat('HH:mm') }
});
```

This will tell us definitively whether Luxon's `setZone` is applying the offset or not.

