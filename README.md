# Blind Interval Timer

A static Next.js PWA that picks a hidden workout interval from a user-configured range and plays a quiet alarm when the timer completes.

## Local development

```bash
npm install
npm run dev
```

## Production build

```bash
NEXT_PUBLIC_BASE_PATH=/kole-timer npm run build
```

## Notes

- The timer uses absolute deadlines instead of ticking counters, so it stays accurate even when the browser is throttled or the tab is backgrounded.
- A Web Audio unlock is required from a user gesture before the alarm can play.
- Screen Wake Lock is attempted during a run; if unsupported, the app still completes the interval once the user returns.
