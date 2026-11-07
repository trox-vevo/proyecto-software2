export type BillingErrors = Partial<Record<"name" | "email" | "form", string>>;

// Lista cerrada: la facturación no recibe datos de tarjeta ni identidad de usuario.
export function validateBilling(input: unknown): BillingErrors {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { form: "Revisa los datos de facturación." };
  const body = input as Record<string, unknown>;
  if (Object.keys(body).some((key) => !["planId", "billing"].includes(key)) || body.planId !== "PRO") {
    return { form: "Solo se admiten el Plan Pro y sus datos de facturación." };
  }
  if (!body.billing || typeof body.billing !== "object" || Array.isArray(body.billing)) return { form: "Revisa los datos de facturación." };
  const billing = body.billing as Record<string, unknown>;
  if (Object.keys(billing).some((key) => !["name", "email"].includes(key))) {
    return { form: "Solo se admiten nombre y correo de facturación. Los datos ficticios de tarjeta se validan en tu navegador." };
  }
  const errors: BillingErrors = {};
  if (typeof billing.name !== "string" || !billing.name.trim() || billing.name.trim().length > 120) {
    errors.name = "Ingresa un nombre o razón social de hasta 120 caracteres.";
  }
  if (typeof billing.email !== "string" || billing.email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(billing.email.trim())) {
    errors.email = "Ingresa un correo de facturación válido.";
  }
  return errors;
}
