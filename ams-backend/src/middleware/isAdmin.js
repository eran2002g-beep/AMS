const isAdmin = (req, res, next) => {
  // TODO: Replace with your real JWT/session auth check
  // Skipping role check during development
  next();
};

module.exports = isAdmin;