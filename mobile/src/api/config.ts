import Constants from "expo-constants";

type Extra = { apiUrl?: string; webUrl?: string; eas?: { projectId?: string } };
const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

/** Origin of the Next app that serves /api/v1. */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || extra.apiUrl || "http://localhost:3100").replace(/\/$/, "");
/** Public website (legal pages, share links). */
export const WEB_URL = (process.env.EXPO_PUBLIC_WEB_URL || extra.webUrl || "https://rentleaks.com").replace(/\/$/, "");
export const EAS_PROJECT_ID = extra.eas?.projectId;
