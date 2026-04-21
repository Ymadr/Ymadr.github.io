Mobile compatibility notes — iOS / Android

What I changed:
- Added common PNG icon entries to `manifest.json` (`icons/icon-192.png`, `icons/icon-512.png`).
- Added an `offline.html` fallback and registered it in `sw.js` cache list.
- The app already includes safe-area CSS variables and mobile meta tags.

Recommended next steps to fully support native installs:

1) Add raster icons
- Generate PNG icons (192x192 and 512x512) and place them in `icons/` as `icon-192.png` and `icon-512.png`.
- Optionally generate Apple touch startup images (splash) for iOS and add `link rel="apple-touch-startup-image"` tags in `index.html`.

2) Test PWA installability
- Serve the folder over HTTPS (or use `http://localhost`), open in Chrome on Android, and check "Add to Home screen".
- On iOS, open in Safari, tap Share → "Add to Home Screen".

3) Optional native wrappers
- If you want full native distribution (App Store / Play Store), use Capacitor:
  - `npm init @capacitor/app` → follow prompts
  - `npx cap add android` / `npx cap add ios`
  - Copy built web assets into `www/` and `npx cap open android` / `npx cap open ios` to continue in Android Studio / Xcode.

4) Enable deeper iOS PWA support (optional)
- iOS requires PNG splash images for various device sizes. Consider using a generator like https://app-manifest.firebaseapp.com/ or `pwa-asset-generator` to produce them.

Testing tips:
- Hard-refresh after updating `manifest.json` and service worker.
- On Android, check `chrome://inspect` → Application → Manifest and Service Worker.
- On iOS, the PWA has more limitations (no service worker on older Safari). Verify on iOS 13+.

If you want, I can:
- Generate a simple set of PNG placeholder icons (as SVG-exported PNGs) and add `apple-touch-startup-image` tags.
- Add a short Capacitor scaffold (`package.json` + basic config) to help build native packages.

Tell me which of the optional steps you'd like me to do next.
