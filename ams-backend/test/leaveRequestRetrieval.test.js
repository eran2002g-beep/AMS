// test/leaveRequestRetrieval.test.js
// Unit tests for the employee leave-request retrieval service.
// User Story: As an employee, I want to see all my leave requests and
// their status so that I can track approvals or rejections.
//
// Tests are written with the built-in Node.js test runner (node:test) and
// mock model methods directly, matching the pattern used in attendanceSearch.test.js
// and employeeRoles.test.js so the suite can run without a live database.

const test   = require('node:test');
const assert = require('node:assert/strict');
const { Op } = require('sequelize');

const Employee     = require('../src/models/Employee');
const LeaveRequest = require('../src/models/LeaveRequest');
const {
    getLeaveRequestsByEmployee,
    getAllLeaveRequests,
    getAdminLeaveRequests,
} = require('../src/services/leaveRequestService');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal Employee-like plain object. */
const makeEmployee = (overrides = {}) => ({
    id: 1,
    employeeId: 'EMP001',
    firstName: 'Alice',
    lastName:  'Smith',
    isActive:  true,
    ...overrides,
});

/** Build a minimal LeaveRequest-like plain object. */
const makeLeaveRequest = (overrides = {}) => ({
    id:             1,
    leaveRequestId: 'LVR001',
    employeeId:     'EMP001',
    leaveType:      'annual',
    startDate:      '2026-09-10',
    endDate:        '2026-09-12',
    totalDays:      3,
    reason:         'Family vacation',
    status:         'pending',
    reviewedBy:     null,
    reviewComments: null,
    reviewedAt:     null,
    createdAt:      '2026-08-01T00:00:00.000Z',
    updatedAt:      '2026-08-01T00:00:00.000Z',
    ...overrides,
});

// ---------------------------------------------------------------------------
// getLeaveRequestsByEmployee - happy-path retrieval
// ---------------------------------------------------------------------------

test('returns paginated leave requests for a valid active employee', async (t) => {
    const originalFindOneEmployee     = Employee.findOne;
    const originalFindAndCountAllLeave = LeaveRequest.findAndCountAll;

    t.after(() => {
        Employee.findOne              = originalFindOneEmployee;
        LeaveRequest.findAndCountAll  = originalFindAndCountAllLeave;
    });

    const rows = [makeLeaveRequest(), makeLeaveRequest({ id: 2, leaveRequestId: 'LVR002', status: 'approved' })];

    Employee.findOne             = async () => makeEmployee();
    LeaveRequest.findAndCountAll = async () => ({ rows, count: 2 });

    const result = await getLeaveRequestsByEmployee('EMP001');

    assert.equal(result.records.length, 2);
    assert.equal(result.meta.total, 2);
    assert.equal(result.meta.page, 1);
    assert.equal(result.meta.limit, 50);
});

// ---------------------------------------------------------------------------
// getLeaveRequestsByEmployee - status filter
// ---------------------------------------------------------------------------

test('passes status filter to the database query', async (t) => {
    const originalFindOneEmployee     = Employee.findOne;
    const originalFindAndCountAllLeave = LeaveRequest.findAndCountAll;

    t.after(() => {
        Employee.findOne              = originalFindOneEmployee;
        LeaveRequest.findAndCountAll  = originalFindAndCountAllLeave;
    });

    let capturedWhere;

    Employee.findOne = async () => makeEmployee();
    LeaveRequest.findAndCountAll = async ({ where }) => {
        capturedWhere = where;
        return { rows: [], count: 0 };
    };

    await getLeaveRequestsByEmployee('EMP001', { status: 'pending' });

    assert.equal(capturedWhere.employeeId, 'EMP001');
    assert.equal(capturedWhere.status, 'pending');
});

// ---------------------------------------------------------------------------
// getLeaveRequestsByEmployee - pagination
// ---------------------------------------------------------------------------

