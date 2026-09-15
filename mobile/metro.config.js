// Metro config. On web, react-native-maps (native-only) resolves to a
// lightweight stand-in so `npx expo start --web` works as a quick preview.
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
const upstream = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === "web" && moduleName === "react-native-maps") {
    return { type: "sourceFile", filePath: path.resolve(__dirname, "src/lib/maps.web.tsx") };
  }
  return (upstream ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
