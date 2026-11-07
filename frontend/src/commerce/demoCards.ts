export type DemoScenarioId = "DEMO_APPROVED" | "DEMO_DECLINED";

export interface DemoCardInput {
  holder: string;
  number: string;
  expiry: string;
  cvv: string;
}

export type DemoCardErrors = Partial<Record<keyof DemoCardInput, string>>;

// Conserva los caracteres incorrectos para que la validación pueda explicarlos.
// Nunca recorta dígitos: una entrada de 17 debe seguir siendo inválida.
export function formatDemoCardNumber(value: string): string {
  if (!/^[0-9 ]*$/.test(value)) return value;
  return value.replace(/ /g, "").match(/.{1,4}/g)?.join(" ") ?? "";
}

export function validateDemoCard(card: DemoCardInput, now = new Date()): { errors: DemoCardErrors } {
  const errors: DemoCardErrors = {};
  if (!card.holder.trim()) {
    errors.holder = "Ingresa el nombre del titular.";
  } else if (card.holder.trim().length > 120) {
    errors.holder = "El nombre del titular debe tener hasta 120 caracteres.";
  }
  if (!/^[0-9 ]*$/.test(card.number)) {
    errors.number = "El número de tarjeta solo puede contener dígitos y espacios.";
  } else if (card.number.replace(/ /g, "").length !== 16) {
    errors.number = "El número de tarjeta debe contener exactamente 16 dígitos.";
  }
  const expiry = card.expiry.trim();
  const parts = /^(\d{2})\/(\d{2})$/.exec(expiry);
  if (!parts) {
    errors.expiry = "Ingresa la fecha de vencimiento con formato MM/AA.";
  } else {
    const month = Number(parts[1]);
    const year = 2000 + Number(parts[2]);
    if (month < 1 || month > 12) {
      errors.expiry = "El mes de vencimiento debe estar entre 01 y 12.";
    } else if (year * 12 + month < now.getFullYear() * 12 + now.getMonth() + 1) {
      errors.expiry = "La fecha de vencimiento no puede ser anterior al mes actual.";
    }
  }
  if (!/^[0-9]{3}$/.test(card.cvv)) {
    errors.cvv = "El CVV debe contener exactamente 3 dígitos.";
  }
  return { errors };
}
