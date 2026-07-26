const mongoose = require('mongoose');

// Rejects malformed :id params with a clean 400 instead of a Mongoose CastError 500.
function validateObjectId(param = 'id') {
  return (req, res, next) => {
    if (!mongoose.isValidObjectId(req.params[param])) {
      return res.status(400).json({ error: `Invalid ${param}` });
    }
    next();
  };
}

module.exports = { validateObjectId };
