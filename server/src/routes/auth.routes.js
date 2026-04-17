const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const axios = require("axios");
const pool = require("../db/pool");

const router = express.Router();
const allowSelfSignedMailTls =
  process.env.MAIL_ALLOW_SELF_SIGNED === "true" ||
  (process.env.NODE_ENV !== "production" && process.env.MAIL_ALLOW_SELF_SIGNED !== "false");
const isProduction = process.env.NODE_ENV === "production";
const hasMailCredentials = Boolean(
  String(process.env.MAIL_USER || "").trim() && String(process.env.MAIL_PASS || "").trim()
);

const validateStrongPassword = (password) => {
  const value = String(password || "");
  if (value.length < 6) {
    return "Password must be at least 6 characters";
  }
  if (!/[A-Z]/.test(value)) {
    return "Password must contain at least one uppercase letter";
  }
  if (!/[a-z]/.test(value)) {
    return "Password must contain at least one lowercase letter";
  }
  if (!/[0-9]/.test(value)) {
    return "Password must contain at least one number";
  }
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(value)) {
    return "Password must contain at least one special character";
  }
  return null;
};

// Configure email transporter for Gmail
const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST || "smtp.gmail.com",
  port: Number(process.env.MAIL_PORT || 587),
  secure: false,
  tls: {
    rejectUnauthorized: !allowSelfSignedMailTls,
  },
  auth: {
    user: process.env.MAIL_USER,
    pass: (process.env.MAIL_PASS || "").replace(/\s/g, ""),
  },
});

// Verify transporter on startup
transporter.verify((error, success) => {
  if (error) {
    if ((error.message || "").includes("self-signed certificate")) {
      console.warn("! Email transporter TLS warning:", error.message);
    } else {
      console.error("✗ Email transporter error:", error.message);
    }
  } else {
    console.log("✓ Email transporter ready");
  }
});

// Register
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const normalizedEmail = String(email || "").trim().toLowerCase();

    if (!name || !normalizedEmail || !password || !role) {
      return res.status(400).json({ error: "All fields required" });
    }

    const passwordError = validateStrongPassword(password);
    if (passwordError) {
      return res.status(400).json({ error: passwordError });
    }

    const connection = await pool.getConnection();

    // Check if user exists
    const [existingUser] = await connection.execute(
      "SELECT email FROM users WHERE email = ?",
      [normalizedEmail]
    );

    if (existingUser.length > 0) {
      await connection.release();
      return res.status(400).json({ error: "Email already registered" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user
    await connection.execute(
      "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)",
      [name, normalizedEmail, hashedPassword, role]
    );

    // Create JWT token
    const token = jwt.sign(
      { email: normalizedEmail, role },
      process.env.JWT_SECRET || "supersecret123",
      { expiresIn: "24h" }
    );

    await connection.release();

    res.status(201).json({ message: "User registered successfully", token });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Registration failed" });
  }
});

// Login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const loginId = String(email || "").trim();
    const normalizedEmail = loginId.toLowerCase();

    if (!loginId || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }

    const connection = await pool.getConnection();

    // Find user by email or exact username (name)
    const [users] = await connection.execute(
      "SELECT * FROM users WHERE email = ? OR name = ?",
      [normalizedEmail, loginId]
    );

    if (users.length === 0) {
      await connection.release();
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const user = users[0];

    // Check if account is active
    if (user.is_active === false || user.is_active === 0 || user.is_active === "0") {
      await connection.release();
      return res.status(403).json({ error: "Account is disabled. Please contact administrator." });
    }

    // Compare password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      await connection.release();
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Normalize legacy role labels so frontend/backends stay compatible.
    const normalizedRole = user.role === "superadmin"
      ? "super_admin"
      : user.role === "melbourne"
        ? "melbourne_user"
        : user.role;

    // Create JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email, role: normalizedRole },
      process.env.JWT_SECRET || "supersecret123",
      { expiresIn: "24h" }
    );

    // Record login time and device info
    try {
      await connection.execute(
        `INSERT INTO login_logs (user_id, email, role, user_agent) VALUES (?, ?, ?, ?)` ,
        [user.id, user.email, user.role, req.headers['user-agent'] || 'unknown']
      );
      await connection.execute(
        `UPDATE users SET last_login = NOW() WHERE id = ?`,
        [user.id]
      );

      // Work sessions are now started by explicit admin page activity,
      // not by login alone, to avoid counting idle/open-tab time.
    } catch (logErr) {
      console.warn("Login log insert failed:", logErr.message);
    }

    await connection.release();

    res.json({
      message: "Login successful",
      token,
      user: { 
        id: user.id, 
        email: user.email, 
        name: user.name, 
        role: normalizedRole,
        auto_track_hours: user.auto_track_hours,
        profile_picture: user.profile_picture || null,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Login failed" });
  }
});

