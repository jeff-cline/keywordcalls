import Stripe from "stripe";
import { getSetting } from "@/lib/settings";

// Stripe client built from the key the God enters on the Integrations page (stored in Settings).
export async function getStripe(): Promise<Stripe | null> {
  const key = await getSetting("stripeSecretKey");
  return key ? new Stripe(key) : null;
}
export async function stripeConfigured(): Promise<boolean> {
  return !!(await getSetting("stripeSecretKey"));
}
export async function getPublishableKey(): Promise<string> {
  return getSetting("stripePublishableKey");
}
