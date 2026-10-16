import { FinancialProduct } from "./FinancialProduct";

// Interfaz del dominio: el servicio depende de ella y no de una implementación concreta
// (hoy InMemoryProductRepository; luego, la de base de datos).
// Devuelve Promise para que la implementación con base de datos no obligue a cambiar el servicio.
export interface FinancialProductRepository {
  findFixedDepositsByDepartment(department: string): Promise<FinancialProduct[]>;
}
