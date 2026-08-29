/** Extract an input image path only from this project's exact storage endpoint. */
export function getOwnedImagePath(url: unknown, supabaseUrl: string, userId: string): string | null {
  if (typeof url !== 'string' || !userId) return null;
  try {
    const parsed = new URL(url);
    const base = new URL(supabaseUrl);
    if (parsed.protocol !== 'https:' || parsed.origin !== base.origin || parsed.username || parsed.password) {
      return null;
    }
    const match = parsed.pathname.match(/^\/storage\/v1\/object\/(?:sign|authenticated|public)\/analysis-images\/(.+)$/);
    if (!match) return null;
    const path = decodeURIComponent(match[1]);
    const segments = path.split('/');
    if (segments[0] !== userId || segments.length < 2) return null;
    if (segments.some(segment => !segment || segment === '.' || segment === '..')) return null;
    // Reject ambiguous paths, including double-encoded traversal and control bytes.
    if (path.includes('\\') || path.includes('%')) return null;
    if ([...path].some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) return null;
    return path;
  } catch {
    return null;
  }
}
