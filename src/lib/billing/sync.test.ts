import { describe, expect, it } from "vitest";
import type Stripe from "stripe";
import {
  currentPeriodEndFromSubscription,
  subscriptionIdFromInvoice,
} from "@/lib/billing/sync";

describe("subscriptionIdFromInvoice", () => {
  it("reads subscription ID from parent.subscription_details when top-level is absent", () => {
    const invoice = {
      id: "in_test",
      object: "invoice",
      parent: {
        type: "subscription_details",
        quote_details: null,
        subscription_details: {
          metadata: null,
          subscription: "sub_from_parent",
        },
      },
    } as Stripe.Invoice;

    expect(subscriptionIdFromInvoice(invoice)).toBe("sub_from_parent");
  });

  it("reads expanded subscription object from parent.subscription_details", () => {
    const invoice = {
      id: "in_test",
      object: "invoice",
      parent: {
        type: "subscription_details",
        quote_details: null,
        subscription_details: {
          metadata: null,
          subscription: { id: "sub_expanded" },
        },
      },
    } as Stripe.Invoice;

    expect(subscriptionIdFromInvoice(invoice)).toBe("sub_expanded");
  });

  it("falls back to legacy top-level subscription when parent is missing", () => {
    const invoice = {
      id: "in_test",
      object: "invoice",
      parent: null,
      subscription: "sub_legacy",
    } as Stripe.Invoice & { subscription: string };

    expect(subscriptionIdFromInvoice(invoice)).toBe("sub_legacy");
  });

  it("prefers parent.subscription_details over legacy top-level subscription", () => {
    const invoice = {
      id: "in_test",
      object: "invoice",
      parent: {
        type: "subscription_details",
        quote_details: null,
        subscription_details: {
          metadata: null,
          subscription: "sub_from_parent",
        },
      },
      subscription: "sub_legacy",
    } as Stripe.Invoice & { subscription: string };

    expect(subscriptionIdFromInvoice(invoice)).toBe("sub_from_parent");
  });

  it("returns null when neither location has a subscription", () => {
    const invoice = {
      id: "in_test",
      object: "invoice",
      parent: {
        type: "quote_details",
        quote_details: { quote: "qt_1" },
        subscription_details: null,
      },
    } as Stripe.Invoice;

    expect(subscriptionIdFromInvoice(invoice)).toBeNull();
  });
});

describe("currentPeriodEndFromSubscription", () => {
  it("reads period end from items when top-level current_period_end is absent", () => {
    const periodEndUnix = 1_784_000_000;
    const subscription = {
      id: "sub_test",
      object: "subscription",
      items: {
        object: "list",
        data: [
          {
            id: "si_1",
            object: "subscription_item",
            current_period_end: periodEndUnix,
            current_period_start: periodEndUnix - 2_592_000,
          },
        ],
        has_more: false,
        url: "/v1/subscription_items",
      },
    } as Stripe.Subscription;

    expect(currentPeriodEndFromSubscription(subscription)).toEqual(
      new Date(periodEndUnix * 1000),
    );
  });

  it("falls back to legacy top-level current_period_end when items lack it", () => {
    const periodEndUnix = 1_700_000_000;
    const subscription = {
      id: "sub_test",
      object: "subscription",
      current_period_end: periodEndUnix,
      items: {
        object: "list",
        data: [{ id: "si_1", object: "subscription_item" }],
        has_more: false,
        url: "/v1/subscription_items",
      },
    } as Stripe.Subscription & { current_period_end: number };

    expect(currentPeriodEndFromSubscription(subscription)).toEqual(
      new Date(periodEndUnix * 1000),
    );
  });

  it("prefers item-level period end over legacy top-level field", () => {
    const itemEnd = 1_784_000_000;
    const legacyEnd = 1_700_000_000;
    const subscription = {
      id: "sub_test",
      object: "subscription",
      current_period_end: legacyEnd,
      items: {
        object: "list",
        data: [
          {
            id: "si_1",
            object: "subscription_item",
            current_period_end: itemEnd,
            current_period_start: itemEnd - 2_592_000,
          },
        ],
        has_more: false,
        url: "/v1/subscription_items",
      },
    } as Stripe.Subscription & { current_period_end: number };

    expect(currentPeriodEndFromSubscription(subscription)).toEqual(
      new Date(itemEnd * 1000),
    );
  });

  it("returns null when neither location has a period end", () => {
    const subscription = {
      id: "sub_test",
      object: "subscription",
      items: {
        object: "list",
        data: [],
        has_more: false,
        url: "/v1/subscription_items",
      },
    } as Stripe.Subscription;

    expect(currentPeriodEndFromSubscription(subscription)).toBeNull();
  });
});
