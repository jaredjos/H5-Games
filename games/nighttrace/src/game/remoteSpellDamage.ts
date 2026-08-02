export interface RemoteSpellDamageTarget {
  readonly isBoss: boolean
}

/**
 * Shares one cast-wide damage budget across every connected target. Bosses
 * receive three shares so remote area spells remain useful in sovereign
 * encounters without also receiving a second, hidden full damage budget.
 */
export function distributeRemoteCastDamage(
  castDamageBudget: number,
  targets: readonly RemoteSpellDamageTarget[],
) {
  if (targets.length === 0) return []

  const weights = targets.map((target) => (target.isBoss ? 3 : 1))
  const totalWeight = weights.reduce((total, weight) => total + weight, 0)
  const safeBudget = Math.max(0, castDamageBudget)
  return weights.map((weight) => (safeBudget * weight) / totalWeight)
}
