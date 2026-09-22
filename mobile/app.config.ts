import type { ExpoConfig } from "expo/config";

/**
 * RentLeaks — native app config.
 *
 * Environment (set in .env or EAS secrets, never committed):
 *   EXPO_PUBLIC_API_URL        the Next app origin, e.g. https://app.rentleaks.com
 *   EXPO_PUBLIC_WEB_URL        the public site, e.g. https://rentleaks.com
 *   EAS_PROJECT_ID             from `eas init` — required for push tokens
 *   GOOGLE_MAPS_ANDROID_KEY    Maps SDK for Android key
 *   GOOGLE_MAPS_IOS_KEY        optional; Apple Maps is used on iOS without it
 */
const IS_DEV = process.env.APP_VARIANT === "development";

/* The Next app's host also serves /.well-known app-link files (reset emails
   link there), so it joins rentleaks.com as an associated domain. */
const apiHost = (() => {
  try {
    const h = new URL(process.env.EXPO_PUBLIC_API_URL ?? "").hostname;
    return h && h !== "localhost" && !/^\d+\.\d+\.\d+\.\d+$/.test(h) ? h : null;
  } catch {
    return null;
  }
})();

const config: ExpoConfig = {
  name: IS_DEV ? "RentLeaks (dev)" : "RentLeaks",
  slug: "rentleaks",
  scheme: "rentleaks",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "automatic",
  backgroundColor: "#f6fafb",
  ios: {
    bundleIdentifier: IS_DEV ? "com.alternabiz.rentleaks.dev" : "com.alternabiz.rentleaks",
    supportsTablet: true,
    associatedDomains: [
      "applinks:rentleaks.com",
      "applinks:www.rentleaks.com",
      ...(apiHost ? [`applinks:${apiHost}`, `webcredentials:${apiHost}`] : []),
    ],
    config: { usesNonExemptEncryption: false },
    infoPlist: {
      NSCameraUsageDescription:
        "RentLeaks uses the camera to photograph your home for a listing, and to record move-in condition evidence.",
      NSPhotoLibraryUsageDescription:
        "RentLeaks uses your photos to add pictures to a listing or a move-in condition report.",
      NSLocationWhenInUseUsageDescription:
        "RentLeaks uses your location to show homes near you and to stamp condition-report photos with where they were taken.",
    },
  },
  android: {
    package: IS_DEV ? "com.alternabiz.rentleaks.dev" : "com.alternabiz.rentleaks",
    adaptiveIcon: {
      backgroundColor: "#10242a",
      foregroundImage: "./assets/android-icon-foreground.png",
      backgroundImage: "./assets/android-icon-background.png",
      monochromeImage: "./assets/android-icon-monochrome.png",
    },
    predictiveBackGestureEnabled: false,
    permissions: ["CAMERA", "ACCESS_COARSE_LOCATION", "ACCESS_FINE_LOCATION", "POST_NOTIFICATIONS"],
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        data: [
          { scheme: "https", host: "rentleaks.com", pathPrefix: "/listings" },
          { scheme: "https", host: "www.rentleaks.com", pathPrefix: "/listings" },
          ...(apiHost ? [{ scheme: "https", host: apiHost, pathPrefix: "/listings" }, { scheme: "https", host: apiHost, path: "/reset" }] : []),
        ],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
  },
  web: { favicon: "./assets/favicon.png" },
  plugins: [
    "expo-router",
    "expo-secure-store",
    "expo-font",
    "expo-web-browser",
    [
      "expo-splash-screen",
      {
        image: "./assets/splash-icon.png",
        imageWidth: 160,
        resizeMode: "contain",
        backgroundColor: "#f6fafb",
        dark: { backgroundColor: "#0c1b20" },
      },
    ],
    [
      "expo-notifications",
      {
        color: "#3795a6",
        defaultChannel: "messages",
      },
    ],
    [
      "expo-image-picker",
      {
        photosPermission: "RentLeaks uses your photos to add pictures to a listing or a condition report.",
        cameraPermission: "RentLeaks uses the camera to photograph a home or record its condition.",
      },
    ],
    [
      "expo-location",
      {
        locationWhenInUsePermission:
          "RentLeaks uses your location to show homes near you and to stamp condition-report photos.",
      },
    ],
    [
      "react-native-maps",
      {
        androidGoogleMapsApiKey: process.env.GOOGLE_MAPS_ANDROID_KEY,
        iosGoogleMapsApiKey: process.env.GOOGLE_MAPS_IOS_KEY,
      },
    ],
  ],
  experiments: { typedRoutes: false },
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3100",
    webUrl: process.env.EXPO_PUBLIC_WEB_URL ?? "https://rentleaks.com",
    eas: {
      // Owned by @alternabiz/rentleaks — required for EAS Build and push tokens.
      projectId: process.env.EAS_PROJECT_ID ?? "896a4288-9654-44db-b057-0a3a56523801",
    },
  },
};

export default config;