test('applies page and limit to offset the query correctly', async (t) => {
    const originalFindOneEmployee     = Employee.findOne;
    const originalFindAndCountAllLeave = LeaveRequest.findAndCountAll;

    t.after(() => {
        Employee.findOne              = originalFindOneEmployee;
        LeaveRequest.findAndCountAll  = originalFindAndCountAllLeave;
    });

    let capturedOptions;

    Employee.findOne = async () => makeEmployee();
    LeaveRequest.findAndCountAll = async (options) => {
        capturedOptions = options;
        return { rows: [], count: 0 };
    };

    await getLeaveRequestsByEmployee('EMP001', { page: 2, limit: 10 });

    assert.equal(capturedOptions.limit,  10);
    assert.equal(capturedOptions.offset, 10); // (page 2 - 1) * 10
    assert.equal(capturedOptions.where.employeeId, 'EMP001');
});

// ---------------------------------------------------------------------------
// getLeaveRequestsByEmployee - meta reflects custom pagination
// ---------------------------------------------------------------------------

test('meta reflects the applied page and limit values', async (t) => {
    const originalFindOneEmployee     = Employee.findOne;
    const originalFindAndCountAllLeave = LeaveRequest.findAndCountAll;

    t.after(() => {
        Employee.findOne              = originalFindOneEmployee;
        LeaveRequest.findAndCountAll  = originalFindAndCountAllLeave;
    });

    Employee.findOne             = async () => makeEmployee();
    LeaveRequest.findAndCountAll = async () => ({ rows: [], count: 25 });

    const result = await getLeaveRequestsByEmployee('EMP001', { page: 3, limit: 5 });

    assert.equal(result.meta.total, 25);
    assert.equal(result.meta.page,  3);
    assert.equal(result.meta.limit, 5);
});

// ---------------------------------------------------------------------------
// getLeaveRequestsByEmployee - default page / limit resilience
// ---------------------------------------------------------------------------

test('falls back to page 1 and limit 50 when opts are omitted', async (t) => {
    const originalFindOneEmployee     = Employee.findOne;
    const originalFindAndCountAllLeave = LeaveRequest.findAndCountAll;

    t.after(() => {
        Employee.findOne              = originalFindOneEmployee;
        LeaveRequest.findAndCountAll  = originalFindAndCountAllLeave;
    });

    let capturedOptions;

    Employee.findOne = async () => makeEmployee();
    LeaveRequest.findAndCountAll = async (options) => {
        capturedOptions = options;
        return { rows: [], count: 0 };
    };

    await getLeaveRequestsByEmployee('EMP001');

    assert.equal(capturedOptions.limit,  50);
    assert.equal(capturedOptions.offset, 0);
    assert.equal(capturedOptions.where.employeeId, 'EMP001');
});

// ---------------------------------------------------------------------------
// getLeaveRequestsByEmployee - employee not found
// ---------------------------------------------------------------------------

test('throws when the employee does not exist or is inactive', async (t) => {
    const originalFindOneEmployee = Employee.findOne;

    t.after(() => {
        Employee.findOne = originalFindOneEmployee;
    });

    Employee.findOne = async () => null; // employee not found

    await assert.rejects(
        () => getLeaveRequestsByEmployee('EMP999'),
        /Active employee with ID EMP999 not found/,
    );
});

// ---------------------------------------------------------------------------
// getLeaveRequestsByEmployee - returns records ordered newest first
// ---------------------------------------------------------------------------

test('orders results by createdAt descending', async (t) => {
    const originalFindOneEmployee     = Employee.findOne;
    const originalFindAndCountAllLeave = LeaveRequest.findAndCountAll;

    t.after(() => {
        Employee.findOne              = originalFindOneEmployee;
        LeaveRequest.findAndCountAll  = originalFindAndCountAllLeave;
    });

    let capturedOrder;

    Employee.findOne = async () => makeEmployee();
    LeaveRequest.findAndCountAll = async ({ order }) => {
        capturedOrder = order;
        return { rows: [], count: 0 };
    };

    await getLeaveRequestsByEmployee('EMP001');

    assert.deepEqual(capturedOrder, [['createdAt', 'DESC']]);
});

// ---------------------------------------------------------------------------
// getLeaveRequestsByEmployee - no status filter returns all statuses
// ---------------------------------------------------------------------------

test('does not add a status filter when status is not supplied', async (t) => {
    const originalFindOneEmployee     = Employee.findOne;
    const originalFindAndCountAllLeave = LeaveRequest.findAndCountAll;

    t.after(() => {
        Employee.findOne              = originalFindOneEmployee;
        LeaveRequest.findAndCountAll  = originalFindAndCountAllLeave;
    });

    let capturedWhere;

    Employee.findOne = async () => makeEmployee();
    LeaveRequest.findAndCountAll = async ({ where }) => {
        capturedWhere = where;
        return { rows: [], count: 0 };
    };

    await getLeaveRequestsByEmployee('EMP001', {});

    // Only employeeId should be set — no 'status' key
    assert.deepEqual(Object.keys(capturedWhere), ['employeeId']);
});

