const up = async (sequelize) => {
    await sequelize.transaction(async (transaction) => {
        await sequelize.query(`
            ALTER TABLE leave_requests
            ADD COLUMN IF NOT EXISTS hod INTEGER,
            ADD COLUMN IF NOT EXISTS supervisor INTEGER;
        `, { transaction });

        await sequelize.query(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1
                    FROM pg_constraint
                    WHERE conname = 'leave_requests_hod_fkey'
                      AND conrelid = 'leave_requests'::regclass
                ) THEN
                    ALTER TABLE leave_requests
                    ADD CONSTRAINT leave_requests_hod_fkey
                    FOREIGN KEY (hod) REFERENCES employees(id)
                    ON UPDATE CASCADE ON DELETE SET NULL;
                END IF;

                IF NOT EXISTS (
                    SELECT 1
                    FROM pg_constraint
                    WHERE conname = 'leave_requests_supervisor_fkey'
                      AND conrelid = 'leave_requests'::regclass
                ) THEN
                    ALTER TABLE leave_requests
                    ADD CONSTRAINT leave_requests_supervisor_fkey
                    FOREIGN KEY (supervisor) REFERENCES employees(id)
                    ON UPDATE CASCADE ON DELETE SET NULL;
                END IF;
            END $$;
        `, { transaction });

        await sequelize.query(`
            CREATE INDEX IF NOT EXISTS leave_requests_hod_idx ON leave_requests(hod);
            CREATE INDEX IF NOT EXISTS leave_requests_supervisor_idx ON leave_requests(supervisor);
        `, { transaction });
    });
};

const down = async (sequelize) => {
    await sequelize.transaction(async (transaction) => {
        await sequelize.query(`
            DROP INDEX IF EXISTS leave_requests_supervisor_idx;
            DROP INDEX IF EXISTS leave_requests_hod_idx;
            ALTER TABLE leave_requests
                DROP CONSTRAINT IF EXISTS leave_requests_supervisor_fkey,
                DROP CONSTRAINT IF EXISTS leave_requests_hod_fkey,
                DROP COLUMN IF EXISTS supervisor,
                DROP COLUMN IF EXISTS hod;
        `, { transaction });
    });
};

module.exports = {
    up,
    down,
};
