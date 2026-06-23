const rosterService = require("../services/rosterService");

// DELETE /roster/by-date?date=YYYY-MM-DD
const deleteRosterByDate = async (req, res) => {
  const { date } = req.query;

  if (!date) {
    return res.status(400).json({
      success: false,
      message: "Query parameter 'date' is required (e.g., 2025-06-01).",
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
    const result = await rosterService.deleteRosterByDate(date);

    if (!result) {
      return res.status(404).json({
        success: false,
        message: `No roster found for date ${date}.`,
      });
    }

    return res.status(200).json({
      success: true,
      message: `Roster for ${date} deleted successfully.`,
      deletedCount: result.deletedCount,
      deletedRosters: result.deletedRosters,
    });
  } catch (error) {
    console.error("Error deleting roster by date:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error. Failed to delete roster.",
      error: error.message,
    });
  }
};

// DELETE /roster/by-month?month=MM&year=YYYY
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
      message: "Valid query parameter 'year' is required (e.g., 2025).",
    });
  }

  try {
    const result = await rosterService.deleteRostersByMonth(month, year);

    if (!result) {
      return res.status(404).json({
        success: false,
        message: `No rosters found for ${month}/${year}.`,
      });
    }

    return res.status(200).json({
      success: true,
      message: `${result.deletedCount} roster(s) for ${month}/${year} deleted successfully.`,
      deletedCount: result.deletedCount,
      deletedRosters: result.deletedRosters,
    });
  } catch (error) {
    console.error("Error deleting rosters by month/year:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error. Failed to delete rosters.",
      error: error.message,
    });
  }
};

module.exports = {
  deleteRosterByDate,
  deleteRostersByMonth,
};
