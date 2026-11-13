import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DigitalChannelIcons } from "./DigitalChannelIcons";

describe("DigitalChannelIcons (US19, TS-57)", () => {
  it.each([
    [true, true, "Banca digital: sí. App móvil: sí."],
    [true, false, "Banca digital: sí. App móvil: no."],
    [false, true, "Banca digital: no. App móvil: sí."],
    [false, false, "Banca digital: no. App móvil: no."],
  ])("banca %s y app %s se describen como %j", (hasDigitalBanking, hasMobileApp, texto) => {
    render(<DigitalChannelIcons channels={{ hasDigitalBanking, hasMobileApp }} />);
    expect(screen.getByRole("img", { name: texto })).toBeInTheDocument();
  });

  it("marca en gris el canal que la entidad no tiene", () => {
    const { container } = render(<DigitalChannelIcons channels={{ hasDigitalBanking: true, hasMobileApp: false }} />);
    expect(container.querySelector('[title="Banca digital: sí"]')).toHaveClass("canal-si");
    expect(container.querySelector('[title="App móvil: no"]')).toHaveClass("canal-no");
  });
});
