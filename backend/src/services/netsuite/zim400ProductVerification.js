const ZIM400_PRODUCT_VERIFICATION_FIELD = 'custrecord_mcv_verif_producto';
const ZIM400_PRODUCT_VERIFICATION_SI = 'Sí';
const ZIM400_PRODUCT_VERIFICATION_NO = 'No';
const VERIFICATION_REQUIRED_MESSAGE =
  'Seleccione Sí o No para registrar la verificación del producto.';

function resolveStopProductVerification(completedQty, productVerified) {
  const hasPositiveQty = Number.isInteger(completedQty) && completedQty > 0;
  if (!hasPositiveQty) return {};
  if (productVerified !== true && productVerified !== false) {
    return { error: VERIFICATION_REQUIRED_MESSAGE };
  }
  return { store: productVerified };
}

function applyZim400ProductVerification(payload, details) {
  const target = payload || {};
  if (!details || typeof details !== 'object') return target;
  if (details.product_verified === true) {
    target[ZIM400_PRODUCT_VERIFICATION_FIELD] = { refName: ZIM400_PRODUCT_VERIFICATION_SI };
  } else if (details.product_verified === false) {
    target[ZIM400_PRODUCT_VERIFICATION_FIELD] = { refName: ZIM400_PRODUCT_VERIFICATION_NO };
  }
  return target;
}

module.exports = {
  ZIM400_PRODUCT_VERIFICATION_FIELD,
  VERIFICATION_REQUIRED_MESSAGE,
  resolveStopProductVerification,
  applyZim400ProductVerification
};
