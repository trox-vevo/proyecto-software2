import {
  AuthenticationRequiredError,
  CheckoutHistoryUnavailableError,
  CheckoutReceiptNotFoundError,
  type CheckoutPayment,
  type CheckoutPaymentHistoryRepository,
} from "./CheckoutPaymentHistory";

export class CheckoutHistoryService {
  constructor(
    private readonly repository?: Pick<
      CheckoutPaymentHistoryRepository,
      "findCheckoutHistory" | "findCheckoutReceipt"
    >,
  ) {}

  getHistory(userId: number | undefined): CheckoutPayment[] {
    if (userId === undefined) throw new AuthenticationRequiredError();
    if (!this.repository) throw new CheckoutHistoryUnavailableError();
    return this.repository.findCheckoutHistory(userId);
  }

  getReceipt(userId: number | undefined, reference: string): CheckoutPayment {
    if (userId === undefined) throw new AuthenticationRequiredError();
    if (!this.repository) throw new CheckoutHistoryUnavailableError();
    const receipt = this.repository.findCheckoutReceipt(userId, reference);
    if (!receipt || receipt.receiptStatus !== "AVAILABLE") {
      throw new CheckoutReceiptNotFoundError();
    }
    return receipt;
  }
}