// Logout
router.post("/logout", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || "supersecret123");
      const userId = decoded.id;
      
      const connection = await pool.getConnection();
      
      // Check if user is admin with auto-tracking
      const [users] = await connection.execute(
        "SELECT role, auto_track_hours, name FROM users WHERE id = ?",
        [userId]
      );
      
      if (users.length > 0 && users[0].role === "admin" && users[0].auto_track_hours) {
        const [sessions] = await connection.execute(
          `SELECT id, start_time, last_activity_at, last_recorded_at, active_minutes, status
           FROM admin_sessions
           WHERE admin_id = ? AND status IN ('active', 'paused')
           ORDER BY start_time DESC
           LIMIT 1`,
          [userId]
        );

        if (sessions.length > 0) {
          const session = sessions[0];
          const now = new Date();
          const idleTimeoutMs = 5 * 60 * 1000;
          const lastRecorded = session.last_recorded_at
            ? new Date(session.last_recorded_at)
            : session.start_time
              ? new Date(session.start_time)
              : now;
          const lastActivity = session.last_activity_at
            ? new Date(session.last_activity_at)
            : lastRecorded;

          const hasRecentActivity = now.getTime() - lastActivity.getTime() <= idleTimeoutMs;
          const elapsedMinutes = Math.max(0, Math.floor((now.getTime() - lastRecorded.getTime()) / 60000));
          const minutesToAdd = session.status === "active" && hasRecentActivity
            ? Math.min(elapsedMinutes, 5)
            : 0;

          const totalActiveMinutes = Number(session.active_minutes || 0) + minutesToAdd;

          if (minutesToAdd > 0) {
            await connection.execute(
              `UPDATE admin_sessions
               SET active_minutes = active_minutes + ?,
                   last_recorded_at = NOW(),
                   updated_at = NOW()
               WHERE id = ?`,
              [minutesToAdd, session.id]
            );
          }

          if (totalActiveMinutes >= 5 && minutesToAdd > 0) {
            const workDate = new Date(session.start_time || now).toISOString().split("T")[0];
            const [rows] = await connection.execute(
              `SELECT id, minutes_worked, pending_minutes, approved_minutes, paid_minutes
               FROM work_hours
               WHERE admin_id = ? AND date = ? AND is_auto_tracked = TRUE AND status = 'pending'
               ORDER BY id DESC
               LIMIT 1`,
              [userId, workDate]
            );

            if (rows.length > 0) {
              const row = rows[0];
              const newMinutesWorked = Number(row.minutes_worked || 0) + minutesToAdd;
              const newPending = Number(row.pending_minutes || 0) + minutesToAdd;
              const approvedMinutes = Number(row.approved_minutes || 0);
              const paidMinutes = Number(row.paid_minutes || 0);

              await connection.execute(
                `UPDATE work_hours
                 SET minutes_worked = ?,
                     pending_minutes = ?,
                     hours_worked = ROUND((? + ? + ?) / 60, 2),
                     session_start = COALESCE(session_start, ?),
                     session_end = NOW(),
                     updated_at = NOW()
                 WHERE id = ?`,
                [
                  newMinutesWorked,
                  newPending,
                  newPending,
                  approvedMinutes,
                  paidMinutes,
                  session.start_time || now,
                  row.id,
                ]
              );
            } else {
              await connection.execute(
                `INSERT INTO work_hours
                  (admin_id, date, hours_worked, minutes_worked, pending_minutes, approved_minutes, paid_minutes, task_description, status, is_auto_tracked, session_start, session_end)
                 VALUES (?, ?, ROUND(? / 60, 2), ?, ?, 0, 0, 'Auto-tracked active session', 'pending', TRUE, ?, NOW())`,
                [
                  userId,
                  workDate,
                  minutesToAdd,
                  minutesToAdd,
                  minutesToAdd,
                  session.start_time || now,
                ]
              );
            }
          }
        }

        await connection.execute(
          `UPDATE admin_sessions
           SET status = 'completed',
               end_time = NOW()
           WHERE admin_id = ? AND status IN ('active', 'paused')`,
          [userId]
        );
      }
      
      await connection.release();
    }
    
    res.json({ message: "Logged out successfully" });
  } catch (err) {
    console.error("Logout error:", err);
    res.json({ message: "Logged out successfully" }); // Still return success even if tracking fails
  }
});

