export const demoProfile = {
  id: "demo-ross",
  slug: "ross",
  full_name: "Ross Cohen",
  company: "Nocos Consulting",
  title: "Consultant",
  email: "ross@example.com",
  phone: "+1 212 555 0123",
  website: "https://example.com",
  followup_enabled: true,
  active_mode: {
    id: "demo-everyday",
    name: "Everyday",
    kind: "everyday",
    delay_hours: 24,
    subject_template: "Great meeting you",
    body_template: "Hey {{first_name}} — great meeting you yesterday. Wanted to follow up while our conversation was still fresh. If it'd be useful to keep talking, happy to find some time.\n\n— Ross",
  },
};

export type PublicProfile = typeof demoProfile;
