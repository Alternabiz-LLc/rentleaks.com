import type { BankQuote } from "./client";

export type ProviderSubscription = { id: string; customer_id: string; status: string; currency_code: string; current_term_start?: number; current_term_end?: number; resource_version: number; subscription_items?: Array<{ item_price_id: string; quantity: number; unit_price: number }> };
export type ProviderInvoice = { id: string; subscription_id: string; status: string; currency_code: string; total: number; amount_due: number; date: number; resource_version: number };
export type ProviderEvent = { id: string; api_version: string; event_type: string; occurred_at: number; content: { subscription?: { id: string }; invoice?: { id: string; subscription_id?: string }; transaction?: { subscription_id?: string; linked_invoices?: Array<{ invoice_id: string }> } } };

/** A redirect or an active subscription alone is never proof of payment. */
export function bankAccess(subscription: ProviderSubscription, invoice: ProviderInvoice | null, quote: BankQuote, event: ProviderEvent, previousEventAt: Date | null, now = new Date(), previous?: { access: string; invoiceId: string | null }) {
  const items = subscription.subscription_items ?? [];
  const quoted = quote.length > 0 && items.length === quote.length && quote.every((line) => items.some((item) => item.item_price_id === line.itemPriceId && item.quantity === 1 && item.unit_price === line.amountCents));
  const amount = quote.reduce((sum, line) => sum + line.amountCents, 0);
  const paid = quoted && ["active", "non_renewing"].includes(subscription.status) && subscription.currency_code === "USD" && invoice?.subscription_id === subscription.id && invoice.status === "paid" && invoice.currency_code === "USD" && invoice.total >= amount && invoice.amount_due === 0 && invoice.date >= (subscription.current_term_start ?? Infinity) && (subscription.current_term_end ?? 0) * 1000 > now.getTime();
  const isCurrentFailure = ["payment_failed", "payment_refunded"].includes(event.event_type) && (!previousEventAt || event.occurred_at * 1000 >= previousEventAt.getTime()) && (!event.content.invoice?.id || event.content.invoice.id === invoice?.id);
  if (["cancelled", "paused"].includes(subscription.status)) return { access: "read_only", status: subscription.status, paidThrough: null };
  if (isCurrentFailure || (invoice && ["not_paid", "voided"].includes(invoice.status))) return { access: "read_only", status: "past_due", paidThrough: null };
  if (previous?.access === "read_only" && previous.invoiceId === invoice?.id && (event.event_type !== "payment_succeeded" || (previousEventAt && event.occurred_at * 1000 < previousEventAt.getTime()))) return { access: "read_only", status: "past_due", paidThrough: null };
  if (paid && (event.event_type === "payment_succeeded" || previous?.access === "active")) return { access: "active", status: "paid", paidThrough: new Date(subscription.current_term_end! * 1000) };
  return { access: "basic", status: "pending", paidThrough: null };
}
