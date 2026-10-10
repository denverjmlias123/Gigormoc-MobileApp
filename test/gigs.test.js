const test = require('node:test');
const assert = require('node:assert');

function formatPrice(centavos) {
  const pesos = centavos / 100;
  return `₱${pesos.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

test('Integer centavos currency calculation', () => {
  assert.strictEqual(formatPrice(50000), '₱500');
  assert.strictEqual(formatPrice(150050), '₱1,500.5');
  assert.strictEqual(formatPrice(0), '₱0');
});

test('Mode permissions for publishing gigs', () => {
  const canPublish = (activeMode) => activeMode === 'hire';

  assert.strictEqual(canPublish('hire'), true);
  assert.strictEqual(canPublish('find_work'), false);
  assert.strictEqual(canPublish(null), false);
});

test('Gig work_type and status enums validity', () => {
  const validWorkTypes = ['remote', 'face_to_face', 'hybrid'];
  const validStatuses = ['draft', 'open', 'in_progress', 'completed', 'cancelled', 'expired'];

  assert.ok(validWorkTypes.includes('remote'));
  assert.ok(validWorkTypes.includes('face_to_face'));
  assert.ok(validWorkTypes.includes('hybrid'));
  assert.ok(!validWorkTypes.includes('invalid'));

  assert.ok(validStatuses.includes('draft'));
  assert.ok(validStatuses.includes('open'));
});
