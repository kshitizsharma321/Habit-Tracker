const { IS_PRODUCTION } = require('./config');

// Raw error text leaks internals: Mongoose validation errors name schema fields,
// driver errors expose collection/index names, and some libraries put paths or
// connection strings in `.message`. None of that helps a user, all of it helps
// an attacker map the system (audit S7).
//
// So: always log the full error server-side, but only return its message to the
// client outside production — where it's genuinely useful during development.
function sendError(res, status, error, err) {
  if (err) console.error(`${error}:`, err);
  const body = { error };
  if (!IS_PRODUCTION && err?.message) body.message = err.message;
  return res.status(status).json(body);
}

module.exports = { sendError };
