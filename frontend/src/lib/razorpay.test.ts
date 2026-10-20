import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api-client", () => ({ default: { post: vi.fn().mockResolvedValue({ data: {} }) } }));

import apiClient from "@/lib/api-client";
import { apiErrorMessage, runCheckout, verifyPayment } from "./razorpay";

describe("razorpay helpers", () => {
  it("auto-completes against the fake gateway with a signature the fake backend accepts", async () => {
    const outcome = await runCheckout({
      name: "fake",
      keyId: "rzp_test_fake",
      gatewayOrderId: "order_fake_1",
      amountPaise: 10000,
      currency: "INR",
    });
    expect(outcome.status).toBe("paid");
    if (outcome.status === "paid") {
      expect(outcome.result.razorpay_order_id).toBe("order_fake_1");
      expect(outcome.result.razorpay_payment_id).toMatch(/^pay_fake_/);
      expect(outcome.result.razorpay_signature).toBe("fake");
    }
  });

  it("posts the signed result to /payments/verify", async () => {
    await verifyPayment("p-1", { razorpay_order_id: "o", razorpay_payment_id: "p", razorpay_signature: "s" });
    expect(apiClient.post).toHaveBeenCalledWith("/payments/verify", {
      paymentId: "p-1",
      razorpay_order_id: "o",
      razorpay_payment_id: "p",
      razorpay_signature: "s",
    });
  });

  it("extracts API error messages", () => {
    expect(apiErrorMessage({ response: { data: { message: "nope" } } }, "x")).toBe("nope");
    expect(apiErrorMessage({ response: { data: { error: { message: "deep" } } } }, "x")).toBe("deep");
    expect(apiErrorMessage(new Error("boom"), "fallback")).toBe("fallback");
  });
});
