export type UserPlan = "BASICO" | "PRO";

export interface AuthSession {
  id: string;
  userId: number;
  tokenJwt: string;
  expiresAt: string;
  plan: UserPlan;
}

const SESSION_STORAGE_KEY = "yupay.auth.session";

function isAuthSession(value: unknown): value is AuthSession {
  if (typeof value !== "object" || value === null) return false;
  const session = value as Record<string, unknown>;
  return (
    typeof session.id === "string" &&
    typeof session.userId === "number" &&
    Number.isSafeInteger(session.userId) &&
    session.userId > 0 &&
    typeof session.tokenJwt === "string" &&
    typeof session.expiresAt === "string" &&
    (session.plan === "BASICO" || session.plan === "PRO")
  );
}

export function getStoredSession(): AuthSession | null {
  const stored = window.localStorage.getItem(SESSION_STORAGE_KEY);
  if (stored === null) return null;

  try {
    const parsed: unknown = JSON.parse(stored);
    if (isAuthSession(parsed) && Date.parse(parsed.expiresAt) > Date.now()) {
      return parsed;
    }
  } catch (error: unknown) {
    if (!(error instanceof SyntaxError)) throw error;
  }

  window.localStorage.removeItem(SESSION_STORAGE_KEY);
  return null;
}

export function saveAuthSession(session: AuthSession): void {
  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

export function clearAuthSession(): void {
  window.localStorage.removeItem(SESSION_STORAGE_KEY);
}

export function fetchWithAuth(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  const session = getStoredSession();
  if (session) headers.set("Authorization", `Bearer ${session.tokenJwt}`);
  return fetch(input, { ...init, headers });
}
