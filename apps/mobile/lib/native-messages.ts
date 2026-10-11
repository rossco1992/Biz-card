import { NativeModules, Platform } from "react-native";

type ComposeResult = "sent" | "cancelled" | "failed";

type NativeMessagesModule = {
  compose(recipient: string, body: string): Promise<ComposeResult>;
};

const module = NativeModules.KNCTMessages as NativeMessagesModule | undefined;

export function nativeMessagesAvailable() {
  return Platform.OS === "ios" && Boolean(module);
}

export async function composeNativeMessage(recipient: string, body: string) {
  if (!module) throw new Error("Native Messages support is not installed in this iOS build.");
  return module.compose(recipient, body);
}
