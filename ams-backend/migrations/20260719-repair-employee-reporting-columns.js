const up = async (sequelize) => {
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

module.exports = { up };
