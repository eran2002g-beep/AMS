const test = require('node:test');
const assert = require('node:assert/strict');
const { Op } = require('sequelize');

const Employee = require('../src/models/Employee');
const {
    getAdministrativeEmployees,
    getManagers,
    validateReportingRelationships,
} = require('../src/services/employeeService');
const {
    VALID_ROLES,
    validateEmployeePayload,
} = require('../src/services/employeeValidation');
const { isAdministrativeRole } = require('../src/middleware/isAdmin');

test('accepts every supported employee role', () => {
    assert.deepEqual(
        VALID_ROLES,
        ['employee', 'manager', 'admin-manager', 'admin', 'super-admin'],
    );

    for (const role of VALID_ROLES) {
        assert.equal(validateEmployeePayload({ role }).role, role);
    }
    assert.throws(
        () => validateEmployeePayload({ role: 'owner' }),
        /role must be one of/,
    );
});

test('validates HOD and supervisor as nullable positive Employee ids', () => {
    assert.deepEqual(
        validateEmployeePayload({ hod: 10, supervisor: null }),
        { hod: 10, supervisor: null },
    );
    assert.throws(
        () => validateEmployeePayload({ hod: '10' }),
        /hod must be a positive Employee id or null/,
    );
    assert.throws(
        () => validateEmployeePayload({ supervisor: 0 }),
        /supervisor must be a positive Employee id or null/,
    );
});

test('defines self-referencing HOD and supervisor associations', () => {
    assert.equal(Employee.associations.hodEmployee.foreignKey, 'hod');
    assert.equal(Employee.associations.supervisorEmployee.foreignKey, 'supervisor');
    assert.equal(Employee.rawAttributes.hod.references.key, 'id');
    assert.equal(Employee.rawAttributes.supervisor.references.key, 'id');
});

test('rejects self-reference and missing reporting employees', async (t) => {
    await assert.rejects(
        validateReportingRelationships({ hod: 7 }, 7),
        /cannot be their own HOD or supervisor/,
    );

    const originalFindAll = Employee.findAll;
    t.after(() => {
        Employee.findAll = originalFindAll;
    });
    Employee.findAll = async () => [{ id: 2 }];

    await assert.rejects(
        validateReportingRelationships({ hod: 2, supervisor: 3 }),
        /Active reporting employee\(s\) not found: 3/,
    );
});

test('queries active admin and admin-manager employees with reporting objects', async (t) => {
    const originalFindAll = Employee.findAll;
    let query;
    t.after(() => {
        Employee.findAll = originalFindAll;
    });
    Employee.findAll = async (options) => {
        query = options;
        return [];
    };

    const employees = await getAdministrativeEmployees();

    assert.deepEqual(employees, []);
    assert.equal(query.where.isActive, true);
    assert.deepEqual(query.where.role[Op.in], ['admin', 'admin-manager']);
    assert.deepEqual(query.include.map(({ as }) => as), ['hodEmployee', 'supervisorEmployee']);
    assert.deepEqual(query.order, [['lastName', 'ASC'], ['firstName', 'ASC']]);
});

test('queries active manager and admin-manager employees for hierarchy assignment', async (t) => {
    const originalFindAll = Employee.findAll;
    let query;
    t.after(() => {
        Employee.findAll = originalFindAll;
    });
    Employee.findAll = async (options) => {
        query = options;
        return [];
    };

    const managers = await getManagers();

    assert.deepEqual(managers, []);
    assert.equal(query.where.isActive, true);
    assert.deepEqual(query.where.role[Op.in], ['manager', 'admin-manager']);
    assert.deepEqual(
        query.attributes,
        ['id', 'employeeId', 'firstName', 'lastName', 'email', 'department', 'role'],
    );
    assert.deepEqual(query.order, [['lastName', 'ASC'], ['firstName', 'ASC']]);
});

test('grants administrative access only to configured admin roles', () => {
    assert.equal(isAdministrativeRole('super-admin'), true);
    assert.equal(isAdministrativeRole('admin'), true);
    assert.equal(isAdministrativeRole('admin-manager'), true);
    assert.equal(isAdministrativeRole('manager'), false);
    assert.equal(isAdministrativeRole('employee'), false);
});
