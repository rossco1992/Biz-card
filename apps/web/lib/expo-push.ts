type ExpoPushTicket = {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
};

export type ExpoPushResult = {
  acceptedIds: string[];
  rejectedTokens: string[];
};

function chunks<T>(items: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
}

export async function sendExpoPush(
  tokens: string[],
  notification: { title: string; body: string; data: Record<string, string> },
): Promise<ExpoPushResult> {
  const uniqueTokens = [...new Set(tokens)].filter(Boolean);
  const acceptedIds: string[] = [];
  const rejectedTokens: string[] = [];

  for (const batch of chunks(uniqueTokens, 100)) {
    const headers: Record<string, string> = {
      Accept: "application/json",
      "Content-Type": "application/json",
      "Accept-Encoding": "gzip, deflate",
    };
    if (process.env.EXPO_ACCESS_TOKEN) headers.Authorization = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;

    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers,
      body: JSON.stringify(batch.map((to) => ({
        to,
        title: notification.title,
        body: notification.body,
        data: notification.data,
        sound: "default",
      }))),
    });

    if (!response.ok) throw new Error(`Expo push request failed with ${response.status}`);

    const payload = await response.json() as { data?: ExpoPushTicket | ExpoPushTicket[] };
    const tickets = Array.isArray(payload.data) ? payload.data : payload.data ? [payload.data] : [];

    batch.forEach((token, index) => {
      const ticket = tickets[index];
      if (ticket?.status === "ok") {
        if (ticket.id) acceptedIds.push(ticket.id);
      } else {
        rejectedTokens.push(token);
      }
    });
  }

  return { acceptedIds, rejectedTokens };
}
