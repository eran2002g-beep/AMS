// src/services/rosterService.js - handles roster upload, parsing, and mapping to employees
const fs = require('fs');
const path = require('path');
const Roster = require('../models/Roster');
const Employee = require('../models/Employee');
const { parseRosterFile } = require('../utils/rosterParser');

const uploadRoster = async (metadata, file) => {
    if (!file) {
        throw new Error('Roster file is required.');
    }

    const { rosterName, startDate, endDate, department, uploadedBy } = metadata;

    if (!rosterName || !startDate || !endDate || !uploadedBy) {
        throw new Error('rosterName, startDate, endDate and uploadedBy are required.');
    }

    if (new Date(startDate) > new Date(endDate)) {
        throw new Error('startDate must be on or before endDate.');
    }

    const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
    const rosterRows = await parseRosterFile(file.path, file.originalname);

    // Create roster metadata record first so the upload is tracked.
    const roster = await Roster.create({
        rosterName,
        fileName: file.originalname,
        filePath: file.path,
        fileFormat: ext,
        startDate,
        endDate,
        department,
        uploadedBy,
    });

    // Build a single lookup map for employee records to avoid repeated DB queries.
    const employeeIds = [...new Set(rosterRows.map((row) => row.employeeId))];
    const employees = await Employee.findAll({
        where: { employeeId: employeeIds },
    });
    const employeeMap = new Map(
        employees.map((emp) => [emp.employeeId, emp])
    );

    const mappedRows = rosterRows.map((row) => {
        const employee = employeeMap.get(row.employeeId);
        return {
            rosterRow: row,
            employee: employee
                ? {
                      id: employee.id,
                      employeeId: employee.employeeId,
                      firstName: employee.firstName,
                      lastName: employee.lastName,
                      email: employee.email,
                  }
                : null,
        };
    });

    const missingEmployeeIds = mappedRows
        .filter((item) => !item.employee)
        .map((item) => item.rosterRow.employeeId);

    return {
        roster,
        mappedRows,
        matchedCount: mappedRows.filter((item) => item.employee).length,
        missingEmployeeIds,
    };
};

module.exports = {
    uploadRoster,
};
