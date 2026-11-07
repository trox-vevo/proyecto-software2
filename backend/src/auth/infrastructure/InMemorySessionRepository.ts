import type { Session } from "../domain/Session";

export class InMemorySessionRepository {
  private readonly sessions = new Map<string, Session>();

  create(session: Session): Session {
    this.sessions.set(session.id, session);
    return session;
  }

  findByToken(token: string): Session | null {
    for (const s of this.sessions.values()) {
      if (s.tokenJwt === token) return s;
    }
    return null;
  }

  findById(id: string): Session | null {
    return this.sessions.get(id) ?? null;
  }

  delete(id: string): void {
    this.sessions.delete(id);
  }
}
