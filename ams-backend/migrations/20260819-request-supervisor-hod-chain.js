// Sequential supervisor → HOD review: add supervisor_approved to request status enums.
// ADD VALUE cannot reliably run inside a transaction on older Postgres, and
// IF NOT EXISTS is a no-op when the value is already present.

const addEnumValue = async (sequelize, typeName, value) => {
    await sequelize.query(
        `ALTER TYPE "${typeName}" ADD VALUE IF NOT EXISTS '${value}';`,
    ).catch(() => {});
};

const up = async (sequelize) => {
    await addEnumValue(sequelize, 'enum_leave_requests_status', 'cancelled');
    await addEnumValue(sequelize, 'enum_leave_requests_status', 'supervisor_approved');
    await addEnumValue(sequelize, 'enum_unauthorised_requests_status', 'supervisor_approved');
};

const down = async () => {
    // PostgreSQL cannot drop individual enum values safely.
};

module.exports = {
    up,
    down,
};
