# Building Hamaar Kissa for Android (Play Store)

## Prerequisites
- Expo account: mahesh.gkp@gmail.com
- Google Play Developer account ($25 one-time fee at play.google.com/console)

## First-time setup (run once)

```bash
# 1. Go into the mobile project folder
cd artifacts/mobile

# 2. Log in with your Expo account
eas login
# Enter email: mahesh.gkp@gmail.com and your password

# 3. Link this project to your Expo account (creates it on expo.dev)
eas init
# Answer "y" when asked to create a new project
# It will automatically update app.json with your projectId
```

## Build the Android AAB (for Play Store)

```bash
cd artifacts/mobile
eas build --platform android --profile production
```

- EAS compiles the app on Expo's cloud servers (~10-20 minutes)
- When done, it prints a download URL for the `.aab` file
- Download it and upload to Google Play Console

## Build a test APK (install directly on phone)

```bash
cd artifacts/mobile
eas build --platform android --profile preview
```

This produces an APK you can send to testers and install directly.

## App details
- Package name: `com.haamarkissa.app`
- Version: 1.0.0 (versionCode 1)
- Bundle ID (iOS): `com.haamarkissa.app`

## Play Store upload steps
1. Go to https://play.google.com/console
2. Create a new app → "Hamaar Kissa"
3. Fill in store listing (title, description, screenshots)
4. Go to "Production" → "Releases" → Create release
5. Upload the `.aab` file from EAS
6. Submit for review
