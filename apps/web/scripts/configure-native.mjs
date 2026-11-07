import {existsSync,readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join,dirname} from 'node:path';
const root=process.cwd();
function patch(path,transform){
 if(!existsSync(path))throw new Error('Missing generated Capacitor platform; run npx cap add first: '+path);
 const source=readFileSync(path,'utf8'),updated=transform(source);
 if(updated===source){console.log('Already configured',path);return}
 writeFileSync(path,updated);console.log('Updated',path);
}
const plist=join(root,'ios/App/App/Info.plist');
const iosKeys=[
 ['NSLocationWhenInUseUsageDescription',
  'USKORUN uses your phone location during a walk or run to estimate distance and demo points.'],
 ['NSLocationAlwaysAndWhenInUseUsageDescription',
  'When you start a walk or run, USKORUN continues collecting route points while your phone is locked or you take a call. Demo points are only credited after server review.']
];
patch(plist,source=>{
 let s=source;
 if(!s.includes('</dict>'))throw new Error('Invalid Info.plist');
 for(const [key,value] of iosKeys){
  if(!s.includes('<key>'+key+'</key>'))
   s=s.replace('</dict>',`<key>${key}</key>\n<string>${value}</string>\n</dict>`);
 }
 if(!s.includes('<key>UIBackgroundModes</key>'))
  s=s.replace('</dict>','<key>UIBackgroundModes</key>\n<array><string>location</string></array>\n</dict>');
 else if(!/<key>UIBackgroundModes<\/key>\s*<array>[\s\S]*?<string>location<\/string>/.test(s))
  throw new Error('Existing UIBackgroundModes does not declare location; merge carefully without changing other modes');
 return s;
});
const manifest=join(root,'android/app/src/main/AndroidManifest.xml');
const permissions=[
 'android.permission.ACCESS_FINE_LOCATION',
 'android.permission.ACCESS_COARSE_LOCATION',
 'android.permission.ACCESS_BACKGROUND_LOCATION',
 'android.permission.FOREGROUND_SERVICE',
 'android.permission.FOREGROUND_SERVICE_LOCATION',
 'android.permission.POST_NOTIFICATIONS'
];
patch(manifest,source=>{
 let s=source;
 if(!s.includes('<application'))throw new Error('Invalid AndroidManifest.xml');
 for(const name of permissions)if(!s.includes('android:name="'+name+'"'))
  s=s.replace('<application',`<uses-permission android:name="${name}" />\n<application`);
 return s;
});
const strings=join(root,'android/app/src/main/res/values/uskorun_background_location.xml');
mkdirSync(dirname(strings),{recursive:true});
writeFileSync(strings,`<?xml version="1.0" encoding="utf-8"?>
<resources>
  <string name="capacitor_background_geolocation_notification_channel_name">USKORUN route recording</string>
  <string name="capacitor_background_geolocation_notification_title">USKORUN GPS tracking</string>
</resources>
`);
console.log('Native background permissions updated. Verify merged Android manifest and iOS entitlements before any store submission.');
