const test = require('node:test');
const assert = require('node:assert/strict');

const {
    calculateWorkedMinutes,
    classifyWorkDay,
    calculateStatus,
    FULL_DAY_MINUTES,
    SHORT_LEAVE_MINUTES,
    HALF_DAY_MINUTES,
} = require('../src/utils/attendanceUtils');

test('calculateWorkedMinutes returns gross duration between clock-in and clock-out', () => {
    assert.equal(calculateWorkedMinutes('08:30', '15:30'), 420);
    assert.equal(calculateWorkedMinutes('08:30', '14:30'), 360);
    assert.equal(calculateWorkedMinutes('08:30', '13:30'), 300);
});

test('calculateWorkedMinutes handles overnight shifts', () => {
    assert.equal(calculateWorkedMinutes('22:00', '06:00'), 480);
});

test('calculateWorkedMinutes returns 0 when punches are missing', () => {
    assert.equal(calculateWorkedMinutes(null, '17:00'), 0);
    assert.equal(calculateWorkedMinutes('08:30', null), 0);
});

test('classifyWorkDay marks 7h+ as full_day present with no cover owed', () => {
    const result = classifyWorkDay(FULL_DAY_MINUTES);

    assert.equal(result.dayType, 'full_day');
    assert.equal(result.status, 'present');
    assert.equal(result.lateCoverMinutes, 0);
});

test('classifyWorkDay marks 6h to 6h59m as short_leave present', () => {
    const result = classifyWorkDay(SHORT_LEAVE_MINUTES + 59);

    assert.equal(result.dayType, 'short_leave');
    assert.equal(result.status, 'present');
    assert.equal(result.lateCoverMinutes, 0);
});

test('classifyWorkDay marks 5h to 5h59m as half_day present', () => {
    const result = classifyWorkDay(HALF_DAY_MINUTES + 59);

    assert.equal(result.dayType, 'half_day');
    assert.equal(result.status, 'present');
    assert.equal(result.lateCoverMinutes, 0);
});

test('classifyWorkDay marks below 5h as unauthorised with cover shortfall', () => {
    const workedMinutes = HALF_DAY_MINUTES - 1;
    const result = classifyWorkDay(workedMinutes);

    assert.equal(result.dayType, null);
    assert.equal(result.status, 'unauthorised');
    assert.equal(result.lateCoverMinutes, 1);
});

test('calculateStatus keeps absent and single-punch behaviour unchanged', () => {
    assert.equal(calculateStatus(null, null), 'absent');
    assert.equal(calculateStatus('08:30', null), 'unauthorised');
    assert.equal(calculateStatus(null, '17:00'), 'unauthorised');
    assert.equal(calculateStatus('08:30', '17:00'), 'present');
});

test('end-to-end examples from normal shift start', () => {
    const fullDay = classifyWorkDay(calculateWorkedMinutes('08:30', '15:30'));
    assert.deepEqual(fullDay, { dayType: 'full_day', status: 'present', lateCoverMinutes: 0 });

    const shortLeave = classifyWorkDay(calculateWorkedMinutes('08:30', '14:30'));
    assert.deepEqual(shortLeave, { dayType: 'short_leave', status: 'present', lateCoverMinutes: 0 });

    const halfDay = classifyWorkDay(calculateWorkedMinutes('08:30', '13:30'));
    assert.deepEqual(halfDay, { dayType: 'half_day', status: 'present', lateCoverMinutes: 0 });

    const insufficient = classifyWorkDay(calculateWorkedMinutes('08:30', '12:00'));
    assert.equal(insufficient.dayType, null);
    assert.equal(insufficient.status, 'unauthorised');
    assert.equal(insufficient.lateCoverMinutes, 90);
});
