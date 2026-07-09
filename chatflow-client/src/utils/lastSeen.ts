export function formatLastSeen(lastSeen?: string | null): string {
  if (!lastSeen) return "çevrimdışı";

  const date = new Date(lastSeen);
  const now = new Date();

  const time = date.toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  // Aynı gün mü?
  const isSameDay = date.toDateString() === now.toDateString();
  if (isSameDay) return `son görülme bugün ${time}`;

  // Dün mü?
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString())
    return `son görülme dün ${time}`;

  // Bu yıl içinde mi?  gün.ay
  const sameYear = date.getFullYear() === now.getFullYear();
  const dateStr = date.toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    ...(sameYear ? {} : { year: "numeric" }),
  });

  return `son görülme ${dateStr}`;
}