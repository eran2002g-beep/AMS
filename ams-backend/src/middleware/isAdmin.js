const isAdmin = (req, res, next) => {
  const userRole = req.user?.role; // set by your auth/JWT middleware...................................

  if (userRole !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Access denied. Admin privileges required.",
    });
  }
  next();
};

module.exports = isAdmin;