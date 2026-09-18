import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const ui = read("../components/ui.tsx");

// Wiring guards, not a substitute for an iPhone/Android keyboard interaction test.
test("shared screens have bounded keyboard avoidance and a dismiss toolbar", () => {
  assert.match(ui, /KeyboardAvoidingView style=\{styles.flex\}/);
  assert.match(ui, /accessibilityLabel="Dismiss keyboard" onPress=\{Keyboard.dismiss\}/);
  assert.match(ui, /shown.remove\(\); hidden.remove\(\)/);
  assert.match(ui, /keyboardShouldPersistTaps="handled"/);
  assert.match(ui, /automaticallyAdjustKeyboardInsets=\{false\}/);
});
test("single-line fields dismiss while multiline fields preserve newlines", () => {
  assert.match(ui, /submitBehavior=\{props.multiline \? "newline" : "blurAndSubmit"\}/);
  assert.match(ui, /returnKeyType=\{props.multiline \? "default" : "done"\}/);
  assert.match(ui, /Keyboard.dismiss\(\); onPress\?\.\(\)/);
});
test("search list uses the keyboard frame without a nested scroll view", () => {
  const source = read("../app/(tabs)/connections.tsx");
  assert.match(source, /<KeyboardFrame>/);
  assert.match(source, /keyboardDismissMode=/);
  assert.doesNotMatch(source, /<ScrollView/);
});
test("onboarding dismisses keyboard and resets scrolling when steps change", () => {
  const source = read("../app/onboarding.tsx");
  assert.match(source, /Keyboard.dismiss\(\);\s+setStep\(next\)/);
  assert.match(source, /<Screen key=\{step\}>/);
  assert.doesNotMatch(source, /onPress=\{\(\) => setStep/);
});
test("Android resizes the window and tabs hide while typing", () => {
  assert.equal(JSON.parse(read("../app.json")).expo.android.softwareKeyboardLayoutMode, "resize");
  assert.match(read("../app/(tabs)/_layout.tsx"), /tabBarHideOnKeyboard: true/);
});
