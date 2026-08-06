const up = async (sequelize) => {
    await sequelize.transaction(async (transaction) => {
        await sequelize.query(`
            ALTER TABLE unauthorised_requests
            ADD COLUMN IF NOT EXISTS "happenDate" DATE;
        `, { transaction });

        // Backfill from startDate when present (legacy rows created before this change)
        await sequelize.query(`
            UPDATE unauthorised_requests
            SET "happenDate" = "startDate"
            WHERE "happenDate" IS NULL
              AND "startDate" IS NOT NULL;
        `, { transaction });

        await sequelize.query(`
            ALTER TABLE unauthorised_requests
            ALTER COLUMN "happenDate" SET NOT NULL;
        `, { transaction });

        await sequelize.query(`
            ALTER TABLE unauthorised_requests
                DROP COLUMN IF EXISTS "leaveType",
                DROP COLUMN IF EXISTS "startDate",
                DROP COLUMN IF EXISTS "endDate",
                DROP COLUMN IF EXISTS "totalDays";
        `, { transaction });

        await sequelize.query(`
            DROP TYPE IF EXISTS "enum_unauthorised_requests_leaveType";
        `, { transaction });
    });
};

const down = async (sequelize) => {
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
            ALTER TABLE unauthorised_requests
                ADD COLUMN IF NOT EXISTS "leaveType" "enum_unauthorised_requests_leaveType",
                ADD COLUMN IF NOT EXISTS "startDate" DATE,
                ADD COLUMN IF NOT EXISTS "endDate" DATE,
                ADD COLUMN IF NOT EXISTS "totalDays" INTEGER;
        `, { transaction });

        await sequelize.query(`
            UPDATE unauthorised_requests
            SET
                "leaveType" = COALESCE("leaveType", 'other'),
                "startDate" = COALESCE("startDate", "happenDate"),
                "endDate" = COALESCE("endDate", "happenDate"),
                "totalDays" = COALESCE("totalDays", 1)
            WHERE "happenDate" IS NOT NULL;
        `, { transaction });

        await sequelize.query(`
            ALTER TABLE unauthorised_requests
                ALTER COLUMN "leaveType" SET NOT NULL,
                ALTER COLUMN "startDate" SET NOT NULL,
                ALTER COLUMN "endDate" SET NOT NULL,
                ALTER COLUMN "totalDays" SET NOT NULL,
                DROP COLUMN IF EXISTS "happenDate";
        `, { transaction });
    });
};

module.exports = {
    up,
    down,
};
