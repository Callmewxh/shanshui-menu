#!/usr/bin/env bash
set -euo pipefail
mkdir -p artifacts
apk=android/app/build/outputs/apk/debug/app-debug.apk
tools="$ANDROID_HOME/build-tools/36.0.0"
"$tools/apksigner" verify --verbose --print-certs "$apk" > artifacts/signature.txt
"$tools/aapt" dump badging "$apk" > artifacts/apk-metadata.txt
grep -q "name='hotel.shanshui.validation'" artifacts/apk-metadata.txt
if grep -q 'android.permission.INTERNET' artifacts/apk-metadata.txt; then exit 1; fi
"$tools/aapt" dump xmltree "$apk" AndroidManifest.xml > artifacts/manifest.txt
if grep -q 'android:testOnly.*0xffffffff' artifacts/manifest.txt; then exit 1; fi
unzip -l "$apk" > artifacts/apk-files.txt
grep -q 'assets/public/fonts/NotoSansSC.ttf' artifacts/apk-files.txt
grep -q 'assets/public/fixture.png' artifacts/apk-files.txt
if grep -E 'menu-config.json|google-services.json|ss_menu_v1|data/img/' artifacts/apk-files.txt; then exit 1; fi
cp "$apk" artifacts/shanshui-stage1.apk
cp ../../docs/DECISIONS.md artifacts/TEST-CHECKLIST.md
cp public/fonts/OFL.txt artifacts/FONT-LICENSE.txt
printf 'commit=%s\nrun=%s\nappId=hotel.shanshui.validation\nsigning=ephemeral-debug\nandroidBehavior=pending-real-tablet\n' "$GITHUB_SHA" "$GITHUB_RUN_ID" > artifacts/build-info.txt
(cd artifacts && sha256sum shanshui-stage1.apk > SHA256SUMS.txt)
