const up = async (sequelize) => {
    await sequelize.transaction(async (transaction) => {
        await sequelize.query(`
            ALTER TABLE unauthorised_requests
            ADD COLUMN IF NOT EXISTS "clockIn" TIME NULL,
            ADD COLUMN IF NOT EXISTS "clockOut" TIME NULL;
        `, { transaction });
    });
};

const down = async (sequelize) => {
    await sequelize.transaction(async (transaction) => {
        await sequelize.query(`
            ALTER TABLE unauthorised_requests
                DROP COLUMN IF EXISTS "clockOut",
                DROP COLUMN IF EXISTS "clockIn";
        `, { transaction });
    });
};

module.exports = {
    up,
    down,
};
