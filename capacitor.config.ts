import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.quonnect.vendor",
  appName: "Quonnect Vendor",
  webDir: "out",
  // No server.url: the bundled static export runs inside the app.
  android: {
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 800,
      backgroundColor: "#EFEFEF",
      showSpinner: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#EFEFEF",
    },
  },
};

export default config;
