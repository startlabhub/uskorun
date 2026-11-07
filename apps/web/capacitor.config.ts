import type {CapacitorConfig} from '@capacitor/cli';
/**
 * Default = packaged OFFLINE build from apps/web/native-dist.
 * No server.url and no staging required for startup/QA.
 *
 * Optional experimental remote-URL shell (NOT enabled):
 * server: {url:'https://your-approved-host.example',cleartext:false}
 * This requires a live API server and fresh iOS/Android/App Store review.
 */
const config:CapacitorConfig={
 appId:'com.uskorun.app',
 appName:'USKORUN',
 webDir:'native-dist',
 bundledWebRuntime:false,
 android:{useLegacyBridge:true},
 server:{androidScheme:'https',iosScheme:'capacitor'}
};
export default config;
