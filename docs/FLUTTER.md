# Flutter Guide / Panduan Flutter

## Current status
Lightpanda is a headless browser for web. Flutter native apps are not browsers, so they need Flutter's own test tools. This harness prepares integration:

- **Flutter Web**: fully supported via Lightpanda (treat as web app).
- **Native mobile**: use `flutter drive` / `integration_test`; WiraXplore provides config + docs only.

## Flutter Web workflow

1. Build:
   ```bash
   flutter build web --release
   ```
2. Serve:
   ```bash
   cd build/web && python -m http.server 8080
   ```
3. Config:
   ```yaml
   baseUrl: http://localhost:8080
   ```
4. Tests: use semantics/selectors. Flutter Web renders to canvas by default; enable HTML renderer for easier selection:
   ```bash
   flutter build web --web-renderer html
   ```

## Native mobile workflow

```bash
# Android emulator
flutter emulators --launch Pixel_7
flutter drive --target=test_driver/app.dart -d emulator-5554
```

WiraXplore config:
```yaml
flutter:
  enabled: true
  deviceId: emulator-5554
  driverPort: 4444
```

## Shared test layer
Keep selectors/page objects in `packages/testkit` so web (Lightpanda) and mobile (Flutter driver) reuse them.

## Roadmap
- Flutter driver bridge in WiraXplore CLI (`WiraXplore flutter:drive`).
- Unified report merging web + mobile results.
