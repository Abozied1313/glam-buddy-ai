import { Capacitor } from "@capacitor/core";

// Custom URL scheme registered by the native apps (iOS + Android).
export const APP_SCHEME = "com.abozied.specialstyle";
// Public web build that actually performs the OAuth handshake.
export const WEB_ORIGIN = "https://the-special-style.lovable.app";

const NATIVE_HANDOFF_KEY = "the-special-style.native.handoff";

export const isNativeApp = () => Capacitor.isNativePlatform();

/** Called on the web page opened from the native app. */
export const markNativeHandoff = () => {
  try {
    window.sessionStorage.setItem(NATIVE_HANDOFF_KEY, "1");
  } catch {
    // ignore
  }
};

export const hasNativeHandoff = () => {
  try {
    return window.sessionStorage.getItem(NATIVE_HANDOFF_KEY) === "1";
  } catch {
    return false;
  }
};

export const clearNativeHandoff = () => {
  try {
    window.sessionStorage.removeItem(NATIVE_HANDOFF_KEY);
  } catch {
    // ignore
  }
};

/**
 * Hands the freshly created session back to the native app through the
 * custom URL scheme. Returns true when the redirect was triggered.
 */
export const handoffSessionToNativeApp = (session: {
  access_token: string;
  refresh_token: string;
} | null): boolean => {
  if (!hasNativeHandoff() || !session?.access_token || !session?.refresh_token) return false;
  clearNativeHandoff();
  const params = new URLSearchParams({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });
  window.location.replace(`${APP_SCHEME}://auth/callback#${params.toString()}`);
  return true;
};
