import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { colors, radii } from "@/constants/theme";
import { templateFields, previewTemplate } from "@/lib/template-fields";
import { uiStyles } from "@/components/ui";

export function TemplateField({ label, value, onChangeText, multiline = false, disabled = false }: {
  label: string; value: string; onChangeText: (value: string) => void; multiline?: boolean; disabled?: boolean;
}) {
  const input = useRef<TextInput>(null);
  const selection = useRef({ start: value.length, end: value.length });
  const [pickerOpen, setPickerOpen] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  function insert(fieldLabel: string) {
    const start = Math.min(selection.current.start, value.length);
    const end = Math.min(selection.current.end, value.length);
    const token = `⟦${fieldLabel}⟧`;
    onChangeText(value.slice(0, start) + token + value.slice(end));
    const cursor = start + token.length;
    selection.current = { start: cursor, end: cursor };
    setPickerOpen(false);
    requestAnimationFrame(() => {
      input.current?.focus();
      input.current?.setNativeProps({ selection: { start: cursor, end: cursor } });
    });
  }

  return <View style={styles.container}>
    <Text style={styles.label}>{label}</Text>
    <TextInput ref={input} accessibilityLabel={label} value={value} onChangeText={onChangeText}
      editable={!disabled} multiline={multiline} onSelectionChange={(event) => { selection.current = event.nativeEvent.selection; }}
      style={[styles.input, multiline && styles.multiline]} placeholderTextColor={colors.muted} />
    <View style={styles.actions}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Add a field to ${label.toLowerCase()}`}
        accessibilityState={{ expanded: pickerOpen }} disabled={disabled} onPress={() => setPickerOpen(!pickerOpen)} style={styles.action}>
        <Text style={styles.actionText}>{pickerOpen ? "Close fields" : "+ Add a field"}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: showPreview }} onPress={() => setShowPreview(!showPreview)} style={styles.action}>
        <Text style={styles.actionText}>{showPreview ? "Hide preview" : "Preview example"}</Text>
      </Pressable>
    </View>
    {pickerOpen ? <View style={styles.picker}>
      <Text style={uiStyles.small}>Choose a detail to insert where your cursor is.</Text>
      {["Recipient", "You", "Event"].map((group) => <View key={group} style={styles.group}>
        <Text style={styles.label}>{group}</Text>
        <View style={styles.chips}>{templateFields.filter((field) => field.group === group).map((field) =>
          <Pressable key={field.key} accessibilityRole="button" accessibilityLabel={`Insert ${field.label.toLowerCase()}`}
            onPress={() => insert(field.label)} style={styles.chip}>
            <Text style={styles.actionText}>{field.label}</Text>
          </Pressable>)}</View>
      </View>)}
    </View> : null}
    {showPreview ? <View style={styles.preview}>
      <Text style={styles.label}>Example with sample details</Text>
      <Text style={styles.previewText}>{previewTemplate(value)}</Text>
    </View> : null}
  </View>;
}

const styles = StyleSheet.create({
  container: { gap: 7 },
  label: { color: colors.ink, fontSize: 13, fontWeight: "700" },
  input: { minHeight: 52, borderRadius: radii.medium, borderColor: colors.line, borderWidth: 1, backgroundColor: colors.surface, paddingHorizontal: 15, color: colors.ink, fontSize: 16 },
  multiline: { minHeight: 150, paddingTop: 14, paddingBottom: 14, textAlignVertical: "top" },
  actions: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 4 },
  action: { minHeight: 44, justifyContent: "center", paddingHorizontal: 4 },
  actionText: { color: colors.accent, fontSize: 13, fontWeight: "700" },
  picker: { borderRadius: radii.medium, padding: 14, gap: 16, backgroundColor: colors.accentSoft },
  group: { gap: 7 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { minHeight: 44, justifyContent: "center", borderRadius: radii.small, paddingHorizontal: 12, backgroundColor: colors.surface },
  preview: { backgroundColor: colors.accentSoft, borderRadius: radii.small, padding: 14, gap: 8 },
  previewText: { color: colors.ink, fontSize: 15, lineHeight: 23 },
});