// ---------------------------------------------------------------------------
// getLeaveRequestsByEmployee - all status values are accepted
// ---------------------------------------------------------------------------

test('accepts all valid status values as filters', async (t) => {
    const originalFindOneEmployee     = Employee.findOne;
    const originalFindAndCountAllLeave = LeaveRequest.findAndCountAll;

    t.after(() => {
        Employee.findOne              = originalFindOneEmployee;
        LeaveRequest.findAndCountAll  = originalFindAndCountAllLeave;
    });

    const statuses = ['pending', 'supervisor_approved', 'approved', 'rejected', 'cancelled'];

    for (const status of statuses) {
        let capturedWhere;

        Employee.findOne = async () => makeEmployee();
        LeaveRequest.findAndCountAll = async ({ where }) => {
            capturedWhere = where;
            return { rows: [], count: 0 };
        };

        await getLeaveRequestsByEmployee('EMP001', { status });

        assert.equal(capturedWhere.status, status,
            `Expected status filter to be "${status}"`);
    }
});

// ---------------------------------------------------------------------------
// getAllLeaveRequests - assigned HOD/supervisor queue
// ---------------------------------------------------------------------------

test('assigned queue filters leave requests by viewer hod or supervisor', async (t) => {
    const originalFindAndCountAllLeave = LeaveRequest.findAndCountAll;
    const originalFindAllEmployee = Employee.findAll;

    t.after(() => {
        LeaveRequest.findAndCountAll = originalFindAndCountAllLeave;
        Employee.findAll = originalFindAllEmployee;
    });

    let capturedWhere;
    LeaveRequest.findAndCountAll = async ({ where }) => {
        capturedWhere = where;
        return { rows: [], count: 0 };
    };
    Employee.findAll = async () => [];

    await getAllLeaveRequests({}, 10, 'manager');

    assert.ok(capturedWhere[Op.or]);
    assert.deepEqual(capturedWhere[Op.or], [
        { hod: 10 },
        { supervisor: 10 },
    ]);
});

// ---------------------------------------------------------------------------
// getAdminLeaveRequests - org-wide admin list
// ---------------------------------------------------------------------------

test('admin list returns all leave requests without hod/supervisor filter', async (t) => {
    const originalFindAndCountAllLeave = LeaveRequest.findAndCountAll;
    const originalFindAllEmployee = Employee.findAll;

    t.after(() => {
        LeaveRequest.findAndCountAll = originalFindAndCountAllLeave;
        Employee.findAll = originalFindAllEmployee;
    });

    let capturedWhere;
    LeaveRequest.findAndCountAll = async ({ where }) => {
        capturedWhere = where;
        return { rows: [makeLeaveRequest()], count: 1 };
    };
    Employee.findAll = async () => [];

    const result = await getAdminLeaveRequests({ status: 'pending' }, 99, 'admin');

    assert.equal(capturedWhere.status, 'pending');
    assert.equal(capturedWhere[Op.or], undefined);
    assert.equal(result.records.length, 1);
    assert.equal(result.records[0].canAccept, true);
});

test('admin list applies employeeId and pagination filters', async (t) => {
    const originalFindAndCountAllLeave = LeaveRequest.findAndCountAll;
    const originalFindAllEmployee = Employee.findAll;

    t.after(() => {
        LeaveRequest.findAndCountAll = originalFindAndCountAllLeave;
        Employee.findAll = originalFindAllEmployee;
    });

    let capturedOptions;
    LeaveRequest.findAndCountAll = async (options) => {
        capturedOptions = options;
        return { rows: [], count: 0 };
    };
    Employee.findAll = async () => [];

    await getAdminLeaveRequests({ employeeId: 'EMP001', page: 2, limit: 10 }, 99, 'admin');

    assert.equal(capturedOptions.where.employeeId, 'EMP001');
    assert.equal(capturedOptions.limit, 10);
    assert.equal(capturedOptions.offset, 10);
});
