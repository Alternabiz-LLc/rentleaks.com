/**
 * Secure key-value storage: Keychain / Keystore on devices, localStorage on
 * the web preview (which has no secure enclave — never ship web as a product
 * surface with this).
 */
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const web = Platform.OS === "web";

export async function getSecure(key: string): Promise<string | null> {
  if (web) return globalThis.localStorage?.getItem(key) ?? null;
  return SecureStore.getItemAsync(key);
}

export async function setSecure(key: string, value: string) {
  if (web) return void globalThis.localStorage?.setItem(key, value);
  await SecureStore.setItemAsync(key, value);
}

export async function deleteSecure(key: string) {
  if (web) return void globalThis.localStorage?.removeItem(key);
  await SecureStore.deleteItemAsync(key);
}
