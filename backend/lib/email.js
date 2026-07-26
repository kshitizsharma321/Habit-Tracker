// Transactional email via Gmail's own SMTP server (nodemailer).
//
// WHY NOT AN ESP: Resend, Brevo, SendGrid & co. all refuse a @gmail.com sender
// on free plans — a third party sending "from" gmail.com fails SPF/DKIM
// alignment, so they require a domain you own. Sending through Gmail itself
// makes Google the actual sender: alignment is perfect, inbox placement is
// excellent, and it costs nothing without a domain.
//
// Setup (the Gmail account that sends the mail):
//   1. Enable 2-Step Verification — myaccount.google.com/security
//   2. Create an App Password  — myaccount.google.com/apppasswords
//      (16 characters; App Passwords only exist once 2FA is on)
//   3. GMAIL_USER = that address · GMAIL_APP_PASSWORD = the 16-char password
//
// Limits: 500 recipients/day on a free Gmail account — far beyond this app's
// needs. Optional like every other integration: without the env vars the app
// runs fine and forgot-password quietly no-ops.

const nodemailer = require('nodemailer');

let transporter = null;

function isEmailConfigured() {
  return !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
}

// Lazy + cached, mirroring lib/supabase.js: the server must boot without email
// env, and reusing one transporter keeps the SMTP connection pooled.
function getTransporter() {
  if (!isEmailConfigured()) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false, // STARTTLS upgrade on 587
      auth: {
        user: process.env.GMAIL_USER,
        // App Passwords are shown with spaces ("abcd efgh ijkl mnop") — strip
        // them so a copy-paste straight from Google doesn't fail auth.
        pass: process.env.GMAIL_APP_PASSWORD.replace(/\s+/g, ''),
      },
      pool: true,
      maxConnections: 1,
    });
  }
  return transporter;
}

async function sendEmail({ to, subject, html, text }) {
  const tx = getTransporter();
  if (!tx) return false;

  await tx.sendMail({
    from: `"${process.env.GMAIL_FROM_NAME || 'Habit Tracker'}" <${process.env.GMAIL_USER}>`,
    to,
    subject,
    html,
    text,
  });
  return true;
}

// Shared shell so every mail matches the app's look without a template engine.
function emailLayout(inner) {
  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#f4f6f4;padding:32px 16px;">
    <div style="max-width:440px;margin:0 auto;background:#ffffff;border:1px solid #e2e8e2;border-radius:12px;padding:32px;">
      <div style="font-size:32px;text-align:center;">🌿</div>
      <h1 style="font-size:20px;text-align:center;color:#1a202c;margin:8px 0 24px;">Habit Tracker</h1>
      ${inner}
    </div>
    <p style="max-width:440px;margin:16px auto 0;text-align:center;color:#94a394;font-size:12px;">
      You received this because a password reset was requested for your Habit Tracker account.
    </p>
  </div>`;
}

async function sendPasswordResetEmail({ to, username, resetUrl }) {
  const inner = `
      <p style="color:#4a5568;font-size:14px;line-height:1.6;">Hi <strong>@${username}</strong>,</p>
      <p style="color:#4a5568;font-size:14px;line-height:1.6;">
        Tap the button below to choose a new password. The link works <strong>once</strong> and expires in <strong>30 minutes</strong>.
      </p>
      <div style="text-align:center;margin:24px 0;">
        <a href="${resetUrl}" style="display:inline-block;background:#4a7c59;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 28px;border-radius:8px;">Reset password</a>
      </div>
      <p style="color:#718096;font-size:12px;line-height:1.6;">
        If the button doesn't work, paste this into your browser:<br>
        <a href="${resetUrl}" style="color:#4a7c59;word-break:break-all;">${resetUrl}</a>
      </p>
      <p style="color:#718096;font-size:12px;line-height:1.6;">
        Didn't request this? Ignore this email — your password stays unchanged.
      </p>`;

  return sendEmail({
    to,
    subject: 'Reset your Habit Tracker password',
    html: emailLayout(inner),
    text: `Hi @${username},\n\nReset your Habit Tracker password (link works once, expires in 30 minutes):\n${resetUrl}\n\nIf you didn't request this, ignore this email — your password stays unchanged.`,
  });
}

// Google-only accounts have no password to reset — telling the owner by email
// leaks nothing (only they read it) while the API response stays generic.
async function sendGoogleAccountNotice({ to, username }) {
  const inner = `
      <p style="color:#4a5568;font-size:14px;line-height:1.6;">Hi <strong>@${username}</strong>,</p>
      <p style="color:#4a5568;font-size:14px;line-height:1.6;">
        A password reset was requested for this account — but it signs in with <strong>Google</strong> and has no password.
        Just use the <strong>"Sign in with Google"</strong> button on the login page.
      </p>
      <p style="color:#718096;font-size:12px;line-height:1.6;">
        Didn't request this? You can safely ignore this email.
      </p>`;

  return sendEmail({
    to,
    subject: 'Your Habit Tracker account uses Google Sign-In',
    html: emailLayout(inner),
    text: `Hi @${username},\n\nA password reset was requested for this account — but it signs in with Google and has no password. Use the "Sign in with Google" button on the login page.\n\nIf you didn't request this, ignore this email.`,
  });
}

module.exports = { isEmailConfigured, sendEmail, sendPasswordResetEmail, sendGoogleAccountNotice };
