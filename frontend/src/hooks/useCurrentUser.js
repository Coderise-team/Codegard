import { useAuthStore } from '../store/authStore';

/**
 * Current user for the page shell (sidebar + navbar). Comes straight from the
 * auth store — no extra request, since the shell only needs the name and the
 * avatar. Turning a name into initials is the Avatar component's business.
 */
export function useCurrentUser() {
  const username = useAuthStore((s) => s.user?.username);
  const avatar = useAuthStore((s) => s.user?.avatar);
  if (!username) return null;
  // Normalised to null: the API says null for "no avatar", and a stored user
  // saved before the field existed simply has nothing there.
  return { username, avatar: avatar ?? null };
}
