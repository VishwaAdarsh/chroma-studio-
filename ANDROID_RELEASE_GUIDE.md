# Chroma Studio — Android Packaging & Release Guide

## 1. Project & Application Metadata

| Parameter | Value | Location |
| :--- | :--- | :--- |
| **App Name** | Chroma Studio | `capacitor.config.ts`, `android/app/src/main/res/values/strings.xml` |
| **Package ID / Namespace** | `studio.chroma.photoeditor` | `capacitor.config.ts`, `android/app/build.gradle`, `AndroidManifest.xml` |
| **Version Name** | `1.0` | `android/app/build.gradle` |
| **Version Code** | `1` | `android/app/build.gradle` |
| **Minimum SDK** | `24` (Android 7.0 Nougat) | `android/variables.gradle` |
| **Target / Compile SDK**| `36` (Android 15+) | `android/variables.gradle` |
| **Capacitor Plugins** | `@capacitor/app@7.1.2`, `@capacitor/status-bar@7.0.6` | `package.json`, `android/` |
| **Background Color** | `#070B14` (Deep space dark) | `capacitor.config.ts`, `styles.xml` |
| **Android Scheme** | `https` | `capacitor.config.ts` |

---

## 2. Security & Environment Configuration

### Server-Side AI Secret Separation
- **No Provider Secrets in Bundle**: The client build contains zero Gemini, OpenAI, or 3rd-party provider API keys.
- **Client Configuration**: Only public client credentials (`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`) are bundled.
- **Edge Function Routing**: All AI operations (`ai-assistant`, `ai-image-gen`, `ai-background-gen`) execute within authenticated Supabase Edge Functions with `GEMINI_API_KEY` stored securely in the Supabase secret store.

### Release Keystore & Password Handling
- **Git Protection**: `*.keystore`, `*.jks`, `keystore.properties`, and `signing.properties` are strictly excluded in both the project root `.gitignore` and `android/.gitignore`.
- **Credential Storage**: Credentials are read dynamically by `android/app/build.gradle` from either:
  1. A local, untracked `android/keystore.properties` file (see template `android/keystore.properties.example`).
  2. Or CI/CD Environment Variables:
     - `KEYSTORE_PATH`
     - `KEYSTORE_PASSWORD`
     - `KEY_ALIAS`
     - `KEY_PASSWORD`
- **Keystore Parameters**:
  - Algorithm: RSA 2048-bit
  - Validity: 10,000 days
  - Signature Schemes: APK Signature Scheme v2 (Full-APK Signature)

---

## 3. Build & Packaging Pipeline

### Step 1: Web Application Production Build
Compile TypeScript and bundle optimized assets using Vite:
```powershell
npm run build
```
- **Output**: `dist/` (HTML, CSS, chunked JS bundles)
- **Time**: ~624ms

### Step 2: Capacitor Asset Sync
Copy web distribution assets and configure Android native wrapper:
```powershell
npx cap sync android
```
- Copies web assets to `android/app/src/main/assets/public/`
- Generates `capacitor.config.json` and updates native plugin bridges

### Step 3: Android Release Build (Gradle)
Run the release build using the Android Studio JDK (`jbr` Java 21) and Android SDK:
```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:ANDROID_HOME = "C:\Users\Pradeep\AppData\Local\Android\Sdk"
$env:PATH = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:PATH"

cd android
.\gradlew.bat assembleRelease bundleRelease
```

---

## 4. Release Artifacts & Verification

### Output Locations

| Artifact Type | File Path | File Size | Target Usage |
| :--- | :--- | :--- | :--- |
| **Signed APK** | `android/app/build/outputs/apk/release/app-release.apk` | **3.44 MB** (3,443,885 bytes) | Direct device sideloading, QA & testing |
| **Signed App Bundle** | `android/app/build/outputs/bundle/release/app-release.aab` | **3.30 MB** (3,300,668 bytes) | Google Play Console production release |

