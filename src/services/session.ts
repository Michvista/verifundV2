export type UserRole =
  | "member"
  | "treasurer"
  | "executive1"
  | "executive2"
  | "admin"
  | "regulator";

export type AuthUser = {
  id: string;
  firstName: string;
  lastName: string;
  role: UserRole | string;
};

export type AuthSession = {
  token: string;
  user: AuthUser;
};

const TOKEN_KEY = "verifund_token";
const USER_KEY = "verifund_user";
const SESSION_EVENT = "verifund-session-change";

function hasStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function notifySessionChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(SESSION_EVENT));
  }
}

export function getStoredToken() {
  if (!hasStorage()) return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): AuthUser | null {
  if (!hasStorage()) return null;

  try {
    const raw = window.localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    clearStoredSession();
    return null;
  }
}

export function getStoredSession(): AuthSession | null {
  const token = getStoredToken();
  const user = getStoredUser();

  if (!token || !user) return null;
  return { token, user };
}

export function saveStoredSession(session: AuthSession) {
  if (!hasStorage()) return;

  window.localStorage.setItem(TOKEN_KEY, session.token);
  window.localStorage.setItem(USER_KEY, JSON.stringify(session.user));
  notifySessionChanged();
}

export function clearStoredSession() {
  if (!hasStorage()) return;

  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
  notifySessionChanged();
}

export function subscribeToSessionChanges(listener: () => void) {
  if (typeof window === "undefined") return () => {};

  window.addEventListener(SESSION_EVENT, listener);
  window.addEventListener("storage", listener);

  return () => {
    window.removeEventListener(SESSION_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}
