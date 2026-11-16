# Optional Android: preparation only, unavailable

There is **no ASHEN VOW APK**, install/play result or supported-phone claim. Windows portable delivery is independent. Current keyboard/controller gameplay has **no complete touch adaptation**. A correctly signed export would still only be an internal experiment, not a public mobile release. Landscape is configured; touch movement/camera/actions, simultaneous pointers, safe-area HUD, touch-labelled menus, mobile low defaults and background/resume/save-update device acceptance remain unimplemented/unverified. Existing focus-loss input clearing does not establish Android lifecycle correctness.

## Exact pinned-engine requirements

Checked 2026-11-16 against the **4.7.2-stable tagged source**, which differs from the generic 4.7 documentation's older SDK examples:

| Component | Required preparation |
|---|---|
| Engine/templates | Godot 4.7.2 stable **standard**, Android release APK template with pinned SHA-256 in engine-version.json |
| JDK | **17**, with java/keytool/jarsigner; source uses JavaVersion.VERSION_17 |
| SDK platform / compile / target | **android-36 / 36 / 36** |
| Minimum API | **24** (Android 7.0), engine floor, not measured device support |
| Build tools | **36.1.0**, including apksigner, zipalign and aapt |
| SDK tools | platform-tools (adb), command-line sdkmanager; install through official Android SDK Manager, tool package revisions recorded by sdkmanager --list_installed |
| Architecture | arm64-v8a only, Compatibility/OpenGL ES 3-capable device; other ABIs disabled |
| Optional custom Gradle | Wrapper **8.11.1**, Android Gradle plugin **8.6.1**, Kotlin **2.1.21**, NDK **29.0.14206865** |

