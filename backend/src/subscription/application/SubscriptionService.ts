import { hasProAccess } from "../../registration/domain/User";
import type { UserRepository } from "../../registration/domain/UserRepository";
import type {
  PlanChangeHistoryEntry,
  RenewalPaymentFailureEvent,
  SubscriptionMaintenanceRepository,
} from "../domain/SubscriptionMaintenanceRepository";

export class AuthenticationRequiredError extends Error {
  constructor() {
    super("Inicia sesión para consultar o gestionar tu suscripción.");
    this.name = "AuthenticationRequiredError";
  }
}

export class SubscriptionNotActiveError extends Error {
  constructor() {
    super("No tienes una suscripción Pro activa.");
    this.name = "SubscriptionNotActiveError";
  }
}

export class RenewalPaymentFailureNotApplicableError extends Error {
  constructor() {
    super("El evento no corresponde a una suscripción Pro vigente.");
    this.name = "RenewalPaymentFailureNotApplicableError";
  }
}

export class SubscriptionHistoryUnavailableError extends Error {
  constructor() {
    super("El historial de suscripciones no está disponible.");
    this.name = "SubscriptionHistoryUnavailableError";
  }
}

export interface SubscriptionStatus {
  plan: "BASICO" | "PRO";
  planExpiresAt: string | null;
  planCancellationRequested: boolean;
  history: PlanChangeHistoryEntry[];
}

export interface CancellationConfirmation {
  status: "CANCELLATION_SCHEDULED";
  plan: "PRO";
  planExpiresAt: string;
  planCancellationRequested: true;
  message: string;
}

export class SubscriptionService {
  constructor(
    private readonly userRepository: Pick<UserRepository, "findById" | "requestProCancellation">,
    private readonly now: () => Date = () => new Date(),
    private readonly maintenanceRepository?: Pick<
      SubscriptionMaintenanceRepository,
      "recordRenewalPaymentFailure" | "findPlanChangeHistory"
    >,
  ) {}

  cancelSubscription(userId: number | undefined): CancellationConfirmation {
    const user = userId === undefined ? null : this.userRepository.findById(userId);
    if (!user) throw new AuthenticationRequiredError();
    if (!hasProAccess(user, this.now()) || !user.planExpiresAt) {
      throw new SubscriptionNotActiveError();
    }

    if (!user.planCancellationRequested) {
      this.userRepository.requestProCancellation(user.id);
    }

    return {
      status: "CANCELLATION_SCHEDULED",
      plan: "PRO",
      planExpiresAt: user.planExpiresAt,
      planCancellationRequested: true,
      message: "Tu suscripción Pro se cancelará al finalizar el período actual.",
    };
  }

  recordRenewalPaymentFailure(
    event: RenewalPaymentFailureEvent,
  ): "DEGRADED" | "ALREADY_PROCESSED" {
    if (!this.maintenanceRepository) throw new SubscriptionHistoryUnavailableError();
    const result = this.maintenanceRepository.recordRenewalPaymentFailure(event);
    if (result === "NOT_ACTIVE") throw new RenewalPaymentFailureNotApplicableError();
    return result;
  }

  getStatus(userId: number | undefined): SubscriptionStatus {
    const user = userId === undefined ? null : this.userRepository.findById(userId);
    if (!user) throw new AuthenticationRequiredError();
    if (!this.maintenanceRepository) throw new SubscriptionHistoryUnavailableError();
    return {
      plan: user.plan,
      planExpiresAt: user.planExpiresAt,
      planCancellationRequested: user.planCancellationRequested ?? false,
      history: this.maintenanceRepository.findPlanChangeHistory(user.id),
    };
  }
}
