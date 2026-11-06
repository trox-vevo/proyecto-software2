export interface NewRecoveryToken {
  userId: string;
  tokenHash: string;
  expiresAt: string;
}

export interface RecoveryTokenRepository {
  invalidateRecoveryTokens(userId: string, exceptId?: number): void;
  createRecoveryToken(token: NewRecoveryToken): number;
  deleteRecoveryToken(id: number): void;
  hasValidRecoveryToken(tokenHash: string, now: string): boolean;
  updatePasswordWithRecoveryToken(tokenHash: string, passwordHash: string, now: string): boolean;
}
