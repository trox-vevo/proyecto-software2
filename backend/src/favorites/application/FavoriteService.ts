import { createHash } from "node:crypto";
import Decimal from "decimal.js";
import type { CuentaAhorros } from "../../rentabilidad/CuentaAhorros";
import { CriterioOrden } from "../../rentabilidad/CriterioOrden";
import { FiltroAhorros } from "../../rentabilidad/FiltroAhorros";
import { FormateadorResultados } from "../../rentabilidad/FormateadorResultados";
import { MotorCalculo } from "../../rentabilidad/MotorCalculo";
import { RentabilidadSimple } from "../../rentabilidad/RentabilidadSimple";
import { FixedDepositSimulationService } from "../../simulation/application/FixedDepositSimulationService";
import { InvalidSimulationParametersError } from "../../simulation/application/InvalidSimulationParametersError";
import { PaymentMode } from "../../simulation/domain/PaymentMode";
import { FavoriteError, isEntityId, type AuthenticatedUser, type FavoriteParameters, type FavoriteRepository } from "../domain/Favorite";

function invalid(): never {
  throw new FavoriteError(400, "INVALID_FAVORITE", "Revisa el instrumento y los parámetros de la simulación.");
}

function readParameters(input: unknown): FavoriteParameters {
  if (!input || typeof input !== "object" || Array.isArray(input)) return invalid();
  const value = input as Record<string, unknown>;
  if (value.instrument === "AHORROS") {
    const keys = ["instrument", "accountId", "days"];
    if (
      Object.keys(value).some((key) => !keys.includes(key)) ||
      typeof value.accountId !== "string" ||
      !value.accountId.trim() ||
      value.accountId.length > 100 ||
      !Number.isSafeInteger(value.days) ||
      (value.days as number) <= 0
    ) return invalid();
    return { instrument: "AHORROS", accountId: value.accountId.trim(), days: value.days as number };
  }
  const keys = ["instrument", "productId", "amount", "termDays", "department", "paymentMode"];
  if (
    value.instrument !== "PLAZO_FIJO" || Object.keys(value).some((key) => !keys.includes(key)) ||
    !Number.isSafeInteger(value.productId) || (value.productId as number) <= 0 ||
    typeof value.amount !== "string" || !/^\d{1,12}(\.\d{1,2})?$/.test(value.amount) ||
    !Number.isSafeInteger(value.termDays) || typeof value.department !== "string" ||
    !value.department.trim() || value.department.length > 80 ||
    !Object.values(PaymentMode).includes(value.paymentMode as PaymentMode)
  ) return invalid();
  return {
    instrument: "PLAZO_FIJO", productId: value.productId as number,
    amount: new Decimal(value.amount).toFixed(2), termDays: value.termDays as number,
    department: value.department.trim(), paymentMode: value.paymentMode as PaymentMode,
  };
}

export class FavoriteService {
  constructor(
    private readonly repository: FavoriteRepository,
    private readonly accounts: { obtenerTodas(): CuentaAhorros[] },
    private readonly fixedDeposits: FixedDepositSimulationService,
  ) {}

  async save(user: AuthenticatedUser | null, input: unknown) {
    if (!user || !isEntityId(user.id)) throw new FavoriteError(401, "AUTHENTICATION_REQUIRED", "Inicia sesión para guardar una simulación favorita.");
    if (user.plan !== "PRO") throw new FavoriteError(403, "PRO_REQUIRED", "Guardar favoritos es un beneficio del Plan Pro.");
    const parameters = readParameters(input);
    const snapshot = await this.simulate(parameters);
    const fingerprint = createHash("sha256").update(JSON.stringify(parameters)).digest("hex");
    return this.repository.save({ userId: user.id, fingerprint, parameters, snapshot, createdAt: new Date().toISOString() });
  }

  private async simulate(parameters: FavoriteParameters): Promise<unknown> {
    if (parameters.instrument === "AHORROS") {
      const account = this.accounts.obtenerTodas().find((item) => item.id === parameters.accountId);
      if (!account) throw new FavoriteError(404, "SIMULATION_NOT_FOUND", "La cuenta seleccionada ya no está disponible.");
      const calculator = new MotorCalculo(new RentabilidadSimple(), new FiltroAhorros({}), new FormateadorResultados());
      return calculator.calcular([account], parameters.days, CriterioOrden.RENTABILIDAD)[0];
    }
    try {
      const results = await this.fixedDeposits.simulate(new Decimal(parameters.amount), parameters.termDays, parameters.department, parameters.paymentMode);
      const result = results.find((item) => item.productId === parameters.productId);
      if (!result) throw new FavoriteError(404, "SIMULATION_NOT_FOUND", "El producto seleccionado ya no está disponible para estos parámetros.");
      return result;
    } catch (error) {
      if (error instanceof InvalidSimulationParametersError) throw new FavoriteError(400, "INVALID_FAVORITE", error.message);
      throw error;
    }
  }
}
