import { Platform } from "react-native";
import Purchases, { LOG_LEVEL, type CustomerInfo, type PurchasesOffering, type PurchasesPackage } from "react-native-purchases";

const PRO_ENTITLEMENT_ID = "pro";
let configured = false;
let configuredUserId: string | null = null;

function apiKey() {
  if (Platform.OS === "ios") return process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY || "";
  if (Platform.OS === "android") return process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY || "";
  return "";
}

export function revenueCatConfigured() {
  return Boolean(apiKey());
}

export async function configurePurchases(userId: string) {
  const key = apiKey();
  if (!key) throw new Error("Subscriptions are not configured for this build.");

  if (!configured) {
    Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.WARN);
    Purchases.configure({ apiKey: key, appUserID: userId });
    configured = true;
    configuredUserId = userId;
    return;
  }

  if (configuredUserId !== userId) {
    await Purchases.logIn(userId);
    configuredUserId = userId;
  }
}

export async function currentOffering(userId: string): Promise<PurchasesOffering | null> {
  await configurePurchases(userId);
  const offerings = await Purchases.getOfferings();
  return offerings.current ?? null;
}

export function hasPro(customerInfo: CustomerInfo) {
  return Boolean(customerInfo.entitlements.active[PRO_ENTITLEMENT_ID]);
}

export async function buyPackage(userId: string, pkg: PurchasesPackage) {
  await configurePurchases(userId);
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  return customerInfo;
}

export async function restorePurchases(userId: string) {
  await configurePurchases(userId);
  return Purchases.restorePurchases();
}

export async function redeemOfferCode(userId: string) {
  if (Platform.OS !== "ios") throw new Error("Offer code redemption is available on iPhone and iPad.");
  await configurePurchases(userId);
  await Purchases.presentCodeRedemptionSheet();
}

export async function syncPurchases(userId: string) {
  await configurePurchases(userId);
  await Purchases.syncPurchases();
  return Purchases.getCustomerInfo();
}
