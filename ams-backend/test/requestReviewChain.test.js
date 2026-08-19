// test/requestReviewChain.test.js
const test = require('node:test');
const assert = require('node:assert/strict');

const LeaveRequest = require('../src/models/LeaveRequest');
const UnauthorisedRequest = require('../src/models/UnauthorisedRequest');
const Attendance = require('../src/models/Attendance');
const Employee = require('../src/models/Employee');
const leaveRequestService = require('../src/services/leaveRequestService');
const unauthorisedRequestService = require('../src/services/unauthorisedRequestService');
const leaveAttendanceHelper = require('../src/services/leaveAttendanceHelper');

const SUPERVISOR = { id: 10, employeeId: 'EMP010' };
const HOD = { id: 20, employeeId: 'EMP020' };

const stubFindAllEmpty = () => async () => [];

test('leave: supervisor accept does not apply attendance; HOD approve does', async (t) => {
    const originalFindOne = LeaveRequest.findOne;
    const originalApplyApproved = leaveAttendanceHelper.applyApprovedLeaveToAttendance;
    const originalFindAllEmployee = Employee.findAll;

    t.after(() => {
        LeaveRequest.findOne = originalFindOne;
        leaveAttendanceHelper.applyApprovedLeaveToAttendance = originalApplyApproved;
        Employee.findAll = originalFindAllEmployee;
    });

    Employee.findAll = stubFindAllEmpty();

    const leave = {
        leaveRequestId: 'LVR001',
        status: 'pending',
        supervisor: SUPERVISOR.id,
        hod: HOD.id,
        reviewedBy: null,
        reviewComments: null,
        reviewedAt: null,
        save: async function save() { return this; },
        toJSON() { return { ...this, save: undefined, toJSON: undefined }; },
    };

    LeaveRequest.findOne = async () => leave;

    let applied = false;
    leaveAttendanceHelper.applyApprovedLeaveToAttendance = async () => { applied = true; };

    const afterSupervisor = await leaveRequestService.reviewLeaveRequest(
        'LVR001',
        SUPERVISOR,
        { decision: 'approved', reviewComments: 'OK from supervisor' },
    );

    assert.equal(afterSupervisor.status, 'supervisor_approved');
    assert.equal(applied, false);
    assert.equal(afterSupervisor.canAccept, false);

    const afterHod = await leaveRequestService.reviewLeaveRequest(
        'LVR001',
        HOD,
        { decision: 'approved', reviewComments: 'OK from HOD' },
    );

    assert.equal(afterHod.status, 'approved');
    assert.equal(applied, true);
    assert.equal(afterHod.reviewedBy, HOD.employeeId);
});

test('leave: admin approve finalizes immediately and applies attendance', async (t) => {
    const originalFindOne = LeaveRequest.findOne;
    const originalApplyApproved = leaveAttendanceHelper.applyApprovedLeaveToAttendance;
    const originalFindAllEmployee = Employee.findAll;

    t.after(() => {
        LeaveRequest.findOne = originalFindOne;
        leaveAttendanceHelper.applyApprovedLeaveToAttendance = originalApplyApproved;
        Employee.findAll = originalFindAllEmployee;
    });

    Employee.findAll = stubFindAllEmpty();

    const leave = {
        leaveRequestId: 'LVR010',
        status: 'pending',
        supervisor: SUPERVISOR.id,
        hod: HOD.id,
        reviewedBy: null,
        reviewComments: null,
        reviewedAt: null,
        save: async function save() { return this; },
        toJSON() { return { ...this, save: undefined, toJSON: undefined }; },
    };

    LeaveRequest.findOne = async () => leave;

    let applied = false;
    leaveAttendanceHelper.applyApprovedLeaveToAttendance = async () => { applied = true; };

    const afterAdmin = await leaveRequestService.reviewLeaveRequest(
        'LVR010',
        { id: 99, employeeId: 'EMP099', role: 'admin' },
        { decision: 'approved', reviewComments: 'Admin accepted' },
    );

    assert.equal(afterAdmin.status, 'approved');
    assert.equal(applied, true);
    assert.equal(afterAdmin.reviewedBy, 'EMP099');
    assert.equal(afterAdmin.canAccept, false);
});

test('leave: HOD cannot skip the supervisor step', async (t) => {
    const originalFindOne = LeaveRequest.findOne;
    t.after(() => { LeaveRequest.findOne = originalFindOne; });

    LeaveRequest.findOne = async () => ({
        leaveRequestId: 'LVR002',
        status: 'pending',
        supervisor: SUPERVISOR.id,
        hod: HOD.id,
        save: async function save() { return this; },
    });

    await assert.rejects(
        () => leaveRequestService.reviewLeaveRequest('LVR002', HOD, { decision: 'approved' }),
        /Supervisor must accept/,
    );
});

test('unauthorised: attendance becomes present only after HOD approve', async (t) => {
    const originalFindOne = UnauthorisedRequest.findOne;
    const originalFindByPk = Attendance.findByPk;
    const originalFindAllEmployee = Employee.findAll;

    t.after(() => {
        UnauthorisedRequest.findOne = originalFindOne;
        Attendance.findByPk = originalFindByPk;
        Employee.findAll = originalFindAllEmployee;
    });

    Employee.findAll = stubFindAllEmpty();

    const attendance = {
        status: 'unauthorised',
        clockIn: '08:30:00',
        clockOut: null,
        save: async function save() { return this; },
    };

    const request = {
        unauthorisedRequestId: 'UNA001',
        attendanceId: 9,
        status: 'pending',
        supervisor: SUPERVISOR.id,
        hod: HOD.id,
        clockIn: '08:30:00',
        clockOut: '17:00:00',
        reviewedBy: null,
        reviewComments: null,
        reviewedAt: null,
        save: async function save() { return this; },
        toJSON() { return { ...this, save: undefined, toJSON: undefined }; },
    };

    UnauthorisedRequest.findOne = async () => request;
    Attendance.findByPk = async () => attendance;

    await unauthorisedRequestService.reviewUnauthorisedRequest(
        'UNA001',
        SUPERVISOR,
        { decision: 'approved' },
    );

    assert.equal(request.status, 'supervisor_approved');
    assert.equal(attendance.status, 'unauthorised');

    await unauthorisedRequestService.reviewUnauthorisedRequest(
        'UNA001',
        HOD,
        { decision: 'approved' },
    );

    assert.equal(request.status, 'approved');
    assert.equal(attendance.status, 'present');
    assert.equal(attendance.clockOut, '17:00:00');
});
