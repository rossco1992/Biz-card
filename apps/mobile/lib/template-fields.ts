export const templateFields = [
  { key: "first_name", label: "Their first name", group: "Recipient", example: "Alex" },
  { key: "last_name", label: "Their last name", group: "Recipient", example: "Morgan" },
  { key: "full_name", label: "Their full name", group: "Recipient", example: "Alex Morgan" },
  { key: "my_first_name", label: "My first name", group: "You", example: "Sam" },
  { key: "event_name", label: "Event name", group: "Event", example: "Design Summit" },
  { key: "event_date", label: "Event date", group: "Event", example: "September 28, 2026" },
  { key: "event_location", label: "Event location", group: "Event", example: "New York" },
  { key: "event_context", label: "Event details", group: "Event", example: "Design Summit in New York" },
] as const;

export function friendlyTemplate(value: string): string {
  return value.replace(/\{\{\s*(\w+)\s*\}\}/g, (original, key: string) => {
    const field = templateFields.find((item) => item.key === key);
    return field ? `⟦${field.label}⟧` : original;
  });
}

export function storedTemplate(value: string): string {
  return value.replace(/⟦([^⟦⟧]+)⟧/g, (original, label: string) => {
    const field = templateFields.find((item) => item.label === label);
    return field ? `{{${field.key}}}` : original;
  });
}

export function previewTemplate(value: string): string {
  return templateFields.reduce((text, field) => text.split(`⟦${field.label}⟧`).join(field.example), value);
}
