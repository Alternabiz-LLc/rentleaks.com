import Stripe from "stripe";

export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}

export function stripeEnabled() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function integrationId(prefix: string) {
  const suffix = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${suffix}`;
}

export { appUrl, catalogOrigin } from "./site";
