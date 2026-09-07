#!/usr/bin/env bash
set -euo pipefail
# Runs only in CI. Never install an SDK into the developer workstation.
test "${GITHUB_ACTIONS:-}" = true
sdk="$RUNNER_TEMP/stage1-android-sdk"
mkdir -p "$sdk/cmdline-tools"
curl --fail --location --retry 3 --max-time 180 https://dl.google.com/android/repository/commandlinetools-linux-15859902_latest.zip -o "$RUNNER_TEMP/stage1-sdk.zip"
printf '%s  %s\n' '4e4c464f145a7512b57d088ac6c278c03c9eea610886b35a5e0804e74eedf583' "$RUNNER_TEMP/stage1-sdk.zip" | sha256sum --check
unzip -q "$RUNNER_TEMP/stage1-sdk.zip" -d "$sdk/unpacked"
mv "$sdk/unpacked/cmdline-tools" "$sdk/cmdline-tools/latest"
manager="$sdk/cmdline-tools/latest/bin/sdkmanager"
printf 'y\n%.0s' {1..100} | "$manager" --sdk_root="$sdk" --licenses > /dev/null
"$manager" --sdk_root="$sdk" 'platforms;android-36' 'build-tools;36.0.0'
printf 'ANDROID_HOME=%s\nANDROID_SDK_ROOT=%s\n' "$sdk" "$sdk" >> "$GITHUB_ENV"

