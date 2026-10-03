import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { createBizCardClient } from "@biz-card/supabase";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const secureStoreOptions = { keychainService: "knct-auth" };

async function saveSecurely(key: string, value: string) {
  await SecureStore.setItemAsync(key, value, {
    ...secureStoreOptions,
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

/**
 * Supabase sessions used to live in AsyncStorage. Migrate them on first read,
 * then erase the plaintext legacy copy so upgrades do not leave credentials behind.
 */
const secureAuthStorage = {
  async getItem(key: string) {
    const secure = await SecureStore.getItemAsync(key, secureStoreOptions);
    if (secure !== null) return secure;

    const legacy = await AsyncStorage.getItem(key);
    if (legacy === null) return null;

    await saveSecurely(key, legacy);
    await AsyncStorage.removeItem(key);
    return legacy;
  },
  async setItem(key: string, value: string) {
    await saveSecurely(key, value);
    await AsyncStorage.removeItem(key).catch(() => undefined);
  },
  async removeItem(key: string) {
    await Promise.all([
      SecureStore.deleteItemAsync(key, secureStoreOptions),
      AsyncStorage.removeItem(key),
    ]);
  },
};

export const supabase = url && anonKey
  ? createBizCardClient(url, anonKey, {
      auth: {
        storage: secureAuthStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        flowType: "pkce",
      },
    })
  : null;

export const isSupabaseConfigured = Boolean(supabase);
