import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { login as loginRequest, type LoginPayload } from "../services/api";
import {
  clearStoredSession,
  getStoredSession,
  saveStoredSession,
  subscribeToSessionChanges,
  type AuthSession,
  type AuthUser,
} from "../services/session";

type AuthContextValue = {
  session: AuthSession | null;
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  signIn: (credentials: LoginPayload) => Promise<AuthSession>;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(() => getStoredSession());

  useEffect(() => {
    return subscribeToSessionChanges(() => {
      setSession(getStoredSession());
    });
  }, []);

  async function signIn(credentials: LoginPayload) {
    const result = await loginRequest(credentials);
    const nextSession = { token: result.token, user: result.member };
    saveStoredSession(nextSession);
    setSession(nextSession);
    return nextSession;
  }

  function signOut() {
    clearStoredSession();
    setSession(null);
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      token: session?.token ?? null,
      isAuthenticated: Boolean(session?.token && session.user),
      signIn,
      signOut,
    }),
    [session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
