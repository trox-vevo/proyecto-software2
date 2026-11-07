import type { Request } from "express";
import type { PlanId } from "../../plans/Plan";
import type { PaymentMode } from "../../simulation/domain/PaymentMode";

// Lo aporta la autenticación del equipo tras verificar la sesión y la membresía vigente.
export interface AuthenticatedUser {
  id: number;
  plan: PlanId;
}

export type ResolveUser = (request: Request) => Promise<AuthenticatedUser | null>;

export type FavoriteParameters =
  | { instrument: "AHORROS"; accountId: string; days: number }
  | {
      instrument: "PLAZO_FIJO";
      productId: number;
      amount: string;
      termDays: number;
      department: string;
      paymentMode: PaymentMode;
    };

export interface Favorite {
  id: number;
  userId: number;
  fingerprint: string;
  parameters: FavoriteParameters;
  snapshot: unknown;
  createdAt: string;
}

// El identificador lo asigna SQLite al persistir, nunca el servicio ni el cliente.
export type NewFavorite = Omit<Favorite, "id">;

export function isEntityId(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

export interface FavoriteRepository {
  save(favorite: NewFavorite): { favorite: Favorite; created: boolean };
}

export class FavoriteError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
  }
}