// Forgot Password
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    const normalizedEmail = String(email || "").trim().toLowerCase();
    console.log("Forgot password request for email:", normalizedEmail);

    if (!normalizedEmail) {
      return res.status(400).json({ error: "Email is required" });
    }

    if (!hasMailCredentials) {
      console.error("Forgot password blocked: MAIL_USER/MAIL_PASS are not configured");
      return res.status(500).json({ error: "Email service is not configured on server" });
    }

    const connection = await pool.getConnection();

    // Check if user exists
    const [users] = await connection.execute(
      "SELECT id, name FROM users WHERE email = ?",
      [normalizedEmail]
    );

    console.log("Users found:", users.length);

    if (users.length === 0) {
      await connection.release();
      return res.status(404).json({ error: "User not found" });
    }

    const user = users[0];
    console.log("User found:", user.name);

    // Generate 4-digit OTP
    const otp = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, "0");
    
    console.log("Generated OTP:", otp);

    // Set expiration time (15 minutes)
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    // Store OTP in database
    try {
      await connection.execute(
        "INSERT INTO otp_codes (email, otp_code, purpose, expires_at) VALUES (?, ?, ?, ?)",
        [normalizedEmail, otp, "password_reset", expiresAt]
      );
      console.log("OTP stored successfully");
    } catch (dbError) {
      console.error("OTP storage error:", dbError.message);
      await connection.release();
      return res.status(500).json({ error: "Failed to generate OTP", details: dbError.message });
    }

    await connection.release();

    // Send OTP email
    try {
      const mailOptions = {
        from: process.env.MAIL_FROM || process.env.MAIL_USER,
        to: normalizedEmail,
        subject: "PlastiTrack - Password Reset OTP",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #8B0000 0%, #a00000 100%); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0;">PlastiTrack</h1>
            </div>
            <div style="background: #f5f5f5; padding: 30px; border-radius: 0 0 8px 8px;">
              <h2 style="color: #333; margin-top: 0;">Password Reset Request</h2>
              <p style="color: #666; line-height: 1.6;">
                Hi ${user.name},<br><br>
                You requested to reset your password. Please use the following OTP code to verify your identity:
              </p>
              <div style="background: white; border: 2px solid #8B0000; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
                <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #8B0000;">${otp}</span>
              </div>
              <p style="color: #666; line-height: 1.6;">
                This OTP will expire in 15 minutes.<br><br>
                If you did not request a password reset, please ignore this email.
              </p>
              <p style="color: #999; font-size: 12px; border-top: 1px solid #ddd; padding-top: 20px;">
                This is an automated email. Please do not reply to this message.
              </p>
            </div>
          </div>
        `,
      };

      await transporter.sendMail(mailOptions);
      console.log(`✓ OTP sent to ${normalizedEmail}`);

      res.json({
        message: "OTP sent to your email",
        email: normalizedEmail,
      });
    } catch (emailError) {
      console.error("✗ Email send failed:", emailError.message);
      console.error("✗ Email send code:", emailError.code || "n/a");
      if (emailError.response) {
        console.error("✗ Email send response:", emailError.response);
      }

      // OTP should only be usable when mail was actually delivered.
      // Remove the generated OTP if sending fails.
      try {
        const cleanupConnection = await pool.getConnection();
        await cleanupConnection.execute(
          "DELETE FROM otp_codes WHERE email = ? AND otp_code = ? AND purpose = 'password_reset' AND verified = FALSE",
          [normalizedEmail, otp]
        );
        await cleanupConnection.release();
      } catch (cleanupErr) {
        console.error("Failed to cleanup unsent OTP:", cleanupErr.message);
      }

      if (isProduction) {
        return res.status(502).json({
          error: "Failed to send OTP email. Please try again later.",
        });
      }

      // Non-production fallback for testing only.
      console.log(`⚠ OTP (dev fallback): ${otp}`);
      res.status(202).json({
        message: "OTP generated (email failed in non-production)",
        email: normalizedEmail,
        otp,
        warning: "Email could not be sent. Use OTP only for local testing.",
      });
    }
  } catch (err) {
    console.error("Forgot password error:", err.message);
    console.error("Stack:", err.stack);
    res.status(500).json({ 
      error: "Forgot password request failed", 
      details: err.message 
    });
  }
});

// Verify OTP
router.post("/verify-otp", async (req, res) => {
  try {
    const { otp_code, email, newPassword } = req.body;
    
    console.log("Verify OTP request - Email:", email, "OTP:", otp_code);

    if (!otp_code) {
      return res.status(400).json({ error: "OTP required" });
    }
    
    if (!email) {
      return res.status(400).json({ error: "Email required" });
    }

    const connection = await pool.getConnection();

    // Find valid OTP
    const [otpRecords] = await connection.execute(
      "SELECT * FROM otp_codes WHERE otp_code = ? AND email = ? AND expires_at > NOW() AND verified = FALSE",
      [otp_code, email]
    );

    console.log("OTP records found:", otpRecords.length);

    if (otpRecords.length === 0) {
      await connection.release();
      return res.status(400).json({ error: "Invalid or expired OTP" });
    }

    const otpRecord = otpRecords[0];
    console.log("OTP Record found, purpose:", otpRecord.purpose);

    // Mark OTP as verified
    await connection.execute("UPDATE otp_codes SET verified = TRUE WHERE id = ?", [
      otpRecord.id,
    ]);
    console.log("OTP marked as verified");

    // If this is a password reset OTP, validate and update the password
    if (otpRecord.purpose === "password_reset") {
      if (!newPassword) {
        await connection.release();
        return res.status(400).json({ error: "New password is required" });
      }

      const passwordError = validateStrongPassword(newPassword);
      if (passwordError) {
        await connection.release();
        return res.status(400).json({ error: passwordError });
      }

      console.log("Updating password for:", email);
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await connection.execute("UPDATE users SET password = ? WHERE email = ?", [
        hashedPassword,
        email,
      ]);
      console.log(`✓ Password reset for ${email}`);
    } else {
      console.log("Password update skipped - purpose:", otpRecord.purpose, "newPassword provided:", !!newPassword);
    }

    await connection.release();

    const token = jwt.sign(
      { verified: true, email, purpose: otpRecord.purpose },
      process.env.JWT_SECRET || "supersecret123",
      { expiresIn: "24h" }
    );

    res.json({
      message:
        otpRecord.purpose === "password_reset"
          ? "Password reset successful"
          : "Email verified",
      token,
    });
  } catch (err) {
    console.error("OTP verify error:", err.message);
    console.error("Stack:", err.stack);
    res.status(500).json({ error: "OTP verification failed", details: err.message });
  }
});

// Google OAuth Login
router.post("/google-login", async (req, res) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({ error: "Google credential is required" });
    }

    console.log("🔵 Google login attempt received");

    // Verify the Google token using Google's API
    try {
      const response = await axios.get(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`
      );

      const { email, name, picture } = response.data;

      console.log("✓ Google token verified for:", email);

      if (!email) {
        return res.status(400).json({ error: "Could not retrieve email from Google" });
      }

      const connection = await pool.getConnection();

      try {
        // Check if user exists
        const [existingUsers] = await connection.execute(
          "SELECT * FROM users WHERE email = ?",
          [email]
        );

        let user;
        let isNewUser = false;

        if (existingUsers.length > 0) {
          // User exists, update last login
          user = existingUsers[0];
          console.log("✓ Existing user found:", email);
          await connection.execute(
            "UPDATE users SET last_login = NOW() WHERE id = ?",
            [user.id]
          );
        } else {
          // Create new user from Google login
          isNewUser = true;
          const defaultRole = "annotator"; // Default role for new users
          const defaultPassword = "google_oauth"; // Placeholder password

          console.log("⭐ Creating new user from Google OAuth:", email);

          const [result] = await connection.execute(
            "INSERT INTO users (name, email, password, role, is_active) VALUES (?, ?, ?, ?, 1)",
            [name || "Google User", email, defaultPassword, defaultRole]
          );

          // Fetch the newly created user
          const [newUsers] = await connection.execute(
            "SELECT * FROM users WHERE id = ?",
            [result.insertId]
          );
          user = newUsers[0];

          console.log(`✓ New user created via Google OAuth: ${email}`);
        }

        // Check if account is active
        if (user.is_active === false) {
          await connection.release();
          return res.status(403).json({ error: "Account is disabled. Please contact administrator." });
        }

        // Create JWT token
        const token = jwt.sign(
          { id: user.id, email: user.email, role: user.role },
          process.env.JWT_SECRET || "supersecret123",
          { expiresIn: "24h" }
        );

        // Log the login
        await connection.execute(
          `INSERT INTO login_logs (user_id, email, role, user_agent) VALUES (?, ?, ?, ?)`,
          [user.id, user.email, user.role, "Google OAuth"]
        );

        console.log(`✓ Login successful for ${email} via Google OAuth`);

        res.json({
          message: isNewUser ? "User created and logged in successfully" : "Login successful",
          token,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            isNewUser,
            profile_picture: user.profile_picture || null,
          },
        });
      } finally {
        await connection.release();
      }
    } catch (tokenError) {
      console.error("❌ Google token verification failed:", tokenError.message);
      return res.status(401).json({ error: "Invalid Google token", details: tokenError.message });
    }
  } catch (err) {
    console.error("❌ Google login error:", err.message);
    res.status(500).json({ error: "Google login failed", details: err.message });
  }
});

module.exports = router;
