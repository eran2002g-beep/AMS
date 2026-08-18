// Migration: leave attendance processing — reqLeave flag + half-day leave fields

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.sequelize.query(`
            ALTER TABLE attendance
            ADD COLUMN IF NOT EXISTS "reqLeave" BOOLEAN NOT NULL DEFAULT false;
        `);

        await queryInterface.sequelize.query(`
            DO $$ BEGIN
                CREATE TYPE "enum_leave_requests_duration" AS ENUM ('full_day', 'half_day');
            EXCEPTION
                WHEN duplicate_object THEN NULL;
            END $$;
        `);

        await queryInterface.sequelize.query(`
            DO $$ BEGIN
                CREATE TYPE "enum_leave_requests_halfDayPeriod" AS ENUM ('morning', 'afternoon');
            EXCEPTION
                WHEN duplicate_object THEN NULL;
            END $$;
        `);

        await queryInterface.sequelize.query(`
            ALTER TABLE leave_requests
            ADD COLUMN IF NOT EXISTS duration "enum_leave_requests_duration" NOT NULL DEFAULT 'full_day';
        `);

        await queryInterface.sequelize.query(`
            ALTER TABLE leave_requests
            ADD COLUMN IF NOT EXISTS "halfDayPeriod" "enum_leave_requests_halfDayPeriod";
        `);
    },

    async down(queryInterface) {
        await queryInterface.sequelize.query(`
            ALTER TABLE leave_requests DROP COLUMN IF EXISTS "halfDayPeriod";
        `);
        await queryInterface.sequelize.query(`
            ALTER TABLE leave_requests DROP COLUMN IF EXISTS duration;
        `);
        await queryInterface.sequelize.query(`
            ALTER TABLE attendance DROP COLUMN IF EXISTS "reqLeave";
        `);
        await queryInterface.sequelize.query(`
            DROP TYPE IF EXISTS "enum_leave_requests_halfDayPeriod";
        `);
        await queryInterface.sequelize.query(`
            DROP TYPE IF EXISTS "enum_leave_requests_duration";
        `);
    },
};
