import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import type { PurchasesOffering, PurchasesPackage } from "react-native-purchases";
import { Button, Card, Notice, PageHeader, Screen, uiStyles } from "@/components/ui";
import { colors, radii } from "@/constants/theme";
import { useSession } from "@/providers/session-provider";
import { buyPackage, currentOffering, hasPro, redeemOfferCode, restorePurchases, revenueCatConfigured, syncPurchases } from "@/lib/billing";

function packageLabel(pkg: PurchasesPackage) {
  const id = `${pkg.identifier} ${pkg.product.identifier}`.toLowerCase();
  if (id.includes("annual") || id.includes("year")) return "Yearly";
  if (id.includes("month")) return "Monthly";
  return pkg.product.title || "Pro";
}

function packageRank(pkg: PurchasesPackage) {
  const label = packageLabel(pkg);
  return label === "Yearly" ? 0 : label === "Monthly" ? 1 : 2;
}

export default function ProScreen() {
  const { session, subscription, refresh } = useSession();
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [selected, setSelected] = useState<PurchasesPackage | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const packages = useMemo(
    () => [...(offering?.availablePackages ?? [])].sort((a, b) => packageRank(a) - packageRank(b)),
    [offering],
  );

  useEffect(() => {
    let active = true;
    const billingUserId = session?.user.id;
    if (!billingUserId) return;
    if (!revenueCatConfigured()) {
      setLoading(false);
      return;
    }
    currentOffering(billingUserId)
      .then((next) => {
        if (!active) return;
        setOffering(next);
        const ordered = [...(next?.availablePackages ?? [])].sort((a, b) => packageRank(a) - packageRank(b));
        setSelected(ordered[0] ?? null);
      })
      .catch((cause) => active && setError(cause instanceof Error ? cause.message : "Could not load Pro plans."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [session?.user.id]);

  if (!session) return null;
  const userId = userId;
  const isPro = subscription?.plan === "pro";

  async function purchase() {
    if (!selected) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const info = await buyPackage(userId, selected);
      if (hasPro(info)) {
        setMessage("KNCT Pro is active.");
        await refresh();
      } else {
        setError("The purchase completed, but Pro access has not synced yet. Try Restore Purchases.");
      }
    } catch (cause: any) {
      if (!cause?.userCancelled) setError(cause instanceof Error ? cause.message : "Could not complete the purchase.");
    } finally { setBusy(false); }
  }

  async function restore() {
    setBusy(true); setError(""); setMessage("");
    try {
      const info = await restorePurchases(userId);
      if (hasPro(info)) {
        setMessage("Your KNCT Pro purchase was restored.");
        await refresh();
      } else {
        setMessage("No active Pro subscription was found for this account.");
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not restore purchases."); }
    finally { setBusy(false); }
  }

  async function redeem() {
    setBusy(true); setError(""); setMessage("");
    try {
      await redeemOfferCode(userId);
      const info = await syncPurchases(userId);
      if (hasPro(info)) {
        setMessage("Offer redeemed. KNCT Pro is active.");
        await refresh();
      } else {
        setMessage("If you completed redemption, Pro may take a moment to sync. Restore Purchases can refresh it.");
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not open offer-code redemption."); }
    finally { setBusy(false); }
  }

  return (
    <Screen>
      <View style={styles.topRow}>
        <Pressable onPress={() => router.back()} hitSlop={12}><Text style={styles.close}>×</Text></Pressable>
      </View>
      <PageHeader eyebrow="KNCT Pro" title={isPro ? "You’re Pro." : "Never lose a connection."} />
      <Text style={uiStyles.body}>Meet people. KNCT handles the follow-up so the relationship doesn’t end with the introduction.</Text>

      {isPro ? (
        <Card style={styles.proCard}>
          <Text style={uiStyles.sectionTitle}>Pro is active</Text>
          <Text style={uiStyles.body}>Unlimited automatic follow-ups, full relationship history, event mode, and future Pro features are unlocked.</Text>
          {subscription?.expires_at ? <Text style={uiStyles.small}>Current access through {new Date(subscription.expires_at).toLocaleDateString()}.</Text> : null}
        </Card>
      ) : (
        <>
          <Card>
            <Text style={uiStyles.sectionTitle}>Included with Pro</Text>
            {["Unlimited automatic follow-ups", "AI-personalized follow-ups", "Full relationship history", "Event mode", "Multiple profiles as they roll out"].map((item) => (
              <View key={item} style={styles.feature}><Text style={styles.check}>✓</Text><Text style={styles.featureText}>{item}</Text></View>
            ))}
          </Card>

          {!revenueCatConfigured() ? <Notice>Subscriptions are ready in the app, but this build still needs RevenueCat API keys before purchases can be tested.</Notice> : null}
          {loading ? <Notice>Loading App Store plans…</Notice> : null}
          {!loading && revenueCatConfigured() && !packages.length ? <Notice tone="error">No Pro products are available in the current RevenueCat offering.</Notice> : null}

          {packages.map((pkg) => {
            const active = selected?.identifier === pkg.identifier;
            const label = packageLabel(pkg);
            return (
              <Pressable key={pkg.identifier} onPress={() => setSelected(pkg)} style={[styles.plan, active && styles.planActive]}>
                <View style={styles.radio}>{active ? <View style={styles.radioDot} /> : null}</View>
                <View style={styles.planCopy}>
                  <View style={styles.planTitleRow}>
                    <Text style={styles.planTitle}>{label}</Text>
                    {label === "Yearly" ? <View style={styles.best}><Text style={styles.bestText}>Best value</Text></View> : null}
                  </View>
                  <Text style={styles.price}>{pkg.product.priceString}{label === "Yearly" ? " / year" : label === "Monthly" ? " / month" : ""}</Text>
                </View>
              </Pressable>
            );
          })}

          <Text style={styles.trial}>7 days free, then the selected plan renews automatically unless canceled. Cancel anytime in your App Store or Google Play subscription settings.</Text>
          <Button onPress={() => void purchase()} loading={busy} disabled={!selected || !revenueCatConfigured()}>Start 7-day free trial</Button>
        </>
      )}

      {message ? <Notice tone="success">{message}</Notice> : null}
      {error ? <Notice tone="error">{error}</Notice> : null}

      <Button variant="secondary" onPress={() => void restore()} disabled={busy || !revenueCatConfigured()}>Restore purchases</Button>
      {Platform.OS === "ios" ? <Button variant="secondary" onPress={() => void redeem()} disabled={busy || !revenueCatConfigured()}>Redeem offer code</Button> : null}
      <Text style={styles.footer}>Free includes your digital card, contact exchange, saved connections, and 5 automatic follow-ups each month.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topRow: { alignItems: "flex-end" },
  close: { color: colors.ink, fontSize: 34, lineHeight: 34, fontWeight: "300" },
  proCard: { borderColor: colors.accent },
  feature: { flexDirection: "row", gap: 10, alignItems: "center" },
  check: { color: colors.accent, fontSize: 16, fontWeight: "900" },
  featureText: { color: colors.ink, fontSize: 15, flex: 1 },
  plan: { minHeight: 84, borderRadius: radii.medium, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, padding: 16, flexDirection: "row", alignItems: "center", gap: 12 },
  planActive: { borderColor: colors.accent, borderWidth: 2 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.accent, alignItems: "center", justifyContent: "center" },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },
  planCopy: { flex: 1, gap: 4 },
  planTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  planTitle: { color: colors.ink, fontSize: 17, fontWeight: "800" },
  price: { color: colors.muted, fontSize: 14 },
  best: { backgroundColor: colors.accentSoft, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3 },
  bestText: { color: colors.accent, fontSize: 9, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.6 },
  trial: { color: colors.muted, fontSize: 11, lineHeight: 16, textAlign: "center" },
  footer: { color: colors.muted, fontSize: 11, lineHeight: 16, textAlign: "center", paddingHorizontal: 12 },
});
