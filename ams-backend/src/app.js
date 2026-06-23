/*require("dotenv").config();
const express = require("express");
const rosterRoutes = require("./routes/rosterRoutes");

const app = express();

app.use(express.json());

// ─────────────────────────────────────────────
// Mock auth middleware
// Replace this with your real JWT/session logic
// ─────────────────────────────────────────────
app.use((req, res, next) => {
  req.user = { id: 1, role: "admin" }; // simulate logged-in admin
  next();
});

// ─────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────
app.use("/api/rosters", rosterRoutes);

// ─────────────────────────────────────────────
// 404 handler
// ─────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found." });
});

// ─────────────────────────────────────────────
// Start server
// ─────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});*/
