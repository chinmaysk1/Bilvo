export function dollarsToCents(amount: number) {
  // shareAmount is Float in DB, so round to protect against float noise.
  return Math.max(0, Math.round(amount * 100));
}
