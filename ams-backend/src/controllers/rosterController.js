const sql = require("../db/neon");

// ─────────────────────────────────────────────
// DELETE /api/rosters/by-date?date=YYYY-MM-DD
// Delete a single roster by exact date
// ─────────────────────────────────────────────
const deleteRosterByDate = async (req, res) => {
  const { date } = req.query;

  if (!date) {
    return res.status(400).json({
      success: false,
      message: "Query parameter 'date' is required (e.g., 2024-06-15).",
    });
  }

  const parsedDate = new Date(date);
  if (isNaN(parsedDate)) {
    return res.status(400).json({
      success: false,
      message: "Invalid date format. Please use YYYY-MM-DD.",
    });
  }

  try {
    // Check if roster exists for this date
    const existing = await sql`
      SELECT id, name FROM rosters
      WHERE schedule_date = ${date}::date
      LIMIT 1
    `;

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No roster found for date ${date}.`,
      });
    }

    // Delete the roster
    const deleted = await sql`
      DELETE FROM rosters
      WHERE schedule_date = ${date}::date
      RETURNING id, name, schedule_date
    `;

    return res.status(200).json({
      success: true,
      message: `Roster for ${date} deleted successfully..`,
      deletedRoster: deleted[0],
    });
  } catch (error) {
    console.error("Error deleting roster by date:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error. Failed to delete roster.",
    });
  }
};

// ─────────────────────────────────────────────
// DELETE /api/rosters/by-month?month=MM&year=YYYY
// Delete all rosters matching a specific month and year
// ─────────────────────────────────────────────
const deleteRostersByMonth = async (req, res) => {
  const { month, year } = req.query;

  if (!month || isNaN(month) || month < 1 || month > 12) {
    return res.status(400).json({
      success: false,
      message: "Valid query parameter 'month' is required (1–12).",
    });
  }

  if (!year || isNaN(year) || year.toString().length !== 4) {
    return res.status(400).json({
      success: false,
      message: "Valid query parameter 'year' is required (e.g., 2024).",
    });
  }

  try {
    // Check if any rosters exist for this month/year
    const existing = await sql`
      SELECT COUNT(*) AS count FROM rosters
      WHERE EXTRACT(MONTH FROM schedule_date) = ${parseInt(month)}
        AND EXTRACT(YEAR  FROM schedule_date) = ${parseInt(year)}
    `;

    const count = parseInt(existing[0].count);

    if (count === 0) {
      return res.status(404).json({
        success: false,
        message: `No rosters found for ${month}/${year}.`,
      });
    }

    // Delete all rosters for that month and year
    const deleted = await sql`
      DELETE FROM rosters
      WHERE EXTRACT(MONTH FROM schedule_date) = ${parseInt(month)}
        AND EXTRACT(YEAR  FROM schedule_date) = ${parseInt(year)}
      RETURNING id, name, schedule_date
    `;

    return res.status(200).json({
      success: true,
      message: `${deleted.length} roster(s) for ${month}/${year} deleted successfully.`,
      deletedCount: deleted.length,
      deletedRosters: deleted,
    });
  } catch (error) {
    console.error("Error deleting rosters by month/year:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error. Failed to delete rosters.",
    });
  }
};

module.exports = {
  deleteRosterByDate,
  deleteRostersByMonth,
};
