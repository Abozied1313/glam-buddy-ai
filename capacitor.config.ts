import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.abozied.specialstyle',
  appName: 'The Special Style',
  webDir: 'dist',
  android: {
    buildOptions: {
      keystorePath: undefined,
      keystoreAlias: undefined,
    }
  },
  // Server configuration removed for production APK
  // The app will now use local files from the dist folder
};

export default config;
