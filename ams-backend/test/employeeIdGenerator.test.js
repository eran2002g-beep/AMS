const test = require('node:test');
const assert = require('node:assert/strict');

const { generateNextEmployeeId } = require('../src/services/employeeIdGenerator');

test('returns EMP001 when no employee IDs exist', () => {
  assert.equal(generateNextEmployeeId([]), 'EMP001');
});

test('increments the highest existing EMP number', () => {
  assert.equal(generateNextEmployeeId(['EMP001', 'EMP002', 'EMP010']), 'EMP011');
});

test('ignores non-matching values and keeps the sequence stable', () => {
  assert.equal(generateNextEmployeeId(['ABC123', 'EMP005', 'EMP007', 'xyz']), 'EMP008');
});
