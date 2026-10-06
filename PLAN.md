# Blind Interval Timer: Implementation Plan

A small static PWA workout timer. The user sets a minimum and maximum duration. The app picks a random duration between those bounds and **hides it**. When the time is up, the app plays a quiet alarm (which can be turned off) and shows how long the interval actually was. In optional "symmetrical" mode, the same hidden duration runs twice with a "switch sides" cue in between.

**Stack:** Next.js (App Router, static export) + TypeScript, deployed to GitHub Pages with GitHub Actions. It must install as a PWA on Android (Chrome) and iOS (Safari "Add to Home Screen").

> Working name: `blind-timer`. Wherever this plan says `REPO_NAME`, use the actual GitHub repo name, because it sets the GitHub Pages `basePath`.

---

## 0. Ground rules for the implementing agent

- **There is no server.** Use `output: 'export'`. Don't use API routes, server actions, middleware, `next/image` optimization, or dynamic routes without `generateStaticParams`.
- **Don't use a PWA plugin** (`next-pwa`, `@ducanh2912/next-pwa`, `@serwist/next`). They're webpack-bound or don't keep up with Next/Turbopack. Write a small service worker by hand and generate its precache list after the build (see §6). That gives us fewer moving parts and nothing tied to a particular bundler.
- **Keep runtime dependencies at zero** beyond `next`, `react`, `react-dom`. Sounds are synthesized with the Web Audio API, so there are no audio files.
- **Keep timer logic pure and unit-tested.** Put it in a framework-free state machine. React only renders that state and dispatches events.
- **Never compute time by counting ticks.** Store absolute deadlines (`Date.now()`-based epoch ms) and compare against the clock. Mobile browsers throttle or suspend `setTimeout`/`setInterval`.
- Use strict TypeScript, ESLint (Next's config), and Prettier.

---

## 1. Scaffold

```bash
npx create-next-app@latest blind-timer \
  --typescript --eslint --app --src-dir --no-tailwind --import-alias "@/*" --use-npm
```

- Styling: plain CSS Modules plus one `globals.css`. Tailwind isn't needed for this few screens. If the agent prefers Tailwind, that's fine, but it must stay consistent.
- Add dev dependencies: `vitest`, `@vitest/coverage-v8`, `jsdom`, `@testing-library/react`, `prettier`, `sharp` (icon generation only), `@playwright/test` (optional e2e).
- `package.json` scripts:

```json
{
  "dev": "next dev",
  "build": "next build && node scripts/generate-sw.mjs",
  "start": "npx serve out",
  "lint": "next lint",
  "test": "vitest run",
  "icons": "node scripts/generate-icons.mjs",
  "typecheck": "tsc --noEmit"
}
```

(If the installed Next version has removed `next lint`, use `eslint .` instead.)

### `next.config.ts`

```ts
import type { NextConfig } from 'next';

const isProd = process.env.NODE_ENV === 'production';
const basePath = isProd ? process.env.NEXT_PUBLIC_BASE_PATH ?? '' : '';

const config: NextConfig = {
  output: 'export',
  basePath,
  assetPrefix: basePath || undefined,
  trailingSlash: true,          // GitHub Pages serves /foo/ → /foo/index.html reliably
  images: { unoptimized: true },
  reactStrictMode: true,
};
export default config;
```

- Expose `NEXT_PUBLIC_BASE_PATH` (e.g. `/REPO_NAME`) and read it through a single `src/lib/basePath.ts` helper. Every hand-built URL (manifest icons, SW registration, `start_url`, `scope`) must go through that helper.
- If the user later adds a custom domain or uses a `<user>.github.io` repo, setting `NEXT_PUBLIC_BASE_PATH=''` should be the only change needed.

---

## 2. File structure

```
src/
  app/
    layout.tsx            # <html>, metadata, viewport, iOS meta tags, SW registration
    page.tsx              # single-page app shell: renders <TimerApp/>
    manifest.ts           # web app manifest (force-static)
    globals.css
  components/
    TimerApp.tsx          # top-level: wires settings + machine + side effects
    SetupScreen.tsx       # min/max inputs, toggles, Start
    DurationInput.tsx     # mm:ss stepper input
    HiddenScreen.tsx      # blank / image screen while running (NO time shown)
    SwitchScreen.tsx      # "Switch sides" cue screen (NO time shown)
    CompleteScreen.tsx    # "Done" + actual duration(s)
    HoldToCancel.tsx      # long-press cancel control
    InstallHint.tsx       # Android install button / iOS "Add to Home Screen" hint
  lib/
    timerMachine.ts       # pure reducer + types (core logic)
    random.ts             # crypto-based uniform integer in [min, max]
    audio.ts              # Web Audio beeps, unlock-on-gesture
    wakeLock.ts           # Screen Wake Lock with re-acquire + fallback
    vibrate.ts            # navigator.vibrate guard
    settings.ts           # load/save/validate settings (localStorage)
    format.ts             # ms → "1:07" / "67 s"
    basePath.ts
  hooks/
    useTimerMachine.ts    # useReducer + scheduler (deadline-based)
    useInstallPrompt.ts   # beforeinstallprompt capture
    useStandalone.ts      # display-mode: standalone / navigator.standalone
public/
  icons/                  # generated PNGs (see §7)
  hidden/                 # 2–3 built-in calm background images (optional, small WebP)
scripts/
  generate-sw.mjs         # writes out/sw.js with precache manifest
  generate-icons.mjs      # sharp: icon.svg → PNG sizes
  sw-template.js          # SW source with __PRECACHE__ / __VERSION__ placeholders
  icon.svg                # source icon
.github/workflows/deploy.yml
tests/
  timerMachine.test.ts
  random.test.ts
  settings.test.ts
  format.test.ts
```

---

## 3. Domain model and timer state machine (core of the app)

### Settings (persisted)

```ts
type Settings = {
  minSeconds: number;        // integer, ≥ 1
  maxSeconds: number;        // integer, ≥ minSeconds, ≤ 3600
  symmetrical: boolean;      // run the same duration twice with a switch cue
  switchSeconds: number;     // switch-over cue length, default 5, range 2–15
  soundEnabled: boolean;     // default true
  vibrationEnabled: boolean; // default true (no-op where unsupported)
  hiddenVisual: 'black' | 'image';
  imageId: string;           // which built-in image
  version: 1;
};
```

Defaults: `min 20`, `max 300`, `symmetrical false`, `switchSeconds 5`, `sound on`, `vibration on`, `hiddenVisual 'black'`.

`settings.ts`:
- `loadSettings()` reads from localStorage key `blind-timer:settings:v1`. Wrap it in try/catch, merge the stored values over the defaults, then run `validate`.
- `validate(s)` clamps values to their ranges, rounds to integers, and if `max < min` sets `max = min`.
- `saveSettings(s)`: called on every change (debouncing isn't necessary).

### Random duration

`random.ts`:
- `randomIntInclusive(min, max)` uses `crypto.getRandomValues` with rejection sampling, so the distribution has no modulo bias.
- Durations use whole **seconds** (shown to the user as seconds), stored internally as ms.

### State machine (`timerMachine.ts`)

This is a pure reducer: no timers, no DOM, no `Date.now()` inside it. The current time arrives as `now` on every event.

```ts
type Phase =
  | { kind: 'idle' }
  | { kind: 'running'; half: 1 | 2; durationMs: number; startedAt: number; endsAt: number;
      firstHalfActualMs?: number }
  | { kind: 'switching'; durationMs: number; firstHalfActualMs: number; endsAt: number }
  | { kind: 'complete'; durationMs: number; halves: 1 | 2;
      actualMs: number[]; /* measured per half */ totalMs: number };

type Event =
  | { type: 'START'; now: number; durationMs: number; symmetrical: boolean; switchMs: number }
  | { type: 'TICK'; now: number }      // scheduler/visibility wake-up; reducer decides if a deadline passed
  | { type: 'CANCEL' }
  | { type: 'RESET' };                 // complete → idle
```

The `durationMs` is chosen **outside** the reducer (in the hook, via `random.ts`) and passed in with `START`. That keeps the reducer deterministic and testable.

The reducer also stores `switchMs` in the running state so it can enter `switching` without needing settings.

Transitions:

| From | Event | Condition | To |
|---|---|---|---|
| idle | START | – | running(half 1, endsAt = now + d) |
| running(1) | TICK | now ≥ endsAt && symmetrical | switching(endsAt = now + switchMs), record `firstHalfActualMs = now − startedAt` |
| running(1) | TICK | now ≥ endsAt && !symmetrical | complete(actualMs = [now − startedAt]) |
| switching | TICK | now ≥ endsAt | running(half 2, startedAt = now, endsAt = now + d) (**same d**) |
| running(2) | TICK | now ≥ endsAt | complete(actualMs = [first, now − startedAt]) |
| running / switching | CANCEL | – | idle |
| complete | RESET | – | idle |
| any | TICK | deadline not reached | unchanged (return same object reference) |

The reducer also returns **effects** as data, e.g. `{ state, effects: ['PLAY_SWITCH', 'VIBRATE_SWITCH'] }`. Alternatively, the hook can derive effects by comparing previous and next `kind`. Either works. Choose one and test it.

**"How long the timer actually was":** the complete screen shows the **target duration** (the random value) as the main number. It also shows a small "measured" value from the `actualMs` wall clock if that differs from the target by more than 1 s, which happens when the device slept and the timer fired late. Symmetrical mode shows `2 × 0:43 (1:26 total)`, plus the switch time noted separately ("+5 s switch").

### Scheduler hook (`useTimerMachine.ts`)

- Holds the state in `useReducer`.
- Whenever the state has an `endsAt`, it schedules **one** `setTimeout` for `endsAt − Date.now()`. When that fires it dispatches `TICK` with `now = Date.now()`. Clean up on every state change.
- As a safety net, it also runs a 1 s `setInterval` heartbeat that dispatches `TICK` while running or switching. This is cheap, and it guards against clamped or dropped timeouts.
- On `visibilitychange` → visible, and on `pageshow`/`focus`, it dispatches `TICK` immediately so overdue deadlines resolve at once.
- It executes effects: audio, vibration, wake lock acquire/release.

### Persisting an in-flight run (recommended)

Save the active `Phase` to `sessionStorage` (key `blind-timer:run`) on each transition. On load, if a running state exists, restore it and dispatch `TICK`. This handles iOS killing and reloading the PWA while it was in the background. Clear it on complete, cancel, or reset.

---

## 4. Screens and UX

The app is one route with screens switched by `phase.kind`. It's mobile-first and portrait, has large touch targets (≥ 48 px), and supports a dark theme only (the hidden screen is black anyway, and a dark UI avoids a flash on transitions).

### SetupScreen (idle)

- Two `DurationInput`s: **Min** and **Max**, both mm:ss, each with − / + steppers (step 5 s; long-press repeats) and a directly editable field (`inputMode="numeric"`).
- Inline validation: if max < min, show a hint and disable Start, or auto-adjust max. Choose one; auto-adjusting max on blur is friendlier.
- Toggles (real `<input type="checkbox">` with labels, styled as switches):
  - **Symmetrical exercise (both sides)**. When on, it reveals a "Switch time" stepper (2–15 s, default 5).
  - **Sound**
  - **Vibration** (hidden if `!('vibrate' in navigator)`, which covers iOS)
- Hidden-screen visual: segmented control **Black / Image**. If Image, show a thumbnail picker of 2–3 bundled images.
- Big **Start** button. **The Start tap must call `audio.unlock()` and `wakeLock.request()` synchronously inside the click handler.** iOS requires a user gesture for both.
- `InstallHint` at the bottom when not already installed (§8).
- Optional line of text: "Range: 0:20 – 5:00. You won't see the countdown."

### HiddenScreen (running)

- Full-viewport black (`#000`) or the selected image (`object-fit: cover`, dimmed). **No numbers, no progress bar, no animation that encodes progress.**
- Optional: a very faint, constant (non-progressing) indicator such as a small "Running · 1/2" label at 20 % opacity, so the user knows the app hasn't frozen. "1/2" or "2/2" only appears in symmetrical mode and says which half is running, not how much time is left.
- **HoldToCancel**: a small "Hold to stop" pill at the bottom. Pressing and holding for 1 s cancels (a fill ring shows the hold progress). This stops accidental taps from ending a set. Use pointer events and handle `pointercancel`/`pointerleave`.
- Prevent text selection, the context menu, and pull-to-refresh: `overscroll-behavior: none`, `user-select: none`, `touch-action: none` on this screen.

### SwitchScreen (switching)

- High-contrast full screen: **"Switch sides"** in large text with a soft color pulse. **No countdown number.** A purely decorative animation that doesn't track the remaining time is fine.
- Plays the switch sound and a vibration pattern on entry.
- HoldToCancel is still available.

### CompleteScreen (complete)

- Big **"Done"**, followed by the duration: `0:43`, or in symmetrical mode `0:43 per side · 1:26 total`.
- Small grey line if measured ≠ target (see §3).
- Plays the completion sound and vibration on entry.
- Buttons: **Again** (same settings, new random duration, starts immediately; it's a user gesture, so audio and wake lock are fine) and **Back** (to setup).
- Optional nice-to-have: keep the last 10 results in localStorage and show them as a tiny list on the setup screen. This is not required for v1.

---

## 5. Device APIs

### Audio (`audio.ts`)

- Create a single lazy `AudioContext`. `unlock()` creates or resumes it and plays a 1-sample silent buffer. Call it from the Start/Again click handlers.
- Sounds are synthesized with `OscillatorNode` + `GainNode`, with short attack/decay envelopes so they're discreet and not harsh:
  - `playSwitch()`: two soft 660 Hz beeps, 120 ms each, 120 ms gap.
  - `playComplete()`: three ascending soft beeps (523 → 659 → 784 Hz), ~150 ms each.
  - Peak gain is around 0.25. Keep it "discreet".
- If the context is `suspended` when a sound is due, try `resume()` before playing.
- Respect `settings.soundEnabled`. When sound is off, the switch and complete screens still provide the visual cue and vibration.
- iOS note: Web Audio output may be muted by the hardware silent switch. Where supported (`'audioSession' in navigator`, Safari 17+), set `navigator.audioSession.type = 'playback'` **only while a run is active** so the alarm is audible, and reset it to `'auto'` afterwards. Feature-detect it and never let it throw.

### Screen Wake Lock (`wakeLock.ts`)

- `request()`: `navigator.wakeLock.request('screen')`. Store the sentinel. Re-acquire on `visibilitychange` → visible while a run is active, because the OS releases it when the app is hidden. `release()` on complete or cancel.
- Fallback when `wakeLock` is unavailable or rejects: play a tiny muted, looping, `playsInline` video (the NoSleep.js technique; ship a ~1 KB blank MP4/WebM in `public/`). Start it in the same user gesture. This matters most on older iOS versions, where wake lock in home-screen PWAs was unreliable.
- **The screen must stay on during a run.** If the phone sleeps, JS is suspended and the alarm can't fire on time, especially on iOS. Mention this in a one-line note on the setup screen if no wake lock method is available.

### Vibration (`vibrate.ts`)

- `vibrate(pattern)` guarded by `'vibrate' in navigator` and `settings.vibrationEnabled`. Switch: `[200, 100, 200]`. Complete: `[400, 150, 400, 150, 400]`. Android only; iOS has no Vibration API. That's expected, not a bug.

### Known platform limits (document these in the README; don't try to engineer around them)

- A web app can't run a reliable timer while the phone is locked or the app is backgrounded. We keep the screen awake and, when the user returns, fire immediately and show the measured time.
- System notifications are out of scope. The "timer complete notification" is the in-app Complete screen plus sound and vibration.

---

## 6. PWA: manifest, service worker, offline

### Manifest (`src/app/manifest.ts`)

```ts
import type { MetadataRoute } from 'next';
import { withBase } from '@/lib/basePath';
export const dynamic = 'force-static';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Blind Interval Timer',
    short_name: 'Blind Timer',
    description: 'Random-length hidden workout timer',
    id: withBase('/'),
    start_url: withBase('/'),
    scope: withBase('/'),
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#000000',
    theme_color: '#000000',
    icons: [
      { src: withBase('/icons/icon-192.png'), sizes: '192x192', type: 'image/png' },
      { src: withBase('/icons/icon-512.png'), sizes: '512x512', type: 'image/png' },
      { src: withBase('/icons/maskable-512.png'), sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
```

Check after the build that `out/manifest.webmanifest` exists and that `<link rel="manifest">` in the HTML has the basePath prefix. If Next doesn't prefix it automatically, add the link manually in `layout.tsx`.

### `layout.tsx` metadata and viewport

- `export const metadata`: title, description, `appleWebApp: { capable: true, title: 'Blind Timer', statusBarStyle: 'black-translucent' }`, `icons.apple: withBase('/icons/apple-touch-icon.png')`, `formatDetection: { telephone: false }`.
- `export const viewport`: `width=device-width`, `initialScale: 1`, `viewportFit: 'cover'`, `themeColor: '#000000'`, `userScalable: false` (acceptable here; it's a single-purpose control surface).
- Use `env(safe-area-inset-*)` padding in CSS for the notch and home indicator.
- Add `<meta name="mobile-web-app-capable" content="yes">` if Next doesn't emit it.

### Service worker

`scripts/sw-template.js` (plain JS, no imports):
- `const VERSION = '__VERSION__'; const PRECACHE = __PRECACHE__; const BASE = '__BASE__';`
- `install`: open cache `blind-timer-${VERSION}`, `addAll(PRECACHE)`, `skipWaiting()`.
- `activate`: delete caches that don't match the current version, then `clients.claim()`.
- `fetch` (GET, same-origin only):
  - navigation requests → network-first, falling back to the cached `BASE + '/'` (index.html) on failure;
  - everything else → cache-first, falling back to network (and store successful responses).

`scripts/generate-sw.mjs` (runs after `next build`):
- Recursively list `out/`, excluding `sw.js`, `*.map`, `*.txt` (RSC payloads aren't needed for a single static page; include them if navigation turns out to need them), and `.nojekyll`.
- Map each file to a URL prefixed with `NEXT_PUBLIC_BASE_PATH`. Map `index.html` to the directory URL (`/REPO_NAME/`) because of `trailingSlash`.
- `VERSION` is a short hash of the sorted file list plus file contents (or `GITHUB_SHA` when available).
- Write `out/sw.js`, then write an empty `out/.nojekyll` (**required**, or GitHub Pages hides the `_next/` folder).

Registration (a small client component rendered in `layout.tsx`, or a `useEffect` in `TimerApp`):
- Only when `process.env.NODE_ENV === 'production'` and `'serviceWorker' in navigator`.
- `navigator.serviceWorker.register(withBase('/sw.js'), { scope: withBase('/') })`.
- Update UX (optional, simple): on `updatefound` → installed while a controller exists, show a small "Update available – tap to reload" toast on the setup screen only, **never during a run**.

---

## 7. Icons

- Source: `scripts/icon.svg`, a simple original mark (e.g. a stopwatch outline with a "?" or an eye-slash inside), white on near-black.
- `scripts/generate-icons.mjs` (sharp) outputs to `public/icons/`:
  - `icon-192.png`, `icon-512.png`
  - `maskable-512.png` (artwork scaled to about 70 % inside the safe zone, on a solid background)
  - `apple-touch-icon.png` (180×180, solid background, no transparency)
  - `favicon-32.png` (+ `src/app/icon.png` or `favicon.ico` if desired)
- Commit the generated PNGs so CI doesn't need sharp.

---

## 8. Installability UX

- `useStandalone()`: true if `matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true`. When it's true, hide all install hints.
- **Android/Chromium:** `useInstallPrompt()` captures `beforeinstallprompt` (call `preventDefault()` and store the event). Show an **Install app** button, which calls `prompt()` when tapped.
- **iOS Safari** (user agent contains iPhone/iPad and the browser isn't standalone): show a dismissible hint: "Install: tap the Share icon, then **Add to Home Screen**". Remember the dismissal in localStorage.
- Don't nag. Show at most one small banner on the setup screen.

---

## 9. GitHub Pages deployment

`.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run lint && npm run typecheck && npm test
      - run: npm run build
        env:
          NEXT_PUBLIC_BASE_PATH: /${{ github.event.repository.name }}
          NEXT_TELEMETRY_DISABLED: 1
      - uses: actions/upload-pages-artifact@v3
        with:
          path: out

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

(Use the current major versions of these actions at implementation time.)

One-time manual step for the repo owner: **Settings → Pages → Build and deployment → Source: GitHub Actions.**

The live URL will be `https://<user>.github.io/REPO_NAME/`.

---

## 10. Testing

### Unit tests (Vitest), required

- `timerMachine.test.ts`:
  - non-symmetric: START → TICK before deadline (no change) → TICK at deadline → complete with correct `durationMs` and `actualMs`;
  - symmetric: START → deadline → switching → deadline → running half 2 with the **same** `durationMs` → deadline → complete with two `actualMs` entries;
  - a late TICK (e.g. 30 s after the deadline) moves exactly **one** phase and records the late measured time;
  - CANCEL from running and from switching returns to idle;
  - RESET from complete returns to idle;
  - a no-op TICK returns the same state reference.
- `random.test.ts`: always within [min, max] over 10k samples; min === max returns min; rough uniformity check (each bucket within ±20 % of expected for a small range).
- `settings.test.ts`: clamping, `max < min` fix-up, corrupt JSON falls back to defaults, unknown keys are ignored.
- `format.test.ts`: `65000 → "1:05"`, `5000 → "0:05"`, `3600000 → "60:00"`.

### Optional e2e (Playwright, Chromium mobile emulation)

- Set min = max = 2 s, Start → hidden screen contains no digits → after ~2 s, "Done" and "0:02" are visible.
- Symmetrical with min = max = 2 s, switch = 2 s → "Switch sides" appears → "Done" shows "0:02 per side".
- Use `page.clock` to fast-forward time where possible.

### Manual device checklist (must pass before calling it done)

- [ ] Android Chrome: install prompt appears and the app installs, launches standalone, and has the correct icon and black splash.
- [ ] iOS Safari: Add to Home Screen works and the app launches standalone with no Safari UI and the correct icon.
- [ ] Airplane mode after first load: the app opens and a full run works offline.
- [ ] Screen stays on for a 3-minute run on both platforms.
- [ ] Sound plays at switch and completion on both (iOS: test with the silent switch on and off; note the behaviour).
- [ ] Sound toggle off → silent, but the visual cue still appears and Android vibrates.
- [ ] No timer value is visible anywhere during running or switching, including the page `<title>`.
- [ ] Hold-to-cancel works; a single tap doesn't cancel.
- [ ] Settings persist across app restarts.
- [ ] Background the app mid-run past the deadline, then return → it completes immediately and shows the measured time.
- [ ] DevTools → Application: manifest has no errors, the SW is activated, and the scope is `/REPO_NAME/`.

---

## 11. Milestones (suggested order of work and commits)

1. **Scaffold and deploy a hello-world**: Next static export, basePath, `.nojekyll`, GitHub Actions workflow. Verify the live URL loads with CSS/JS (this catches basePath problems early).
2. **Core logic**: `timerMachine`, `random`, `settings`, `format` + full unit tests.
3. **UI**: Setup / Hidden / Switch / Complete screens wired through `useTimerMachine`; HoldToCancel.
4. **Device APIs**: audio (unlock on gesture), wake lock + fallback, vibration, iOS audioSession.
5. **PWA**: icons, manifest, iOS meta tags, SW generation + registration, install hints, offline test.
6. **Polish**: safe areas, transitions (fades only), in-run session restore, README (usage, limitations, how to change basePath, how to run locally), optional e2e.
7. **Device QA** with the §10 checklist, fixes, and a tagged `v1.0.0`.

## 12. Definition of done

- `npm run lint`, `typecheck`, `test`, and `build` all pass in CI, and the site deploys automatically on push to `main`.
- The app is live on GitHub Pages and installable on Android and iOS, and it works fully offline after the first visit.
- All features work as specified: random hidden duration within user bounds, discreet toggleable alarm, completion screen with the duration, and symmetrical mode (same duration twice, switch cue, nothing revealed).
- The manual checklist in §10 passes on at least one real Android and one real iPhone.

## 13. Out of scope for v1 (possible later additions)

- Custom user-uploaded hidden-screen image (store it in IndexedDB).
- Multiple rounds / rest intervals / sets counter.
- Result history and stats.
- Custom sound choices and volume slider.
- Localization (EN/SR).
