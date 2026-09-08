import {existsSync} from 'node:fs';
import {readFile,writeFile,mkdir,copyFile,readdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
function cap(...args){const r=spawnSync(process.execPath,['node_modules/@capacitor/cli/bin/capacitor',...args],{stdio:'inherit'});if(r.status!==0)process.exit(r.status||1);}
if(!existsSync('android'))cap('add','android');
cap('sync','android');
const dir='android/app/src/main/java/hotel/shanshui/validation';await mkdir(dir,{recursive:true});
for(const name of await readdir('native'))if(name.endsWith('.java'))await copyFile(`native/${name}`,`${dir}/${name}`);
const manifest='android/app/src/main/AndroidManifest.xml';
let xml=await readFile(manifest,'utf8');
xml=xml.replace('android:allowBackup="true"','android:allowBackup="false"').replace(/\s*<uses-permission android:name="android.permission.INTERNET"\s*\/>/,'');
await writeFile(manifest,xml);
await writeFile('android/app/src/main/res/xml/file_paths.xml','<?xml version="1.0" encoding="utf-8"?><paths><files-path name="exports" path="exports/" /></paths>');
const gradle='android/app/build.gradle';let source=await readFile(gradle,'utf8');
if(!source.includes('applicationId "hotel.shanshui.validation"'))throw new Error('Unexpected applicationId');
const code=Number(process.env.GITHUB_RUN_NUMBER||1);if(!Number.isSafeInteger(code)||code<1||code>2000000000)throw new Error('Invalid build number');
source=source.replace(/versionCode \d+/,`versionCode ${code}`).replace(/versionName "[^"]+"/,`versionName "0.1.${code}-stage1"`);
await writeFile(gradle,source);
console.log('Prepared synthetic-only Android stage1, network permission and cloud backup disabled');
