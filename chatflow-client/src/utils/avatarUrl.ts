export function avatarUrl(avatar?: string): string | undefined {
  if (!avatar) return undefined;
  if (avatar.startsWith("http")) return avatar;
  return `${import.meta.env.VITE_IMAGE_BASE_URL}${avatar}`;
}