Sources: [tagged config.gradle](https://raw.githubusercontent.com/godotengine/godot/4.7.2-stable/platform/android/java/app/config.gradle), [tagged Gradle wrapper](https://raw.githubusercontent.com/godotengine/godot/4.7.2-stable/platform/android/java/gradle/wrapper/gradle-wrapper.properties), [tagged export options](https://raw.githubusercontent.com/godotengine/godot/4.7.2-stable/platform/android/export/export_plugin.cpp), [official export guide](https://docs.godotengine.org/en/4.7/tutorials/export/exporting_for_android.html). Tagged source wins over the guide's SDK35/build-tools35 example for this pinned release. Recheck all together before changing engine versions. Current machine has no configured Android SDK/signing identity/device; its existing Java installation is not assumed to satisfy this JDK17 pin.

The preset **Android Experimental** uses the prebuilt template route (`use_gradle_build=false`), so no local NDK/Gradle project is required. If adding native plugins/custom Android code, install the exact matching Android build template through Godot **Project → Install Android Build Template**, enable Gradle in that preset and use the versions above; generated `game/android/` stays ignored. Do not fetch the newest arbitrary Gradle/NDK. The project's helper has not validated that optional custom route.

## Install prerequisites yourself

Use official [Android Studio/SDK tools](https://developer.android.com/studio) and a JDK17 distribution; inspect its installer/source and choose a local path. No script silently installs a global SDK/JDK. Typical SDK directory is `%LOCALAPPDATA%\Android\Sdk`, but obtain the actual path from Android Studio **Settings → Languages & Frameworks → Android SDK**. Obtain the JDK root from your JDK installation (the folder containing bin/java.exe).

From repository root, set shell-local paths and install exact SDK packages (sdkmanager prompts for licenses; accept only after reviewing them):

```powershell
Set-Location 'C:\Users\debajyothi.m\wuk\ashen-vow'
$env:JAVA_HOME=Read-Host 'Enter full JDK17 installation directory'
$env:ANDROID_HOME=Read-Host 'Enter full Android SDK directory from Android Studio'
& (Join-Path $env:ANDROID_HOME 'cmdline-tools\latest\bin\sdkmanager.bat') 'platform-tools' 'platforms;android-36' 'build-tools;36.1.0'
& (Join-Path $env:ANDROID_HOME 'cmdline-tools\latest\bin\sdkmanager.bat') --licenses
& (Join-Path $env:ANDROID_HOME 'cmdline-tools\latest\bin\sdkmanager.bat') --list_installed
python .\tools\fetch_windows_templates.py --android
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\android.ps1 -CheckOnly
```

The range fetcher verifies official engine-template CRC/SHA; cached `android_release.apk` is **Godot's unexported template**, not the game's APK and never a player download. If a proxy blocks it, install 4.7.2 standard export templates via Godot's manager and pass `-TemplateDirectory` to the helper. In Godot **Editor Settings → Export → Android**, set Java SDK Path and Android SDK Path if exporting manually. The helper instead copies the pinned engine to ignored `tools/cache/android-editor`, writes `_sc_` and isolated editor settings, preserving your global settings.

## Signed internal build

Stable application ID comes from `release-config.json`: **org.ashenvow.game**; initial Android code **4001**. Transient export overrides derive version/name/code/ID from that file. Preserve ID, signing identity and save schema across updates. Raising version code is mandatory for later distributed APKs; uninstalling generally deletes app data. Do not claim save continuity until `adb install -r` update acceptance on real devices.

Create a private release identity only if you intend to maintain Android distribution. From the root, choose an **external private folder**, back up the keystore securely and use interactive password prompts (Godot's template route expects the key and store passwords to match):

```powershell
Set-Location 'C:\Users\debajyothi.m\wuk\ashen-vow'
$keyPath=Read-Host 'Enter absolute private keystore path outside the repository'
& (Join-Path $env:JAVA_HOME 'bin\keytool.exe') -genkeypair -v -keystore $keyPath -alias ashenvow -keyalg RSA -keysize 3072 -validity 10000
$env:GODOT_ANDROID_KEYSTORE_RELEASE_PATH=$keyPath
$env:GODOT_ANDROID_KEYSTORE_RELEASE_USER='ashenvow'
$secret=Read-Host 'Keystore/key password' -AsSecureString
$credential=New-Object System.Management.Automation.PSCredential('unused',$secret)
$env:GODOT_ANDROID_KEYSTORE_RELEASE_PASSWORD=$credential.GetNetworkCredential().Password
try {
    powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\android.ps1 -InternalBuild
} finally {
    Remove-Item Env:\GODOT_ANDROID_KEYSTORE_RELEASE_PASSWORD -ErrorAction SilentlyContinue
}
```

Helper checks JDK17/SDK/template/secret presence, exports release with environment-provided signing, runs `apksigner verify --verbose --print-certs`, inspects manifest and rejects network/storage/camera/microphone permissions, then hashes final bytes. It refuses replacing an existing `exports/android/AshenVow-internal.apk`. Output is **signed internal/unverified**, not a debug/public artifact. No result is claimed until commands actually succeed. Export/signature path is **not run here** because SDK/key are missing.

If internal build succeeded and a suitable authorized device is attached, from root (this installs an app, so do it deliberately on your device):

```powershell
Set-Location 'C:\Users\debajyothi.m\wuk\ashen-vow'
& (Join-Path $env:ANDROID_HOME 'platform-tools\adb.exe') devices
& (Join-Path $env:ANDROID_HOME 'platform-tools\adb.exe') install -r .\exports\android\AshenVow-internal.apk
```

Do not offer a public APK until touch/multitouch, safe areas/aspect ratios, menus, background/resume, focus resets, whole campaign, signed update/save persistence, thermal/render performance and clean install have passed on recorded devices. No Android download button exists. The release metadata/site generator currently rejects a mobile distribution claim by keeping Android unavailable.

## Optional CI

**Settings → Environments → android-internal**: configure reviewers/branch restrictions as appropriate. **Settings → Secrets and variables → Actions → Variables**: set `ENABLE_ANDROID_INTERNAL=true` only when intentionally enabling this internal workflow. Secrets (environment or repository):

- `ANDROID_KEYSTORE_BASE64`: Base64 of your backed-up keystore, not a file committed to Git.
- `ANDROID_KEY_ALIAS`: its real alias.
- `ANDROID_KEY_PASSWORD`: matching store/key password.

The manual **Android internal experiment (not mobile support)** workflow uses hosted JDK17, installs exact SDK packages, fetches the pinned template, decodes the key only to RUNNER_TEMP, exports/verifies and removes the temporary key in finally. It uploads a seven-day **internal UNTESTED** Actions artifact, never a GitHub release/Pages button. Hosted SDK provisioning and APK build were not run here. Missing secrets, runner SDK tools, license acceptance or identity mismatch must fail visibly; never substitute a fake/debug APK as public signed distribution.
