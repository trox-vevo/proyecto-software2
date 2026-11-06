// Value object (US19): canales digitales de una entidad, banca por internet y app móvil.
// Igual que ServiceChannels: sin identidad ni ciclo de vida.
export class DigitalChannels {
  constructor(
    readonly hasDigitalBanking: boolean,
    readonly hasMobileApp: boolean,
  ) {
    Object.freeze(this);
  }
}
