// src/utils/publicId.js - generate next sequential public IDs (ATT001, LOG001, etc.)

const nextSequentialPublicId = async (Model, fieldName, prefix) => {
    const records = await Model.findAll({
        attributes: [fieldName],
        raw: true,
    });

    const maxNum = records.reduce((max, row) => {
        const value = row[fieldName];
        if (typeof value !== 'string' || !value.startsWith(prefix)) return max;

        const num = Number.parseInt(value.slice(prefix.length), 10);
        return Number.isNaN(num) ? max : Math.max(max, num);
    }, 0);

    const padded = String(maxNum + 1).padStart(3, '0');
    return `${prefix}${padded}`;
};

module.exports = {
    nextSequentialPublicId,
};
