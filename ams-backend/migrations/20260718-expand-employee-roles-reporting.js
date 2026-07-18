const up = async (sequelize) => {
    // PostgreSQL enum values must be committed before they can be used.
    // Run each addition outside the schema transaction.
    for (const role of ['manager', 'admin-manager', 'super-admin']) {
        await sequelize.query(
            `ALTER TYPE "enum_employees_role" ADD VALUE IF NOT EXISTS '${role}';`,
        );
    }

    await sequelize.transaction(async (transaction) => {
        await sequelize.query(`
            ALTER TABLE employees
            ADD COLUMN IF NOT EXISTS hod INTEGER,
            ADD COLUMN IF NOT EXISTS supervisor INTEGER;
        `, { transaction });

        await sequelize.query(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1
                    FROM pg_constraint
                    WHERE conname = 'employees_hod_fkey'
                      AND conrelid = 'employees'::regclass
                ) THEN
                    ALTER TABLE employees
                    ADD CONSTRAINT employees_hod_fkey
                    FOREIGN KEY (hod) REFERENCES employees(id)
                    ON UPDATE CASCADE ON DELETE SET NULL;
                END IF;

                IF NOT EXISTS (
                    SELECT 1
                    FROM pg_constraint
                    WHERE conname = 'employees_supervisor_fkey'
                      AND conrelid = 'employees'::regclass
                ) THEN
                    ALTER TABLE employees
                    ADD CONSTRAINT employees_supervisor_fkey
                    FOREIGN KEY (supervisor) REFERENCES employees(id)
                    ON UPDATE CASCADE ON DELETE SET NULL;
                END IF;
            END $$;
        `, { transaction });

        await sequelize.query(`
            CREATE INDEX IF NOT EXISTS employees_hod_idx ON employees(hod);
            CREATE INDEX IF NOT EXISTS employees_supervisor_idx ON employees(supervisor);
        `, { transaction });
    });
};

const down = async (sequelize) => {
    await sequelize.transaction(async (transaction) => {
        await sequelize.query(`
            DROP INDEX IF EXISTS employees_supervisor_idx;
            DROP INDEX IF EXISTS employees_hod_idx;
            ALTER TABLE employees
                DROP CONSTRAINT IF EXISTS employees_supervisor_fkey,
                DROP CONSTRAINT IF EXISTS employees_hod_fkey,
                DROP COLUMN IF EXISTS supervisor,
                DROP COLUMN IF EXISTS hod;
        `, { transaction });
    });

    // PostgreSQL cannot remove individual enum values safely without rebuilding
    // the enum type, so role values intentionally remain after rollback.
};

module.exports = {
    up,
    down,
};
