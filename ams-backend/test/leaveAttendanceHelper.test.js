// test/leaveAttendanceHelper.test.js
const test = require('node:test');
const assert = require('node:assert/strict');

const {
    splitShiftHalves,
    resolveLeaveForAttendance,
    SYSTEM_REVIEWER_ID,
} = require('../src/services/leaveAttendanceHelper');
const LeaveRequest = require('../src/models/LeaveRequest');

test('splitShiftHalves splits normal shift at midpoint', () => {
    const halves = splitShiftHalves('08:30', '17:00');
    assert.equal(halves.morning.start, '08:30');
    assert.equal(halves.morning.end, '12:45');
    assert.equal(halves.afternoon.start, '12:45');
    assert.equal(halves.afternoon.end, '17:00');
});

test('resolveLeaveForAttendance returns null when no leave covers the date', async (t) => {
    const original = LeaveRequest.findAll;
    t.after(() => { LeaveRequest.findAll = original; });

    LeaveRequest.findAll = async () => [];

    const result = await resolveLeaveForAttendance({
        employeeId: 'EMP001',
        date: '2026-07-21',
        shiftStart: '08:30',
        shiftEnd: '17:00',
        logs: [],
    });

    assert.equal(result, null);
});

test('full-day approved leave sets reqLeave and status leave', async (t) => {
    const original = LeaveRequest.findAll;
    t.after(() => { LeaveRequest.findAll = original; });

    LeaveRequest.findAll = async () => ([{
        id: 10,
        status: 'approved',
        duration: 'full_day',
        halfDayPeriod: null,
        save: async () => {},
    }]);

    const result = await resolveLeaveForAttendance({
        employeeId: 'EMP001',
        date: '2026-07-21',
        shiftStart: '08:30',
        shiftEnd: '17:00',
        logs: [],
        clockIn: null,
        clockOut: null,
    });

    assert.equal(result.reqLeave, true);
    assert.equal(result.status, 'leave');
    assert.equal(result.leaveRequestId, 10);
});

test('pending leave is auto-accepted during processing', async (t) => {
    const original = LeaveRequest.findAll;
    t.after(() => { LeaveRequest.findAll = original; });

    const leave = {
        id: 11,
        status: 'pending',
        duration: 'full_day',
        halfDayPeriod: null,
        reviewComments: null,
        reviewedBy: null,
        reviewedAt: null,
        save: async function save() { return this; },
    };

    LeaveRequest.findAll = async () => [leave];

    const result = await resolveLeaveForAttendance({
        employeeId: 'EMP001',
        date: '2026-07-21',
        shiftStart: '08:30',
        shiftEnd: '17:00',
        logs: [],
    });

    assert.equal(leave.status, 'approved');
    assert.equal(leave.reviewedBy, SYSTEM_REVIEWER_ID);
    assert.equal(result.reqLeave, true);
    assert.equal(result.status, 'leave');
});

test('supervisor_approved leave is auto-accepted during processing', async (t) => {
    const original = LeaveRequest.findAll;
    t.after(() => { LeaveRequest.findAll = original; });

    const leave = {
        id: 14,
        status: 'supervisor_approved',
        duration: 'full_day',
        halfDayPeriod: null,
        reviewComments: null,
        reviewedBy: 'EMP010',
        reviewedAt: new Date(),
        save: async function save() { return this; },
    };

    LeaveRequest.findAll = async () => [leave];

    const result = await resolveLeaveForAttendance({
        employeeId: 'EMP001',
        date: '2026-07-21',
        shiftStart: '08:30',
        shiftEnd: '17:00',
        logs: [],
    });

    assert.equal(leave.status, 'approved');
    assert.equal(leave.reviewedBy, SYSTEM_REVIEWER_ID);
    assert.equal(result.reqLeave, true);
    assert.equal(result.status, 'leave');
});

test('half-day morning leave checks afternoon punches; missing out → unauthorised', async (t) => {
    const original = LeaveRequest.findAll;
    t.after(() => { LeaveRequest.findAll = original; });

    LeaveRequest.findAll = async () => ([{
        id: 12,
        status: 'approved',
        duration: 'half_day',
        halfDayPeriod: 'morning',
        save: async () => {},
    }]);

    const result = await resolveLeaveForAttendance({
        employeeId: 'EMP001',
        date: '2026-07-23',
        shiftStart: '08:30',
        shiftEnd: '17:00',
        logs: [
            { id: 1, punchTime: '13:00:00' },
            // no afternoon out
        ],
    });

    assert.equal(result.reqLeave, true);
    assert.equal(result.status, 'unauthorised');
    assert.equal(result.dayType, null);
});

test('half-day morning leave with afternoon in/out → present half_day', async (t) => {
    const original = LeaveRequest.findAll;
    t.after(() => { LeaveRequest.findAll = original; });

    LeaveRequest.findAll = async () => ([{
        id: 13,
        status: 'approved',
        duration: 'half_day',
        halfDayPeriod: 'morning',
        save: async () => {},
    }]);

    const result = await resolveLeaveForAttendance({
        employeeId: 'EMP001',
        date: '2026-07-23',
        shiftStart: '08:30',
        shiftEnd: '17:00',
        logs: [
            { id: 1, punchTime: '13:00:00' },
            { id: 2, punchTime: '17:00:00' },
        ],
    });

    assert.equal(result.reqLeave, true);
    assert.equal(result.status, 'present');
    assert.equal(result.dayType, 'half_day');
});
