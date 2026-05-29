# Running Paint Marker on your Android phone

Capacitor is **already set up** in this repo (app name `Paint Marker`,
package `com.paintmarker.app`, camera permission added). You only need to
build it and run it on your phone. The build itself must happen on your own
computer — it needs Android Studio and the Android SDK.

## What you need (one-time)

1. **Node.js** (v18+): https://nodejs.org
2. **Android Studio**: https://developer.android.com/studio
   (it installs the Android SDK and the JDK for you)
3. An **Android phone** with a USB cable, or use the built-in emulator.

## Get the code onto your computer

```bash
git clone https://github.com/poilochio/Sparringtimer.git
cd Sparringtimer
git checkout claude/camera-paint-marking-app-Hp9OU
npm install
```

## Build and open in Android Studio

One command does everything (build the web app, copy it into the Android
project, and open Android Studio):

```bash
npm run android
```

(That's a shortcut for `vite build && npx cap sync android && npx cap open android`.)

Android Studio will open and sync Gradle — give it a minute the first time.

## Run it on your phone

### Option A — your physical phone (recommended, so the camera works)

1. On the phone: **Settings → About phone → tap "Build number" 7 times** to
   unlock Developer options.
2. **Settings → Developer options → enable "USB debugging"**.
3. Plug the phone into your computer with USB and accept the debugging prompt
   on the phone.
4. In Android Studio, pick your phone from the device dropdown at the top and
   press the green **Run** ▶ button.
5. The app installs and launches. The **first time you open the camera it asks
   for camera permission — tap Allow.** Then aim, zoom, and hit the red button
   to mark with paint.

### Option B — emulator

The Android emulator can simulate a camera, but the live image is a synthetic
scene. For the real experience use a physical phone. To try the emulator:
Android Studio → **Device Manager → Create device** (e.g. Pixel 7, Android 13+),
then press **Run**.

## After you change the web code

```bash
npm run cap:sync   # rebuilds the web app and copies it into the Android project
```

then press **Run** again in Android Studio.

## Building a shareable / Play Store package

To hand the app to someone else or publish it, generate a signed build:

1. In Android Studio: **Build → Generate Signed Bundle / APK**
2. Choose **APK** (to sideload onto a phone) or **Android App Bundle (.aab)**
   (required for the Play Store).
3. Create a keystore the first time (**keep the keystore file and passwords
   safe — you can't update the app without them**), then finish the wizard.
4. An installable `.apk` ends up under `android/app/release/`. Copy it to a
   phone and open it to install (you'll need to allow "install from unknown
   sources").

For full Play Store publishing steps (store listing, signing, review), see
Capacitor's and Google's docs:

- Capacitor Android workflow: https://capacitorjs.com/docs/android
- Play Console: https://play.google.com/console

## Troubleshooting

- **Camera is black / "permission denied":** make sure you tapped *Allow* on
  the camera prompt. If you dismissed it, go to the phone's
  **Settings → Apps → Paint Marker → Permissions → Camera → Allow**.
- **Gradle sync fails:** Android Studio → **File → Invalidate Caches / Restart**,
  and let it finish downloading SDK components.
- **`npx cap open android` does nothing:** open the `android/` folder directly
  in Android Studio instead.
- **Changes don't show up:** you must run `npm run cap:sync` after editing the
  web code, then Run again.
