const test = require('node:test');
const assert = require('node:assert/strict');
const { Op } = require('sequelize');

const {
  normalizeSearchTerm,
  buildAttendanceSearchWhere,
} = require('../src/services/attendanceService');

test('normalizeSearchTerm trims whitespace and ignores non-strings', () => {
  assert.equal(normalizeSearchTerm('  EMP006  '), 'EMP006');
  assert.equal(normalizeSearchTerm(null), '');
  assert.equal(normalizeSearchTerm(undefined), '');
});

test('buildAttendanceSearchWhere searches attendance, employee, and note fields', () => {
  const where = buildAttendanceSearchWhere('late', ['EMP001', 'EMP002']);
  const symbols = Object.getOwnPropertySymbols(where);

  assert.equal(symbols.length, 1);
  assert.equal(symbols[0], Op.or);

  const orClause = where[Op.or];
  assert.equal(orClause.length, 4);
  assert.equal(orClause[0].attendanceId[Op.iLike], '%late%');
  assert.equal(orClause[1].employeeId[Op.iLike], '%late%');
  assert.equal(orClause[2].notes[Op.iLike], '%late%');
  assert.deepEqual(orClause[3].employeeId[Op.in], ['EMP001', 'EMP002']);
});

test('buildAttendanceSearchWhere returns an empty filter for blank search terms', () => {
  assert.deepEqual(buildAttendanceSearchWhere('   '), {});
});