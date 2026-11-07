import {existsSync,mkdirSync,copyFileSync,readFileSync,writeFileSync} from 'node:fs';
import {join,dirname} from 'node:path';
// Local generated-platform integration. Does not run CocoaPods, Gradle,
// Railway, App Store or any network process. Idempotent and fail-closed.
const root=process.cwd(),src=join(root,'native-plugins/durable-location');
function edit(path,fn){
 if(!existsSync(path))throw new Error('Generated platform missing: '+path);
 const old=readFileSync(path,'utf8'),next=fn(old);
 if(next!==old){writeFileSync(path,next);console.log('Patched',path)}
}
function copy(from,to){
 if(!existsSync(from))throw new Error('Missing native owned source '+from);
 mkdirSync(dirname(to),{recursive:true});copyFileSync(from,to);
}
const iosBase=join(root,'ios/App/App');
if(existsSync(iosBase)){
 for(const file of ['USKDiskQueue.swift','USKLocationRecorder.swift','USKDurableLocationPlugin.swift','USKBridgeViewController.swift'])
  copy(join(src,'ios',file),join(iosBase,'USKDurableLocation',file));
 const delegate=join(iosBase,'AppDelegate.swift');
 edit(delegate,s=>{
  if(s.includes('USKLocationRecorder.shared.restoreAfterLaunch'))return s;
  const key='didFinishLaunchingWithOptions';
  const i=s.indexOf(key);
  if(i<0)throw new Error('Cannot safely patch iOS AppDelegate: didFinishLaunch missing');
  const opening=s.indexOf('{',i);
  if(opening<0)throw new Error('Malformed AppDelegate');
  return s.slice(0,opening+1)+
    '\n        USKLocationRecorder.shared.restoreAfterLaunch(options: launchOptions)\n'+
    s.slice(opening+1);
 });
 const storyboard=join(iosBase,'Base.lproj/Main.storyboard');
 edit(storyboard,s=>{
  if(s.includes('customClass="USKBridgeViewController"'))return s;
  const re=/customClass="CAPBridgeViewController"(?: customModule="[^"]*")?(?: customModuleProvider="[^"]*")?/;
  if(!re.test(s))throw new Error('Storyboard CAPBridgeViewController not found');
  return s.replace(re,'customClass="USKBridgeViewController" customModule="App" customModuleProvider="target"');
 });
 console.log('iOS Swift copied. Add files to Xcode App target (or run optional link-ios-xcodeproj.rb) before xcodebuild.');
}
const androidBase=join(root,'android');
if(existsSync(androidBase)){
 const code=join(androidBase,'app/src/main/java/com/uskorun/app');
 for(const file of ['USKQueueCrypto.kt','USKDurableStore.kt','USKLocationService.kt','USKDurableLocationPlugin.kt'])
  copy(join(src,'android',file),join(code,file));
 const javaMain=join(code,'MainActivity.java'),ktMain=join(code,'MainActivity.kt');
 if(existsSync(javaMain)){
  edit(javaMain,s=>{
   if(s.includes('registerPlugin(USKDurableLocationPlugin.class)'))return s;
   const re=/public\s+class\s+MainActivity\s+extends\s+BridgeActivity\s*\{/;
   if(!re.test(s))throw new Error('Unexpected Android MainActivity.java layout');
   return s.replace(re,m=>m+`
    @Override public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(USKDurableLocationPlugin.class);
        super.onCreate(savedInstanceState);
    }
`);
  });
 }else if(existsSync(ktMain)){
  edit(ktMain,s=>{
   if(s.includes('registerPlugin(USKDurableLocationPlugin::class.java)'))return s;
   const re=/class\s+MainActivity\s*:\s*BridgeActivity\(\)\s*\{/;
   if(!re.test(s))throw new Error('Unexpected Android MainActivity.kt layout');
   return s.replace(re,m=>m+`
    override fun onCreate(savedInstanceState: android.os.Bundle?) {
        registerPlugin(USKDurableLocationPlugin::class.java)
        super.onCreate(savedInstanceState)
    }
`);
  });
 }else throw new Error('MainActivity not found; manual Capacitor registration required');
 edit(join(androidBase,'app/src/main/AndroidManifest.xml'),s=>{
  if(s.includes('android:name=".USKLocationService"'))return s;
  if(!s.includes('</application>'))throw new Error('Android application tag missing');
  return s.replace('</application>',
    '    <service android:name=".USKLocationService" android:exported="false" android:foregroundServiceType="location" android:stopWithTask="false" />\n</application>');
 });
 edit(join(androidBase,'build.gradle'),s=>{
  if(s.includes('kotlin-gradle-plugin'))return s;
  const re=/classpath ['"]com\.android\.tools\.build:gradle:[^'"]+['"]/;
  if(!re.test(s))throw new Error('Gradle Android build classpath not found');
  return s.replace(re,m=>m+"\n        classpath 'org.jetbrains.kotlin:kotlin-gradle-plugin:1.9.25'");
 });
 edit(join(androidBase,'app/build.gradle'),s=>{
  let next=s;
  if(!next.includes("apply plugin: 'com.android.application'"))
   throw new Error('Expected app/build.gradle layout not found');
  if(!next.includes("apply plugin: 'org.jetbrains.kotlin.android'"))
   next=next.replace("apply plugin: 'com.android.application'",
    "apply plugin: 'com.android.application'\napply plugin: 'org.jetbrains.kotlin.android'");
  if(!next.includes('kotlinOptions {')){
   const block=/android\s*\{/;
   if(!block.test(next))throw new Error('Expected Android Gradle configuration missing');
   next=next.replace(block,m=>m+"\n    kotlinOptions { jvmTarget = '21' }");
  }
  return next;
 });
 console.log('Android owned Kotlin service and Capacitor bridge linked. Check merged manifest in Android Studio.');
}
if(!existsSync(iosBase)&&!existsSync(androidBase))
 throw new Error('No native platforms. Run npm run native:platforms first.');
