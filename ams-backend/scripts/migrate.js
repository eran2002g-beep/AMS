const fs = require('node:fs/promises');
const path = require('node:path');

const sequelize = require('../config/db');

const migrationsDirectory = path.join(__dirname, '..', 'migrations');

const run = async () => {
    await sequelize.authenticate();
    await sequelize.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
            name VARCHAR(255) PRIMARY KEY,
            executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
    `);

    const [appliedRows] = await sequelize.query('SELECT name FROM schema_migrations;');
    const appliedMigrations = new Set(appliedRows.map(({ name }) => name));
    const migrationFiles = (await fs.readdir(migrationsDirectory))
        .filter((file) => file.endsWith('.js'))
        .sort();

    for (const file of migrationFiles) {
        if (appliedMigrations.has(file)) continue;

        const migration = require(path.join(migrationsDirectory, file));
        if (typeof migration.up !== 'function') {
            throw new Error(`Migration ${file} does not export an up function`);
        }

        console.log(`Running migration: ${file}`);
        await migration.up(sequelize);
        await sequelize.query(
            'INSERT INTO schema_migrations (name) VALUES (:name);',
            { replacements: { name: file } },
        );
        console.log(`Completed migration: ${file}`);
    }

    console.log('Database migrations are up to date.');
};

run()
    .catch((error) => {
        console.error('Database migration failed:', error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await sequelize.close();
    });
