// Legacy migration: original leave_requests shape (attendanceId/date/requestType).
// Current LeaveRequest schema is created/evolved via sequelize.sync + later migrations.
// If the table already exists, skip so migrate can proceed on existing databases.

const up = async (sequelize) => {
    const [existing] = await sequelize.query(`
        SELECT 1 AS present
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'leave_requests'
        LIMIT 1;
    `);

    if (existing.length > 0) {
        return;
    }

    await sequelize.transaction(async (transaction) => {
        await sequelize.query(`
            DO $$ BEGIN
                CREATE TYPE "enum_leave_requests_requestType"
                    AS ENUM ('unauthorised', 'leave');
            EXCEPTION
                WHEN duplicate_object THEN NULL;
            END $$;
        `, { transaction });

        await sequelize.query(`
            DO $$ BEGIN
                CREATE TYPE "enum_leave_requests_status"
                    AS ENUM ('pending', 'approved', 'rejected');
            EXCEPTION
                WHEN duplicate_object THEN NULL;
            END $$;
        `, { transaction });

        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS leave_requests (
                id SERIAL PRIMARY KEY,
                "leaveRequestId" VARCHAR(255) NOT NULL UNIQUE,
                "employeeId" VARCHAR(255) NOT NULL,
                "attendanceId" INTEGER NULL,
                "date" DATE NOT NULL,
                "requestType" "enum_leave_requests_requestType" NOT NULL DEFAULT 'unauthorised',
                "status" "enum_leave_requests_status" NOT NULL DEFAULT 'pending',
                "reason" TEXT NULL,
                "reviewerId" VARCHAR(255) NULL,
                "reviewNotes" TEXT NULL,
                "reviewedAt" TIMESTAMPTZ NULL,
                "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        `, { transaction });

        await sequelize.query(`
            CREATE INDEX IF NOT EXISTS leave_requests_employee_id_idx ON leave_requests("employeeId");
        `, { transaction });

        await sequelize.query(`
            CREATE INDEX IF NOT EXISTS leave_requests_attendance_id_idx ON leave_requests("attendanceId");
        `, { transaction });
    });
};

const down = async (sequelize) => {
    await sequelize.transaction(async (transaction) => {
        await sequelize.query(`
            DROP TABLE IF EXISTS leave_requests;
        `, { transaction });

        await sequelize.query(`
            DROP TYPE IF EXISTS "enum_leave_requests_requestType";
            DROP TYPE IF EXISTS "enum_leave_requests_status";
        `, { transaction });
    });
};

module.exports = {
    up,
    down,
};
