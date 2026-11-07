import { afterEach, describe, expect, it, vi } from "vitest";
import { SmtpRecoveryEmailService } from "../../src/recovery/infrastructure/SmtpRecoveryEmailService";

const originalEnvironment = {
  mode: process.env.RECOVERY_EMAIL_MODE,
  nodeEnv: process.env.NODE_ENV,
};

afterEach(() => {
  if (originalEnvironment.mode === undefined) delete process.env.RECOVERY_EMAIL_MODE;
  else process.env.RECOVERY_EMAIL_MODE = originalEnvironment.mode;
  if (originalEnvironment.nodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalEnvironment.nodeEnv;
  vi.restoreAllMocks();
});

describe("SmtpRecoveryEmailService local console mode", () => {
  it("prints the recovery link for local testing", async () => {
    process.env.RECOVERY_EMAIL_MODE = "console";
    process.env.NODE_ENV = "development";
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    await expect(
      new SmtpRecoveryEmailService().sendRecoveryLink(
        "user@example.com",
        "http://localhost:5173/restablecer-contrasena?token=local-token",
      ),
    ).resolves.toBe(true);

    expect(info).toHaveBeenCalledWith(
      "[recuperación local] Destinatario: user@example.com\nEnlace: http://localhost:5173/restablecer-contrasena?token=local-token",
    );
  });

  it("refuses to print recovery links in production", async () => {
    process.env.RECOVERY_EMAIL_MODE = "console";
    process.env.NODE_ENV = "production";

    await expect(
      new SmtpRecoveryEmailService().sendRecoveryLink(
        "user@example.com",
        "http://localhost:5173/restablecer-contrasena?token=local-token",
      ),
    ).rejects.toThrow("no está permitido en producción");
  });
});
