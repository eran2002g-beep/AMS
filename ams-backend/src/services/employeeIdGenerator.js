const generateNextEmployeeId = (existingIds = []) => {
  const matches = (existingIds || [])
    .filter((value) => typeof value === 'string')
    .map((value) => value.trim())
    .filter((value) => /^EMP\d+$/.test(value))
    .map((value) => Number(value.replace(/^EMP/, '')))
    .filter((value) => Number.isInteger(value) && value > 0);

  const nextNumber = matches.length > 0 ? Math.max(...matches) + 1 : 1;
  return `EMP${String(nextNumber).padStart(3, '0')}`;
};

module.exports = {
  generateNextEmployeeId,
};
