// utils/payments/calcProcessingFeeCents.ts

/**
 * Gross-up fee so that:
 * - roommate is charged: share + fee
 * - you can transfer full share to the owner
 * - Stripe fees come out of the fee portion
 *
 * Stripe card pricing assumption: 2.9% + 30¢
 */
export function calcProcessingFeeCents(shareCents: number) {
  const p = 0.029;
  const fixed = 30;

  if (!Number.isFinite(shareCents) || shareCents <= 0) return 0;

  // total >= (share + fixed) / (1 - p)
  const total = Math.ceil((shareCents + fixed) / (1 - p));
  const fee = total - shareCents;

  return Math.max(fee, 0);
}
