const jwt = require('jsonwebtoken');
const User = require('../models/User');

if (!process.env.JWT_SECRET) {
  console.error('❌ JWT_SECRET must be set in environment');
  process.exit(1);
}
const JWT_SECRET = process.env.JWT_SECRET;

function signToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '30d' });
}

// Short-lived token that lets an admin act as another user. The `imp` claim
// records who is impersonating; destructive routes check req.impersonatorId.
function signImpersonationToken(targetUserId, adminId) {
  return jwt.sign({ userId: targetUserId, imp: String(adminId) }, JWT_SECRET, { expiresIn: '1h' });
}

async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    req.user = user;
    if (decoded.imp) req.impersonatorId = decoded.imp;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { signToken, signImpersonationToken, requireAuth };
