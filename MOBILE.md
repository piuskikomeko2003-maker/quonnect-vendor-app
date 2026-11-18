# Running Quonnect Vendor on Android (Capacitor)

The app is bundled into the APK — there is **no** `server.url`. The Next.js
static export in `out/` is copied into `android/app/src/main/assets/public`
by `npx cap sync`.

## Prerequisites (already installed on this machine)

- Node 20+ and npm
- Android Studio + Android SDK (platform 36, build-tools 35+)
- **JDK 21** — Capacitor 8 compiles Android with Java 21.
  Installed with `brew install openjdk@21`.
- `.env.local` containing `NEXT_PUBLIC_SUPABASE_URL` and
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` (already present)

Java 21 is keg-only, so export it before any Android/Gradle command:

```bash
export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
```

The Node scripts themselves (`npm run build:mobile`) do not need Java.

## Build the web bundle and sync it

```bash
npm run build:mobile     # MOBILE_BUILD=1 next build && npx cap sync
```

`MOBILE_BUILD=1` turns on `output: "export"`, `trailingSlash` and
`images.unoptimized`. The normal `npm run build` / `npm start` web flow is
unchanged.

## Run on a USB-connected phone

1. On the phone: Settings → About phone → tap **Build number** 7 times.
2. Settings → System → Developer options → enable **USB debugging**.
3. Connect USB, choose **File transfer / Allow USB debugging** on the phone.
4. Verify the laptop sees it:

   ```bash
   adb devices
   ```

5. Build, install and launch:

   ```bash
   export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
   npm run android
   ```

   With multiple transports (USB + wireless debugging) `cap run android` asks
   which device to use. You can also install the APK directly (below).

## Build a debug APK to send to the phone

```bash
export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
npm run apk:debug
```

Output:

```
android/app/build/outputs/apk/debug/app-debug.apk
```

Install it over USB:

```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

Or copy the APK to the phone (WhatsApp/Drive/USB), open it in Files and allow
"Install unknown apps" for that file manager.

## Supabase auth in the app

- Sessions are stored in `localStorage` (`@supabase/supabase-js`), not cookies,
  and survive app restarts.
- Android email/OAuth links use the custom scheme
  `com.quonnect.vendor:///auth/confirm`. Add this exact URL to
  **Supabase → Authentication → URL Configuration → Redirect URLs**.
- For the simplest local testing, turn **off** "Confirm email" in Supabase Auth
  settings, or the link opens Gmail/Chrome and may not have the PKCE verifier.
- Password reset uses the same deep link with `?next=/settings`.

## After changing web code

```bash
npm run build:mobile
```

Capacitor's `android/` native project does not need to be regenerated; the
command re-copies `out/` for you.
