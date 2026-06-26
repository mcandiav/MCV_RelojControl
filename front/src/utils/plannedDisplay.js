/**
 * V5.2: plan visible de EJECUCION = runRate NetSuite × cantidad de entrada.
 * Solo presentacion UI; no altera datos persistidos ni integraciones.
 */
export function plannedRunDisplayMinutes(op) {
  const rate = Number(op && op.planned_operation_minutes)
  if (!Number.isFinite(rate) || rate <= 0) return null
  const qty = Number(op && op.planned_quantity)
  if (!Number.isFinite(qty) || qty <= 0) return rate
  return rate * qty
}

export function plannedSetupDisplayMinutes(op) {
  const plan = Number(op && op.planned_setup_minutes)
  if (!Number.isFinite(plan) || plan <= 0) return null
  return plan
}

/** real/plan ratio para barras y colores (null plan => sin comparacion). */
export function planVsRealRatio(realMinutes, planMinutes) {
  const real = Number(realMinutes || 0)
  const plan = planMinutes != null ? Number(planMinutes) : NaN
  if (!Number.isFinite(plan) || plan <= 0) return null
  return Math.max(0, real) / plan
}
