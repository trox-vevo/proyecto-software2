import type { UserRepository } from "../registration/domain/UserRepository";
import type { PaymentGateway, PaymentResult } from "./PaymentGateway";

const PRO_PERIOD_DAYS = 30;

export class AuthenticationRequiredError extends Error {
  constructor() {
    super("Inicia sesión para suscribirte al Plan Pro.");
    this.name = "AuthenticationRequiredError";
  }
}

// US33: cobra con la pasarela y, si aprueba, activa el Plan Pro (TS-101).
export class PaymentProcessingService {
  constructor(
    private readonly paymentGateway: PaymentGateway,
    private readonly userRepository: Pick<UserRepository, "findById" | "activatePro">,
    private readonly now: () => Date = () => new Date(), // inyectable para probar la fecha
  ) {}

  processPayment(userId: number | undefined, paymentRequest: unknown) {
    // Primero quién paga: nunca se cobra a un usuario que no existe.
    const user = userId === undefined ? null : this.userRepository.findById(userId);
    if (!user) throw new AuthenticationRequiredError();

    // La respuesta conserva todos los campos de la pasarela (MockPaymentResult) más plan y vencimiento.
    const result: PaymentResult = this.paymentGateway.simulate(paymentRequest);
    if (result.outcome !== "APPROVED") {
      return { ...result, plan: user.plan, planExpiresAt: user.planExpiresAt }; // Escenario 2: nada cambia
    }
    const expiresAt = this.calculateExpiration();
    this.userRepository.activatePro(user.id, expiresAt); // Escenario 1
    return { ...result, plan: "PRO" as const, planExpiresAt: expiresAt };
  }

  private calculateExpiration(): string {
    const date = this.now();
    date.setUTCDate(date.getUTCDate() + PRO_PERIOD_DAYS);
    return date.toISOString();
  }
}
