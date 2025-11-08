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
  server: {
    url: 'https://5e89785d-9380-4e24-b08c-450110974b42.lovableproject.com?forceHideBadge=true',
    cleartext: true
  }
};

export default config;
