const up = async (sequelize) => {
    await sequelize.transaction(async (transaction) => {
        await sequelize.query(`
            DO $$ BEGIN
                CREATE TYPE "enum_unauthorised_requests_leaveType"
                    AS ENUM ('annual', 'sick', 'casual', 'unpaid', 'other');
            EXCEPTION
                WHEN duplicate_object THEN NULL;
            END $$;
        `, { transaction });

        await sequelize.query(`
            DO $$ BEGIN
                CREATE TYPE "enum_unauthorised_requests_status"
                    AS ENUM ('pending', 'approved', 'rejected', 'cancelled');
            EXCEPTION
                WHEN duplicate_object THEN NULL;
            END $$;
        `, { transaction });

        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS unauthorised_requests (
                id SERIAL PRIMARY KEY,
                "unauthorisedRequestId" VARCHAR(255) NOT NULL UNIQUE,
                "employeeId" VARCHAR(255) NOT NULL,
                "attendanceId" INTEGER NOT NULL
                    REFERENCES attendance(id) ON UPDATE CASCADE ON DELETE CASCADE,
                "leaveType" "enum_unauthorised_requests_leaveType" NOT NULL,
                "startDate" DATE NOT NULL,
                "endDate" DATE NOT NULL,
                "totalDays" INTEGER NOT NULL,
                reason TEXT NOT NULL,
                description TEXT NOT NULL,
                status "enum_unauthorised_requests_status" NOT NULL DEFAULT 'pending',
                "reviewedBy" VARCHAR(255) NULL,
                "reviewComments" TEXT NULL,
                "reviewedAt" TIMESTAMPTZ NULL,
                hod INTEGER NULL
                    REFERENCES employees(id) ON UPDATE CASCADE ON DELETE SET NULL,
                supervisor INTEGER NULL
                    REFERENCES employees(id) ON UPDATE CASCADE ON DELETE SET NULL,
                "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        `, { transaction });

        await sequelize.query(`
            CREATE INDEX IF NOT EXISTS unauthorised_requests_employee_id_idx
                ON unauthorised_requests("employeeId");
            CREATE INDEX IF NOT EXISTS unauthorised_requests_attendance_id_idx
                ON unauthorised_requests("attendanceId");
            CREATE INDEX IF NOT EXISTS unauthorised_requests_hod_idx
                ON unauthorised_requests(hod);
            CREATE INDEX IF NOT EXISTS unauthorised_requests_supervisor_idx
                ON unauthorised_requests(supervisor);
        `, { transaction });
    });
};

const down = async (sequelize) => {
    await sequelize.transaction(async (transaction) => {
        await sequelize.query(`
            DROP TABLE IF EXISTS unauthorised_requests;
        `, { transaction });

        await sequelize.query(`
            DROP TYPE IF EXISTS "enum_unauthorised_requests_leaveType";
            DROP TYPE IF EXISTS "enum_unauthorised_requests_status";
        `, { transaction });
    });
};

module.exports = {
    up,
    down,
};
