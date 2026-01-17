const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const pool = require("../db/pool");

const router = express.Router();

// Configure email transporter for Gmail
const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST || "smtp.gmail.com",
  port: process.env.MAIL_PORT || 587,
  secure: false,
  auth: {
    user: process.env.MAIL_USER,
    pass: (process.env.MAIL_PASS || "").replace(/\s/g, ""),
  },
});

// Verify transporter on startup
transporter.verify((error, success) => {
  if (error) {
    console.error("✗ Email transporter error:", error.message);
  } else {
    console.log("✓ Email transporter ready");
  }
});

// Register
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: "All fields required" });
    }

    const connection = await pool.getConnection();

    // Check if user exists
    const [existingUser] = await connection.execute(
      "SELECT email FROM users WHERE email = ?",
      [email]
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
      [name, email, hashedPassword, role]
    );

    // Create JWT token
    const token = jwt.sign(
      { email, role },
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

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }

    const connection = await pool.getConnection();

    // Find user
    const [users] = await connection.execute(
      "SELECT * FROM users WHERE email = ?",
      [email]
    );

    if (users.length === 0) {
      await connection.release();
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const user = users[0];

    // Compare password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      await connection.release();
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Create JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || "supersecret123",
      { expiresIn: "24h" }
    );

    await connection.release();

    res.json({
      message: "Login successful",
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Login failed" });
  }
});

// Logout
router.post("/logout", (req, res) => {
  res.json({ message: "Logged out successfully" });
});

// Forgot Password
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    console.log("Forgot password request for email:", email);

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const connection = await pool.getConnection();

    // Check if user exists
    const [users] = await connection.execute(
      "SELECT id, name FROM users WHERE email = ?",
      [email]
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
        [email, otp, "password_reset", expiresAt]
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
        from: process.env.MAIL_USER,
        to: email,
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
      console.log(`✓ OTP sent to ${email}`);

      res.json({
        message: "OTP sent to your email",
        email: email,
      });
    } catch (emailError) {
      console.error("✗ Email send failed:", emailError.message);
      console.log(`⚠ OTP (fallback): ${otp}`);
      // Return success with OTP code as fallback
      res.json({
        message: "OTP generated (Email failed, OTP shown here for testing)",
        email: email,
        otp: otp,
        warning: "Email could not be sent. Use the OTP code above for testing."
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

    // If this is a password reset OTP, update the password
    if (otpRecord.purpose === "password_reset" && newPassword) {
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

module.exports = router;
