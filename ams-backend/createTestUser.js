require('dotenv').config();
const bcrypt    = require('bcrypt');
const sequelize = require('./config/db');
const Employee  = require('./src/models/Employee');

const createTestUser = async () => {

    await sequelize.authenticate();
    await sequelize.sync({ alter: true });

    const hashed = await bcrypt.hash('Test@1234', 10);

    await Employee.create({
        firstName: 'Admin',
        lastName:  'User',
        email:     'admin@ams.com',
        password:  hashed,
        role:      'admin',
    });

    console.log('Test user created: admin@ams.com / Test@1234');
    process.exit(0);
};

createTestUser().catch(console.error);