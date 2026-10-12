const assert = require('assert');
const {
  ZIM400_PRODUCT_VERIFICATION_FIELD,
  VERIFICATION_REQUIRED_MESSAGE,
  resolveStopProductVerification,
  applyZim400ProductVerification
} = require('../src/services/netsuite/zim400ProductVerification');

assert.strictEqual(ZIM400_PRODUCT_VERIFICATION_FIELD, 'custrecord_mcv_verif_producto');
assert.strictEqual(
  VERIFICATION_REQUIRED_MESSAGE,
  'Seleccione Sí o No para registrar la verificación del producto.'
);

assert.strictEqual(resolveStopProductVerification(10, undefined).error, VERIFICATION_REQUIRED_MESSAGE);
assert.strictEqual(resolveStopProductVerification(10, null).error, VERIFICATION_REQUIRED_MESSAGE);
assert.strictEqual(resolveStopProductVerification(10, 'Sí').error, VERIFICATION_REQUIRED_MESSAGE);
assert.deepStrictEqual(resolveStopProductVerification(10, true), { store: true });
assert.deepStrictEqual(resolveStopProductVerification(15, false), { store: false });
assert.deepStrictEqual(resolveStopProductVerification(0, false), {});
assert.deepStrictEqual(resolveStopProductVerification(null, true), {});

assert.deepStrictEqual(
  applyZim400ProductVerification({}, { product_verified: true })[ZIM400_PRODUCT_VERIFICATION_FIELD],
  { refName: 'Sí' }
);
assert.deepStrictEqual(
  applyZim400ProductVerification({}, { completed_quantity: 15, product_verified: false })[ZIM400_PRODUCT_VERIFICATION_FIELD],
  { refName: 'No' }
);
const omitted = applyZim400ProductVerification({}, { completed_quantity: 0 });
assert.strictEqual(Object.prototype.hasOwnProperty.call(omitted, ZIM400_PRODUCT_VERIFICATION_FIELD), false);
const historic = applyZim400ProductVerification({}, null);
assert.strictEqual(Object.prototype.hasOwnProperty.call(historic, ZIM400_PRODUCT_VERIFICATION_FIELD), false);

console.log('OK zim400ProductVerification');
