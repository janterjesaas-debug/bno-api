// lib/stripeRoutes.ts
import type { Express } from "express";

/**
 * Stripe-ruter ligger i dag i server.ts.
 * Denne filen finnes kun for at importen `registerStripeRoutes` ikke skal feile på Render.
 */
export function registerStripeRoutes(_app: Express) {
  // no-op (bevisst)
}

export default registerStripeRoutes;