### Signature Verification
The generated APK was verified using the official Android SDK `apksigner`:
```powershell
& "$env:ANDROID_HOME\build-tools\35.0.0\apksigner.bat" verify --verbose --print-certs "android\app\build\outputs\apk\release\app-release.apk"
```
**Verification Output:**
- `Verifies: true`
- `Verified using v2 scheme (APK Signature Scheme v2): true`
- `Number of signers: 1`
- `Signer DN: CN=Chroma Studio, OU=Chroma Studio Team, O=Chroma Studio, L=San Francisco, ST=CA, C=US`
- `SHA-256 Digest: d6f22ff931a0cdf7cd34268596b6050c4b28966dae99fdecf24cf6faac421953`

---

## 5. Device Installation & Critical Workflow Checklist

### Connecting a Device via ADB
1. Enable **Developer Options** on the Android device (tap *Build Number* 7 times in Settings > About Phone).
2. Enable **USB Debugging** in Developer Options.
3. Connect the phone via USB cable and select **Transfer files** / **MTP** mode.
4. On the computer, verify connection:
   ```powershell
   & "$env:ANDROID_HOME\platform-tools\adb.exe" devices -l
   ```
   Accept the authorization prompt on the device screen if prompted ("Always allow from this computer").

### Direct Installation
```powershell
& "$env:ANDROID_HOME\platform-tools\adb.exe" install -r "android\app\build\outputs\apk\release\app-release.apk"
```

### Launch Application
```powershell
& "$env:ANDROID_HOME\platform-tools\adb.exe" shell am start -n studio.chroma.photoeditor/.MainActivity
```

### Critical Workflow Test Matrix
Once installed on the target device, verify the following 7 core journeys:
1. **App Launch & Shell**:
   - Splash screen displays `#070B14` without white flash.
   - Status bar styling matches dark interface theme.
2. **Photo Ingestion**:
   - Tap "Open Photo" or "Upload Image" and pick an image from device gallery.
   - Verify image renders on Canvas without distortion.
3. **Non-Destructive Adjustments**:
   - Adjust Exposure, Contrast, Highlights, Shadows sliders.
   - Adjust HSL Color Mixer and Curves.
   - Tap "Compare" (holding before/after) to verify real-time split view.
4. **AI Capabilities**:
   - Open AI Assistant and input a natural language prompt (e.g., *"Make it cinematic and warm"*).
   - Verify plan generation (via Supabase Edge Function or local semantic fallback) and previewing.
   - Test Smart Presets recommendation.
5. **History & Undo/Redo**:
   - Make 3 distinct adjustments; tap Undo twice and Redo once.
   - Verify pixel and state fidelity.
6. **Project Persistence**:
   - Save project or navigate to "My Projects" dashboard; verify thumbnail and state retention.
7. **Export & Sharing**:
   - Export image in JPEG, PNG, and WebP formats.
   - Verify saved file in device gallery / Downloads folder.

---

## 6. Device Audit Findings & Release Limitation

> [!WARNING]
> **Real Device Verification Status**:
> An ADB hardware bus audit detected that a Samsung device (`Vishwa.Adarsh`, serial `R9ZY30TWWBH`) was previously paired to this system, but is currently **disconnected** (`CM_PROB_PHANTOM` / Code 45).
>
> In accordance with release governance:
> **The release build cannot be certified as production-ready until it has been installed and verified on a physical Android device.**
>
> To complete final certification, plug in the Android device with USB debugging enabled, run `adb install -r ...`, and execute the test checklist above.

---

## 7. Web Test Suite & Build Summary

- **Web Unit & Integration Tests**: `npm test -- --run`
  - **Results**: **21 passed (21 test files), 257 passed (257 tests)**
  - **Duration**: 2.36s
- **Web Production Build**: `npm run build`
  - **TypeScript**: `tsc -b` passed with 0 errors
  - **Vite Bundler**: Clean production distribution generated in `dist/`
