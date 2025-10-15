# Android App Build Guide for Wrestling Sparring Timer

This guide will walk you through converting your PWA into a native Android app that can be published on the Google Play Store.

## Prerequisites

1. **Node.js and npm** (already installed)
2. **Android Studio** - Download from: https://developer.android.com/studio
3. **Java Development Kit (JDK)** - Usually comes with Android Studio

## Step 1: Install Capacitor

Open your terminal in the project directory and run:

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android
```

## Step 2: Initialize Capacitor

Run the initialization command:

```bash
npx cap init
```

You'll be prompted for the following information:

- **App name**: `Wrestling Sparring Timer`
- **App ID (package name)**: `com.wrestlingsparring.app`
  - Use reverse domain notation (com.yourname.appname)
  - This CANNOT be changed later, so choose carefully
  - Must be unique on the Play Store
- **Web asset directory**: `dist` (press Enter to accept default)

## Step 3: Build Your Web App

Build the production version of your web app:

```bash
npm run build
```

This creates optimized files in the `dist` folder.

## Step 4: Add Android Platform

Add the Android platform to your project:

```bash
npx cap add android
```

This creates an `android` folder with all necessary Android project files.

## Step 5: Sync Web Assets to Android

Sync your built web app to the Android project:

```bash
npx cap sync
```

Run this command every time you make changes to your web app.

## Step 6: Configure Android App

### Update App Icons

1. Navigate to `android/app/src/main/res/`
2. Replace the default icons in `mipmap-*` folders with your app icons
3. Use Android Studio's Image Asset tool for easy icon generation:
   - Right-click `res` folder → New → Image Asset
   - Select your icon image
   - Generate all sizes

### Update App Name and Theme

Edit `android/app/src/main/res/values/strings.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">Wrestling Sparring Timer</string>
    <string name="title_activity_main">Wrestling Sparring Timer</string>
    <string name="package_name">com.wrestlingsparring.app</string>
    <string name="custom_url_scheme">com.wrestlingsparring.app</string>
</resources>
```

### Set App Permissions

Edit `android/app/src/main/AndroidManifest.xml` to add any required permissions:

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.VIBRATE" />
<uses-permission android:name="android.permission.WAKE_LOCK" />
```

## Step 7: Open in Android Studio

Open the Android project:

```bash
npx cap open android
```

Wait for Android Studio to:
- Index the project
- Download dependencies
- Sync Gradle files

## Step 8: Test on Emulator or Device

### Using Android Emulator:

1. In Android Studio: Tools → Device Manager
2. Create a new Virtual Device (recommended: Pixel 5 with Android 13+)
3. Click Run (green play button) to launch on emulator

### Using Physical Device:

1. Enable Developer Mode on your Android phone:
   - Go to Settings → About Phone
   - Tap "Build Number" 7 times
2. Enable USB Debugging:
   - Settings → Developer Options → USB Debugging
3. Connect phone via USB
4. Click Run in Android Studio

## Step 9: Generate Signed APK/AAB for Play Store

### Create a Keystore (First Time Only)

1. In Android Studio: Build → Generate Signed Bundle/APK
2. Select "Android App Bundle" (AAB format required for Play Store)
3. Click "Create new..." under Key store path
4. Fill in the form:
   - **Key store path**: Choose a secure location (NOT in your project folder)
   - **Password**: Create a strong password
   - **Alias**: Your app name or identifier
   - **Validity**: 25 years (standard)
   - Fill in certificate info (name, organization, etc.)
5. Click OK

**CRITICAL**: Save your keystore file and passwords securely. You CANNOT update your app without them!

### Generate Release Build

1. Build → Generate Signed Bundle/APK
2. Select "Android App Bundle" (.aab)
3. Select your keystore file
4. Enter keystore password and key password
5. Select build variant: **release**
6. Check both signature versions (V1 and V2)
7. Click Finish

Your signed AAB file will be in: `android/app/release/app-release.aab`

## Step 10: Prepare for Play Store

### Create Play Store Assets

You'll need:

1. **App Icon**: 512x512 PNG (no transparency)
2. **Feature Graphic**: 1024x500 JPG/PNG
3. **Screenshots**: At least 2 phone screenshots (minimum 320px)
4. **Short Description**: Max 80 characters
5. **Full Description**: Max 4000 characters
6. **Privacy Policy URL** (required if app collects data)

### Create Google Play Developer Account

1. Go to: https://play.google.com/console
2. Pay one-time $25 registration fee
3. Complete account setup

### Upload Your App

1. Click "Create app" in Play Console
2. Fill in app details:
   - App name: Wrestling Sparring Timer
   - Default language: English
   - App or Game: App
   - Free or Paid: Free
3. Complete all required sections:
   - Store listing (descriptions, graphics, screenshots)
   - Content rating questionnaire
   - Target audience
   - Privacy policy
4. Go to "Release" → "Production"
5. Click "Create new release"
6. Upload your `app-release.aab` file
7. Fill in release notes
8. Click "Review release"
9. Submit for review

### Review Process

- Google typically reviews apps in 1-7 days
- You'll receive email updates on review status
- Fix any issues flagged by reviewers
- Once approved, your app goes live!

## Updating Your App

When you make changes to your web app:

```bash
# 1. Make your changes to React code
# 2. Build the web app
npm run build

# 3. Sync to Android
npx cap sync

# 4. Open in Android Studio
npx cap open android

# 5. Increment version in android/app/build.gradle
# Find and update:
versionCode 2  // Increment by 1
versionName "1.1.0"  // Update version string

# 6. Generate new signed AAB
# 7. Upload to Play Console as new release
```

## Troubleshooting

### Build Errors

- Clean project: Build → Clean Project
- Invalidate caches: File → Invalidate Caches / Restart
- Check Gradle sync completed successfully

### App Crashes

- Check logcat in Android Studio for error messages
- Verify all required permissions are in AndroidManifest.xml
- Test on physical device if emulator issues persist

### Capacitor Sync Issues

```bash
# Clear Capacitor cache and reinstall
npx cap sync --force
```

## Useful Commands Reference

```bash
# Build web app
npm run build

# Sync web changes to Android
npx cap sync

# Open Android Studio
npx cap open android

# Update Capacitor
npm update @capacitor/core @capacitor/cli @capacitor/android

# Copy web assets only
npx cap copy

# Update native plugins
npx cap update
```

## Additional Resources

- **Capacitor Documentation**: https://capacitorjs.com/docs
- **Android Developer Guide**: https://developer.android.com/guide
- **Play Console Help**: https://support.google.com/googleplay/android-developer
- **App Signing Best Practices**: https://developer.android.com/studio/publish/app-signing

## Notes

- Keep your keystore file backed up in multiple secure locations
- Never commit keystore files to version control
- Test thoroughly on multiple Android devices/versions before release
- Monitor Play Console for crash reports and user feedback
- Respond to user reviews to maintain good app rating

Good luck with your app launch! 🎉
