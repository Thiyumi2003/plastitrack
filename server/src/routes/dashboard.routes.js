
const express = require("express");
const pool = require("../db/pool");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const jwt = require("jsonwebtoken");
const router = express.Router();

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "supersecret123");
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
};

const isSuperAdmin = (req) => req.user?.role === "super_admin";

const ROLE_PAYMENT_TYPE = {
  annotator: "per_object",
  tester: "per_object",
  admin: "per_hour",
};

const LEGACY_RATE_COLUMN_BY_ROLE = {
  annotator: "annotator_rate",
  tester: "tester_rate",
  admin: "hourly_rate",
};

const PAYMENT_STATUS = {
  PENDING_CALCULATION: "pending_calculation",
  PENDING_APPROVAL: "pending_approval",
  APPROVED: "approved",
  READY_TO_PAY: "ready_to_pay",
  PAID: "paid",
  REJECTED: "rejected",
};

const PAYMENT_STATUSES = Object.values(PAYMENT_STATUS);

const normalizeRateValue = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
};

const parseHoursWorkedInput = (value) => {
  if (value === undefined || value === null || value === "") return null;

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const raw = String(value).trim();
  if (!raw) return null;

  // Supports formats like "1:30" (1 hour 30 minutes) in addition to decimal hours.
  if (raw.includes(":")) {
    const parts = raw.split(":");
    if (parts.length !== 2) return null;

    const hours = Number(parts[0]);
    const minutes = Number(parts[1]);
    if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
    if (hours < 0 || minutes < 0 || minutes >= 60) return null;

    return hours + minutes / 60;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
};

const syncLegacyRateColumn = async (connection, userId, role, rateValue) => {
  const column = LEGACY_RATE_COLUMN_BY_ROLE[role];
  if (!column) return;
  await connection.execute(`UPDATE users SET ${column} = ? WHERE id = ?`, [rateValue, userId]);
};

const getRoleRate = async (connection, userId, role) => {
  const paymentType = ROLE_PAYMENT_TYPE[role];
  const legacyColumn = LEGACY_RATE_COLUMN_BY_ROLE[role];
  if (!paymentType || !legacyColumn) {
    return 0;
  }

  const [rows] = await connection.execute(
    `SELECT
      COALESCE(ur.custom_rate, u.${legacyColumn}, rr.default_rate, 0) as effective_rate
     FROM users u
     LEFT JOIN user_rates ur ON ur.user_id = u.id AND ur.payment_type = ?
     LEFT JOIN role_rates rr ON rr.role_name = ? AND rr.payment_type = ?
     WHERE u.id = ?
     LIMIT 1`,
    [paymentType, role, paymentType, userId]
  );

  return Number(rows?.[0]?.effective_rate || 0);
};

const calculatePaymentForUser = async (connection, user, modelType) => {
  const role = user.role;
  const userId = Number(user.id);
  const rate = await getRoleRate(connection, userId, role);

  if (role === "annotator") {
    if (!modelType) {
      return { error: "model_type is required for annotator payments" };
    }

    const summary = await getModelSummary(connection, modelType);
    if (!summary.isComplete) {
      return { error: "Model is not completed for payment", modelSummary: summary };
    }

    const [rows] = await connection.execute(
      `SELECT
        COUNT(*) as image_sets,
        COALESCE(SUM(objects_count), 0) as approved_objects
       FROM images
       WHERE model_type = ?
         AND annotator_id = ?
         AND status = 'approved'`,
      [modelType, userId]
    );

    const approvedObjects = Number(rows?.[0]?.approved_objects || 0);
    const imageSets = Number(rows?.[0]?.image_sets || 0);
    if (approvedObjects <= 0) {
      return { error: "No approved objects found for this annotator/model" };
    }

    return {
      role,
      paymentType: "per_object",
      modelType,
      imageSets,
      basisCount: approvedObjects,
      amount: approvedObjects * rate,
      rateUsed: rate,
    };
  }

  if (role === "tester") {
    if (!modelType) {
      return { error: "model_type is required for tester payments" };
    }

    const summary = await getModelSummary(connection, modelType);
    if (!summary.isComplete) {
      return { error: "Model is not completed for payment", modelSummary: summary };
    }

    const [rows] = await connection.execute(
      `SELECT
        COUNT(*) as image_sets,
        COALESCE(SUM(objects_count), 0) as reviewed_objects
       FROM images
       WHERE model_type = ?
         AND tester_id = ?
         AND status IN ('approved', 'rejected')`,
      [modelType, userId]
    );

    const reviewedObjects = Number(rows?.[0]?.reviewed_objects || 0);
    const imageSets = Number(rows?.[0]?.image_sets || 0);
    if (reviewedObjects <= 0) {
      return { error: "No reviewed objects found for this tester/model" };
    }

    return {
      role,
      paymentType: "per_object",
      modelType,
      imageSets,
      basisCount: reviewedObjects,
      amount: reviewedObjects * rate,
      rateUsed: rate,
    };
  }

  if (role === "admin") {
    const [rows] = await connection.execute(
      `SELECT
        COALESCE(SUM(hours_worked), 0) as approved_hours
       FROM work_hours
       WHERE admin_id = ?
         AND status = 'approved'`,
      [userId]
    );

    const approvedHours = Number(rows?.[0]?.approved_hours || 0);
    if (approvedHours <= 0) {
      return { error: "No approved work hours found for this admin" };
    }

    return {
      role,
      paymentType: "per_hour",
      modelType: null,
      imageSets: 0,
      basisCount: approvedHours,
      amount: approvedHours * rate,
      rateUsed: rate,
    };
  }

  return { error: "Unsupported role for payment calculation" };
};

/**
 * Calculate admin payment eligibility
 * Returns: totalWorkedMinutes, alreadyPaidMinutes, remainingMinutes, hourlyRate, minuteRate
 */
const calculateAdminPaymentEligibility = async (connection, adminId) => {
  try {
    // Get admin hourly rate. If user-specific rate is missing, fallback to role default.
    const [adminUsers] = await connection.execute(
      `SELECT
        COALESCE(ur.custom_rate, u.hourly_rate, rr.default_rate, 0) as hourly_rate
       FROM users u
       LEFT JOIN user_rates ur ON ur.user_id = u.id AND ur.payment_type = 'per_hour'
       LEFT JOIN role_rates rr ON rr.role_name = 'admin' AND rr.payment_type = 'per_hour'
       WHERE u.id = ? AND u.role = 'admin'`,
      [adminId]
    );

    if (adminUsers.length === 0) {
      return { error: "Admin user not found" };
    }

    const hourlyRate = Number(adminUsers[0].hourly_rate || 0);

    const minuteRate = hourlyRate / 60; // Convert hourly to minute rate

    // Calculate total worked minutes from approved work hours
    // work_hours.hours_worked is in decimal format (e.g., 1.5 = 1 hour 30 minutes)
    const [workHours] = await connection.execute(
      `SELECT COALESCE(SUM(hours_worked), 0) as total_approved_hours
       FROM work_hours
       WHERE admin_id = ? AND status = 'approved'`,
      [adminId]
    );

    const totalApprovedHours = Number(workHours[0].total_approved_hours || 0);
    const totalWorkedMinutes = Math.round(totalApprovedHours * 60); // Convert hours to minutes

    // Calculate already paid minutes from approved payments
    const [paidPayments] = await connection.execute(
      `SELECT COALESCE(SUM(p.paid_minutes), 0) as total_paid_minutes
       FROM payments p
       JOIN users u ON p.user_id = u.id
       WHERE p.user_id = ? AND u.role = 'admin' AND p.status IN ('approved', 'ready_to_pay', 'paid')`,
      [adminId]
    );

    const alreadyPaidMinutes = Number(paidPayments[0].total_paid_minutes || 0);

    // Calculate remaining unpaid minutes
    const remainingMinutes = Math.max(0, totalWorkedMinutes - alreadyPaidMinutes);

    return {
      adminId,
      totalWorkedMinutes,
      alreadyPaidMinutes,
      remainingMinutes,
      hourlyRate,
      minuteRate: Number(minuteRate.toFixed(4)),
      paymentEligible: remainingMinutes > 0 && hourlyRate > 0,
      hourlyRateConfigured: hourlyRate > 0,
    };
  } catch (err) {
    console.error("Calculate admin payment eligibility error:", err);
    return { error: "Failed to calculate payment eligibility" };
  }
};

/**
 * Validate and calculate admin payment
 * Ensures payMinutes <= remainingMinutes and calculates paymentAmount
 */
const validateAndCalculateAdminPayment = async (connection, adminId, payMinutes) => {
  const eligibility = await calculateAdminPaymentEligibility(connection, adminId);

  if (eligibility.error) {
    return { error: eligibility.error };
  }

  const payMin = Number(payMinutes);
  if (!Number.isInteger(payMin) || payMin <= 0) {
    return { error: "payMinutes must be a positive integer" };
  }

  if (payMin > eligibility.remainingMinutes) {
    return {
      error: `Cannot pay ${payMin} minutes. Only ${eligibility.remainingMinutes} minutes remaining.`,
    };
  }

  const paymentAmount = payMin * eligibility.minuteRate;

  return {
    success: true,
    adminId,
    payMinutes: payMin,
    minuteRate: eligibility.minuteRate,
    paymentAmount: Number(paymentAmount.toFixed(2)),
    eligibility,
  };
};

const maskCardNumber = (cardNumber) => {
  if (!cardNumber) return null;
  const digits = String(cardNumber).replace(/\D/g, "");
  if (!digits) return null;
  const last4 = digits.slice(-4).padStart(4, "0");
  return `**** **** **** ${last4}`;
};

const buildMaskedAccountNumber = (accountNumber) => {
  if (!accountNumber) return null;
  const raw = String(accountNumber).trim();
  const digits = raw.replace(/\D/g, "");
  if (digits.length >= 4) {
    return `****${digits.slice(-4)}`;
  }
  if (raw.length >= 4) {
    return `****${raw.slice(-4)}`;
  }
  return null;
};

const formatPaymentMethodLabel = (method = {}) => {
  const bank = method.bank_name || null;
  const branch = method.branch_name || null;
  const accountName = method.account_name || method.card_holder_name || null;
  const masked = method.masked_card_number || "****";

  if (bank || branch) {
    const left = [bank, branch].filter(Boolean).join(" / ") || "Bank Account";
    const suffix = accountName ? ` (${accountName})` : "";
    return `${left} ${masked}${suffix}`.trim();
  }

  return `${method.card_type || "Card"} ${masked}`.trim();
};

async function logImageHistory(connection, {
  imageId,
  eventType,
  statusFrom = null,
  statusTo = null,
  actorId = null,
  actorName = null,
  details = null,
}) {
  try {
    let resolvedActorName = actorName;
    if (!resolvedActorName && actorId) {
      const [rows] = await connection.execute("SELECT name FROM users WHERE id = ? LIMIT 1", [actorId]);
      resolvedActorName = rows?.[0]?.name || null;
    }

    await connection.execute(
      `INSERT INTO image_history (image_id, event_type, status_from, status_to, actor_id, actor_name, details, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [imageId, eventType, statusFrom, statusTo, actorId, resolvedActorName, details]
    );
  } catch (err) {
    console.error("Failed to write image history:", err);
  }
}

const getModelSummary = async (connection, modelType) => {
  const [rows] = await connection.execute(
    `SELECT 
      COUNT(*) as total_images,
      SUM(CASE WHEN status IN ('approved', 'rejected') THEN 1 ELSE 0 END) as finalized_images,
      SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_images,
      SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected_images
     FROM images
     WHERE model_type = ?`,
    [modelType]
  );

  const summary = rows?.[0] || {};
  const totalImages = Number(summary.total_images || 0);
  const finalizedImages = Number(summary.finalized_images || 0);
  const approvedImages = Number(summary.approved_images || 0);
  const rejectedImages = Number(summary.rejected_images || 0);

  return {
    modelType,
    totalImages,
    finalizedImages,
    approvedImages,
    rejectedImages,
    isComplete: totalImages > 0 && finalizedImages === totalImages,
  };
};

const getApprovedImageCount = async (connection, modelType, role, userId) => {
  if (role === "annotator") {
    const [rows] = await connection.execute(
      `SELECT COUNT(*) as count
       FROM images
       WHERE model_type = ? AND status = 'approved' AND annotator_id = ?`,
      [modelType, userId]
    );
    return Number(rows?.[0]?.count || 0);
  }

  if (role === "tester") {
    const [rows] = await connection.execute(
      `SELECT COUNT(*) as count
       FROM images
       WHERE model_type = ? AND status = 'approved' AND tester_id = ?`,
      [modelType, userId]
    );
    return Number(rows?.[0]?.count || 0);
  }

  return 0;
};

const profilePicturesDir = path.join(
  __dirname,
  "..",
  "..",
  "uploads",
  "profile-pictures"
);

fs.mkdirSync(profilePicturesDir, { recursive: true });

const profileUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, profilePicturesDir);
    },
    filename: (req, file, cb) => {
      const extMap = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/gif": ".gif",
      };
      const fallbackExt = path.extname(file.originalname).toLowerCase() || ".jpg";
      const extension = extMap[file.mimetype] || fallbackExt;
      const safeId = req.user?.id || "user";
      cb(null, `profile-${safeId}-${Date.now()}${extension}`);
    },
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/gif"];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error("Only JPG, PNG, or GIF images are allowed"));
    }
    return cb(null, true);
  },
});

router.post("/profile-picture", verifyToken, (req, res) => {
  profileUpload.single("profilePicture")(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const relativePath = `/uploads/profile-pictures/${req.file.filename}`;
    let connection;

    try {
      connection = await pool.getConnection();
      const [rows] = await connection.execute(
        "SELECT profile_picture FROM users WHERE id = ?",
        [userId]
      );

      await connection.execute(
        "UPDATE users SET profile_picture = ? WHERE id = ?",
        [relativePath, userId]
      );

      const oldPath = rows?.[0]?.profile_picture;
      if (oldPath) {
        const absoluteOldPath = path.join(
          __dirname,
          "..",
          "..",
          oldPath.replace(/^\/+/, "")
        );
        if (fs.existsSync(absoluteOldPath)) {
          fs.unlinkSync(absoluteOldPath);
        }
      }

      return res.json({
        message: "Profile picture updated successfully",
        profilePicture: relativePath,
      });
    } catch (uploadErr) {
      console.error("Profile picture upload error:", uploadErr);
      return res.status(500).json({ error: "Failed to upload profile picture" });
    } finally {
      if (connection) {
        await connection.release();
      }
    }
  });
});

// GET KPIs - Dashboard summary cards
router.get("/kpis", verifyToken, async (req, res) => {
  try {
    const connection = await pool.getConnection();

    // Total images
    const [totalImages] = await connection.execute(
      "SELECT COUNT(*) as count FROM images"
    );

    // Pending images
    const [pendingImages] = await connection.execute(
      "SELECT COUNT(*) as count FROM images WHERE status = 'pending'"
    );

    // In progress images
    const [inProgressImages] = await connection.execute(
      "SELECT COUNT(*) as count FROM images WHERE status = 'in_progress'"
    );

    // Completed images
    const [completedImages] = await connection.execute(
      "SELECT COUNT(*) as count FROM images WHERE status = 'completed'"
    );

    // Approved images
    const [approvedImages] = await connection.execute(
      "SELECT COUNT(*) as count FROM images WHERE status = 'approved'"
    );

    // Rejected images
    const [rejectedImages] = await connection.execute(
      "SELECT COUNT(*) as count FROM images WHERE status = 'rejected'"
    );

    await connection.release();

    res.json({
      totalImages: totalImages[0].count,
      pending: pendingImages[0].count,
      inProgress: inProgressImages[0].count,
      completed: completedImages[0].count,
      approve: approvedImages[0].count,
      rejected: rejectedImages[0].count,
    });
  } catch (err) {
    console.error("KPI error:", err);
    res.status(500).json({ error: "Failed to fetch KPIs" });
  }
});

// GET Admins list
router.get("/admins", verifyToken, async (req, res) => {
  try {
    const connection = await pool.getConnection();

    const [admins] = await connection.execute(
      "SELECT id, name, email, role, created_at, profile_picture FROM users WHERE role = 'admin'"
    );

    await connection.release();

    res.json(admins);
  } catch (err) {
    console.error("Admins list error:", err);
    res.status(500).json({ error: "Failed to fetch admins" });
  }
});

// GET All users (with filters)
router.get("/users", verifyToken, async (req, res) => {
  try {
    const { role } = req.query;
    const connection = await pool.getConnection();

    let query = "SELECT id, name, email, role, is_active, hourly_rate, annotator_rate, tester_rate, profile_picture, created_at FROM users WHERE role != 'super_admin'";
    const params = [];

    if (role) {
      query += " AND role = ?";
      params.push(role);
    }

    query += " ORDER BY created_at DESC";

    const [users] = await connection.execute(query, params);

    await connection.release();

    res.json(users);
  } catch (err) {
    console.error("Users list error:", err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// PUT Edit user details
router.put("/users/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, role, hourly_rate, annotator_rate, tester_rate } = req.body;
    const normalizedHourlyRate = normalizeRateValue(hourly_rate);
    const normalizedAnnotatorRate = normalizeRateValue(annotator_rate);
    const normalizedTesterRate = normalizeRateValue(tester_rate);

    const allowedRoles = ["super_admin"];
    if (!allowedRoles.includes(req.user?.role)) {
      return res.status(403).json({ error: "Not authorized" });
    }

    if (!name || !email || !role) {
      return res.status(400).json({ error: "Name, email, and role are required" });
    }

    const connection = await pool.getConnection();

    // Check if email is already taken by another user
    const [existingUser] = await connection.execute(
      "SELECT id FROM users WHERE email = ? AND id != ?",
      [email, id]
    );

    if (existingUser.length > 0) {
      await connection.release();
      return res.status(400).json({ error: "Email already in use by another user" });
    }

    // Build update query
    let query = "UPDATE users SET name = ?, email = ?, role = ?";
    const params = [name, email, role];

    if (hourly_rate !== undefined && role === "admin") {
      query += ", hourly_rate = ?";
      params.push(normalizedHourlyRate);
    }

    if (annotator_rate !== undefined && role === "annotator") {
      query += ", annotator_rate = ?";
      params.push(normalizedAnnotatorRate);
    }

    if (tester_rate !== undefined && role === "tester") {
      query += ", tester_rate = ?";
      params.push(normalizedTesterRate);
    }

    query += " WHERE id = ?";
    params.push(id);

    await connection.execute(query, params);

    // Keep user_rates aligned with existing View All Users edit flow.
    await connection.execute("DELETE FROM user_rates WHERE user_id = ?", [id]);
    const paymentType = ROLE_PAYMENT_TYPE[role] || null;
    let selectedRate = null;
    if (role === "admin") selectedRate = normalizedHourlyRate;
    if (role === "annotator") selectedRate = normalizedAnnotatorRate;
    if (role === "tester") selectedRate = normalizedTesterRate;

    if (paymentType && selectedRate !== null) {
      await connection.execute(
        `INSERT INTO user_rates (user_id, payment_type, custom_rate)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE custom_rate = VALUES(custom_rate), updated_at = CURRENT_TIMESTAMP`,
        [id, paymentType, selectedRate]
      );
    }

    await connection.release();

    res.json({ message: "User updated successfully" });
  } catch (err) {
    console.error("Update user error:", err);
    res.status(500).json({ error: "Failed to update user" });
  }
});

// PUT Toggle user active status (enable/disable)
router.put("/users/:id/status", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;

    const allowedRoles = ["super_admin"];
    if (!allowedRoles.includes(req.user?.role)) {
      return res.status(403).json({ error: "Not authorized" });
    }

    if (is_active === undefined) {
      return res.status(400).json({ error: "is_active status is required" });
    }

    const connection = await pool.getConnection();

    await connection.execute(
      "UPDATE users SET is_active = ? WHERE id = ?",
      [is_active, id]
    );

    await connection.release();

    res.json({ 
      message: is_active ? "User account activated" : "User account disabled",
      is_active 
    });
  } catch (err) {
    console.error("Toggle user status error:", err);
    res.status(500).json({ error: "Failed to update user status" });
  }
});

// DELETE User (super admin only)
router.delete("/users/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    const allowedRoles = ["super_admin"];
    if (!allowedRoles.includes(req.user?.role)) {
      return res.status(403).json({ error: "Not authorized" });
    }

    const connection = await pool.getConnection();

    // Check if user exists and is not super admin
    const [user] = await connection.execute(
      "SELECT role FROM users WHERE id = ?",
      [id]
    );

    if (user.length === 0) {
      await connection.release();
      return res.status(404).json({ error: "User not found" });
    }

    if (user[0].role === "super_admin") {
      await connection.release();
      return res.status(403).json({ error: "Cannot delete super admin" });
    }

    await connection.execute("DELETE FROM users WHERE id = ?", [id]);
    await connection.release();

    res.json({ message: "User deleted successfully" });
  } catch (err) {
    console.error("Delete user error:", err);
    res.status(500).json({ error: "Failed to delete user" });
  }
});

// GET Reports/Analytics
router.get("/reports", verifyToken, async (req, res) => {
  try {
    const connection = await pool.getConnection();

    // Progress over time (last 30 days)
    const [progressData] = await connection.execute(`
      SELECT 
        DATE(created_at) as date,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected
      FROM images
      GROUP BY DATE(created_at)
      ORDER BY date DESC
      LIMIT 30
    `);

    // User contributions (including testers)
    const [userContributions] = await connection.execute(`
      SELECT 
        u.name,
        u.email,
        u.role,
        COUNT(DISTINCT i.id) as images_count,
        SUM(CASE WHEN i.status = 'completed' THEN 1 ELSE 0 END) as completed_count,
        SUM(CASE WHEN i.status = 'approved' THEN 1 ELSE 0 END) as approved_count,
        SUM(CASE WHEN i.status = 'rejected' THEN 1 ELSE 0 END) as rejected_count
      FROM users u
      LEFT JOIN images i ON u.id = i.annotator_id OR u.id = i.tester_id
      WHERE u.role IN ('annotator', 'tester')
      GROUP BY u.id, u.name, u.email, u.role
      ORDER BY images_count DESC
      LIMIT 10
    `);

    // Image status distribution
    const [statusDistribution] = await connection.execute(`
      SELECT 
        status,
        COUNT(*) as count
      FROM images
      GROUP BY status
    `);

    // Detailed reports - latest images
    const [detailedReports] = await connection.execute(`
      SELECT 
        i.id,
        i.image_name,
        u1.name as assigned_to,
        u2.name as annotator,
        u3.name as tester,
        u4.name as melbourne_user,
        i.status,
        i.created_at,
        i.updated_at,
        i.objects_count,
        (SELECT t2.notes FROM tasks t2 WHERE t2.image_id = i.id AND t2.task_type = 'annotation' LIMIT 1) as annotator_notes,
        (SELECT t2.notes FROM tasks t2 WHERE t2.image_id = i.id AND t2.task_type = 'testing' LIMIT 1) as tester_feedback,
        i.melbourne_user_feedback as melbourne_feedback
      FROM images i
      LEFT JOIN users u1 ON i.admin_id = u1.id
      LEFT JOIN users u2 ON i.annotator_id = u2.id
      LEFT JOIN users u3 ON i.tester_id = u3.id
      LEFT JOIN users u4 ON i.melbourne_user_id = u4.id
      ORDER BY i.id ASC
      LIMIT 50
    `);

    await connection.release();

    res.json({
      progressOverTime: progressData,
      userContributions: userContributions,
      statusDistribution: statusDistribution,
      detailedReports: detailedReports,
    });
  } catch (err) {
    console.error("Reports error:", err);
    res.status(500).json({ error: "Failed to fetch reports" });
  }
});

// GET Annotation Summary Report with date/role filters
router.get("/reports/annotation-summary", verifyToken, async (req, res) => {
  try {
    const allowedRoles = ["admin", "super_admin", "melbourne_user"];
    if (!allowedRoles.includes(req.user?.role)) {
      return res.status(403).json({ error: "Not authorized" });
    }

    const { startDate, endDate, role } = req.query;
    const connection = await pool.getConnection();

    let whereClause = "WHERE t.task_type = 'annotation'";
    const params = [];

    if (role && ["annotator", "tester"].includes(role)) {
      whereClause += " AND u.role = ?";
      params.push(role);
    }
    if (startDate) {
      whereClause += " AND t.assigned_date >= ?";
      params.push(startDate);
    }
    if (endDate) {
      whereClause += " AND t.assigned_date <= ?";
      params.push(endDate);
    }

    console.log(`[ANNOTATION-SUMMARY] Executing query with whereClause: ${whereClause}, params:`, params);

    const [imageCounts] = await connection.execute(
      `SELECT COUNT(*) as totalImageSets FROM images`
    );

    const [imagesByStatus] = await connection.execute(
      `SELECT 
        status,
        COUNT(*) as count
       FROM images
       GROUP BY status`
    );

    const [summaryRows] = await connection.execute(
      `SELECT 
        COUNT(DISTINCT t.image_id) as totalImageSets,
        COUNT(t.id) as totalAssigned,
        SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) as completedAnnotations,
        SUM(CASE WHEN t.status IN ('pending', 'in_progress', 'pending_review') THEN 1 ELSE 0 END) as pendingAnnotations,
        SUM(CASE WHEN t.status = 'rejected' THEN 1 ELSE 0 END) as rejectedAnnotations
       FROM tasks t
       LEFT JOIN users u ON t.user_id = u.id
       ${whereClause}`,
      params
    );

    const [approvalRows] = await connection.execute(
      `SELECT 
        SUM(CASE WHEN i.status = 'approved' THEN 1 ELSE 0 END) as approvedCount,
        SUM(CASE WHEN i.status = 'rejected' THEN 1 ELSE 0 END) as rejectedCount
       FROM images i
       INNER JOIN (
         SELECT DISTINCT t.image_id
         FROM tasks t
         LEFT JOIN users u ON t.user_id = u.id
         ${whereClause}
       ) x ON x.image_id = i.id`,
      params
    );

    const [performanceRows] = await connection.execute(
      `SELECT 
        u.id,
        u.name,
        COUNT(t.id) as assigned,
        SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) as completed
       FROM tasks t
       LEFT JOIN users u ON t.user_id = u.id
       ${whereClause}
       GROUP BY u.id, u.name
       ORDER BY completed DESC, assigned DESC
       LIMIT 10`,
      params
    );

    await connection.release();

    const summary = summaryRows[0] || {};
    const approved = Number(approvalRows[0]?.approvedCount || 0);
    const rejected = Number(approvalRows[0]?.rejectedCount || 0);
    const approvalRate = approved + rejected > 0 ? (approved / (approved + rejected)) * 100 : 0;

    res.json({
      filters: { startDate: startDate || null, endDate: endDate || null, role: role || null },
      summary: {
        totalImageSets: Number(imageCounts[0]?.totalImageSets || 0),
        totalAssigned: Number(summary.totalAssigned || 0),
        completedAnnotations: Number(summary.completedAnnotations || 0),
        pendingAnnotations: Number(summary.pendingAnnotations || 0),
        rejectedAnnotations: Number(summary.rejectedAnnotations || 0),
        approvalRate: Number(approvalRate.toFixed(2)),
      },
      pie: imagesByStatus.map(row => ({
        name: row.status.charAt(0).toUpperCase() + row.status.slice(1),
        value: Number(row.count || 0)
      })),
      performance: performanceRows.map((row) => ({
        id: row.id,
        name: row.name,
        assigned: Number(row.assigned || 0),
        completed: Number(row.completed || 0),
      })),
    });
  } catch (err) {
    console.error("Annotation summary error:", err.message, err.stack);
    res.status(500).json({ error: "Failed to fetch annotation summary", details: err.message });
  }
});

// GET Annotator Performance Report with date filters
router.get("/reports/annotator-performance", verifyToken, async (req, res) => {
  try {
    const allowedRoles = ["admin", "super_admin", "melbourne_user"];
    if (!allowedRoles.includes(req.user?.role)) {
      return res.status(403).json({ error: "Not authorized" });
    }

    const { startDate, endDate } = req.query;
    const connection = await pool.getConnection();

    // Build date filter for tasks
    let taskWhere = "WHERE u.role = 'annotator'";
    const taskParams = [];
    if (startDate) {
      taskWhere += " AND t.assigned_date >= ?";
      taskParams.push(startDate);
    }
    if (endDate) {
      taskWhere += " AND t.assigned_date <= ?";
      taskParams.push(endDate);
    }

    // Main query: Get full historical performance for each annotator
    const [performanceRows] = await connection.execute(
      `SELECT 
        u.id,
        u.name,
        -- Total unique images ever assigned (historical + current)
        COUNT(DISTINCT t.image_id) as total_assigned,
        -- Completed tasks
        SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) as completed,
        -- Current in progress
        SUM(CASE WHEN t.status IN ('pending', 'in_progress') THEN 1 ELSE 0 END) as in_progress,
        -- Tasks marked as rejected
        SUM(CASE WHEN t.status = 'rejected' THEN 1 ELSE 0 END) as rejected_tasks,
        -- Average completion time
        AVG(CASE 
          WHEN t.status = 'completed' AND t.completed_date IS NOT NULL 
          THEN TIMESTAMPDIFF(MINUTE, t.assigned_date, t.completed_date)
          ELSE NULL 
        END) as avg_completion_minutes
       FROM users u
       LEFT JOIN tasks t ON u.id = t.user_id AND t.task_type = 'annotation'
       ${taskWhere}
       GROUP BY u.id, u.name`,
      taskParams
    );

    // Get "under review" count - images where annotator completed work and now being tested
    let underReviewWhere = "WHERE ann_task.user_id IS NOT NULL AND ann_task.task_type = 'annotation' AND ann_task.status = 'completed' AND test_task.task_type = 'testing' AND test_task.status IN ('pending', 'in_progress', 'pending_review')";
    const underReviewParams = [];
    if (startDate) {
      underReviewWhere += " AND ann_task.assigned_date >= ?";
      underReviewParams.push(startDate);
    }
    if (endDate) {
      underReviewWhere += " AND ann_task.assigned_date <= ?";
      underReviewParams.push(endDate);
    }

    const [underReviewRows] = await connection.execute(
      `SELECT 
        ann_task.user_id as annotator_id,
        COUNT(DISTINCT ann_task.image_id) as under_review_count
       FROM tasks ann_task
       JOIN tasks test_task ON ann_task.image_id = test_task.image_id
       ${underReviewWhere}
       GROUP BY ann_task.user_id`,
      underReviewParams
    );

    // Get current image status counts for each annotator
    let imageWhere = "WHERE i.annotator_id IS NOT NULL";
    const imageParams = [];
    if (startDate) {
      imageWhere += " AND i.updated_at >= ?";
      imageParams.push(startDate);
    }
    if (endDate) {
      imageWhere += " AND i.updated_at <= ?";
      imageParams.push(endDate);
    }

    const [currentStatusRows] = await connection.execute(
      `SELECT 
        i.annotator_id,
        SUM(CASE WHEN i.status = 'approved' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN i.status = 'rejected' THEN 1 ELSE 0 END) as currently_rejected
       FROM images i
       ${imageWhere}
       GROUP BY i.annotator_id`,
      imageParams
    );

    // Get reassigned/previously rejected count
    // These are images where the annotator worked but are no longer assigned to them
    let reassignedWhere = "WHERE th.user_id IS NOT NULL AND th.task_type = 'annotation' AND (i.annotator_id != th.user_id OR i.annotator_id IS NULL)";
    const reassignedParams = [];
    if (startDate) {
      reassignedWhere += " AND th.assigned_date >= ?";
      reassignedParams.push(startDate);
    }
    if (endDate) {
      reassignedWhere += " AND th.assigned_date <= ?";
      reassignedParams.push(endDate);
    }

    const [reassignedRows] = await connection.execute(
      `SELECT 
        th.user_id as annotator_id,
        COUNT(DISTINCT th.image_id) as reassigned_count
       FROM tasks th
       JOIN images i ON th.image_id = i.id
       ${reassignedWhere}
       GROUP BY th.user_id`,
      reassignedParams
    );

    // Get approved objects count for each annotator (only from approved images)
    let objectsWhere = "WHERE t.user_id IS NOT NULL AND t.task_type = 'annotation' AND i.status = 'approved'";
    const objectsParams = [];
    if (startDate) {
      objectsWhere += " AND t.assigned_date >= ?";
      objectsParams.push(startDate);
    }
    if (endDate) {
      objectsWhere += " AND t.assigned_date <= ?";
      objectsParams.push(endDate);
    }

    const [objectsRows] = await connection.execute(
      `SELECT 
        t.user_id as annotator_id,
        SUM(i.objects_count) as approved_objects
       FROM tasks t
       JOIN images i ON t.image_id = i.id
       ${objectsWhere}
       GROUP BY t.user_id`,
      objectsParams
    );

    await connection.release();

    // Build lookup maps
    const currentStatusMap = new Map();
    currentStatusRows.forEach((row) => {
      currentStatusMap.set(row.annotator_id, {
        approved: Number(row.approved || 0),
        currently_rejected: Number(row.currently_rejected || 0),
      });
    });

    const reassignedMap = new Map();
    reassignedRows.forEach((row) => {
      reassignedMap.set(row.annotator_id, Number(row.reassigned_count || 0));
    });

    const objectsMap = new Map();
    objectsRows.forEach((row) => {
      objectsMap.set(row.annotator_id, Number(row.approved_objects || 0));
    });

    const underReviewMap = new Map();
    underReviewRows.forEach((row) => {
      underReviewMap.set(row.annotator_id, Number(row.under_review_count || 0));
    });

    // Combine all data
    const rows = performanceRows.map((row) => {
      const currentStatus = currentStatusMap.get(row.id) || { approved: 0, currently_rejected: 0 };
      const reassignedCount = reassignedMap.get(row.id) || 0;
      const approvedObjects = objectsMap.get(row.id) || 0;
      const underReviewCount = underReviewMap.get(row.id) || 0;
      
      const completed = Number(row.completed || 0);
      const approved = currentStatus.approved;
      const currentlyRejected = currentStatus.currently_rejected;
      const rejectedTasks = Number(row.rejected_tasks || 0);
      
      // Total reviewed = approved + all rejected (current + tasks marked rejected)
      const totalReviewed = approved + currentlyRejected + rejectedTasks;
      const accuracyRate = totalReviewed > 0 ? (approved / totalReviewed) * 100 : 0;
      
      const avgMinutes = Number(row.avg_completion_minutes || 0);
      const safeAvgMinutes = Number.isFinite(avgMinutes) ? avgMinutes : 0;
      
      return {
        id: row.id,
        name: row.name,
        totalAssigned: Number(row.total_assigned || 0),
        completed: completed,
        inProgress: Number(row.in_progress || 0),
        underReview: underReviewCount,
        approved: approved,
        rejected: currentlyRejected + rejectedTasks,
        reassigned: reassignedCount,
        approvedObjects: approvedObjects,
        accuracyRate: Number(accuracyRate.toFixed(2)),
        avgCompletionMinutes: Number(safeAvgMinutes.toFixed(2)),
      };
    });

    // Sort by completed tasks and total assigned
    rows.sort((a, b) => {
      if (b.completed !== a.completed) return b.completed - a.completed;
      return b.totalAssigned - a.totalAssigned;
    });

    res.json({
      filters: { startDate: startDate || null, endDate: endDate || null },
      rows,
    });
  } catch (err) {
    console.error("Annotator performance error:", err);
    res.status(500).json({ error: "Failed to fetch annotator performance" });
  }
});

// GET Tester Review Report with date filters
router.get("/reports/tester-review", verifyToken, async (req, res) => {
  try {
    const allowedRoles = ["admin", "super_admin", "melbourne_user"];
    if (!allowedRoles.includes(req.user?.role)) {
      return res.status(403).json({ error: "Not authorized" });
    }

    const { startDate, endDate } = req.query;
    const connection = await pool.getConnection();

    // Build date filter for tasks
    let taskWhere = "WHERE u.role = 'tester'";
    const taskParams = [];
    if (startDate) {
      taskWhere += " AND t.assigned_date >= ?";
      taskParams.push(startDate);
    }
    if (endDate) {
      taskWhere += " AND t.assigned_date <= ?";
      taskParams.push(endDate);
    }

    // Main query: Get full performance for each tester
    const [performanceRows] = await connection.execute(
      `SELECT 
        u.id,
        u.name,
        -- Total unique images assigned for testing
        COUNT(DISTINCT t.image_id) as total_assigned,
        -- Approved by tester
        SUM(CASE WHEN t.status = 'approved' THEN 1 ELSE 0 END) as approved,
        -- Rejected by tester
        SUM(CASE WHEN t.status = 'rejected' THEN 1 ELSE 0 END) as rejected,
        -- Currently under review (pending, in_progress, pending_review)
        SUM(CASE WHEN t.status IN ('pending', 'in_progress', 'pending_review') THEN 1 ELSE 0 END) as under_review,
        -- Total time spent (sum of all review times)
        SUM(CASE 
          WHEN t.status IN ('approved', 'rejected') AND t.completed_date IS NOT NULL 
          THEN TIMESTAMPDIFF(MINUTE, t.assigned_date, t.completed_date)
          ELSE 0 
        END) as total_review_minutes,
        -- Average review time
        AVG(CASE 
          WHEN t.status IN ('approved', 'rejected') AND t.completed_date IS NOT NULL 
          THEN TIMESTAMPDIFF(MINUTE, t.assigned_date, t.completed_date)
          ELSE NULL 
        END) as avg_review_minutes
       FROM users u
       LEFT JOIN tasks t ON u.id = t.user_id AND t.task_type = 'testing'
       ${taskWhere}
       GROUP BY u.id, u.name`,
      taskParams
    );

    await connection.release();

    // Process rows
    const rows = performanceRows.map((row) => {
      const approved = Number(row.approved || 0);
      const rejected = Number(row.rejected || 0);
      const completed = approved + rejected;
      const accuracy = completed > 0 ? (approved / completed) * 100 : 0;
      
      const avgMinutes = Number(row.avg_review_minutes || 0);
      const safeAvgMinutes = Number.isFinite(avgMinutes) ? avgMinutes : 0;
      
      const totalMinutes = Number(row.total_review_minutes || 0);
      const safeTotalMinutes = Number.isFinite(totalMinutes) ? totalMinutes : 0;
      
      return {
        id: row.id,
        name: row.name,
        totalAssigned: Number(row.total_assigned || 0),
        approved: approved,
        rejected: rejected,
        underReview: Number(row.under_review || 0),
        totalReviewMinutes: Number(safeTotalMinutes.toFixed(2)),
        accuracy: Number(accuracy.toFixed(2)),
        avgReviewMinutes: Number(safeAvgMinutes.toFixed(2)),
      };
    });

    // Sort by approved and total assigned
    rows.sort((a, b) => {
      if (b.approved !== a.approved) return b.approved - a.approved;
      return b.totalAssigned - a.totalAssigned;
    });

    res.json({
      filters: { startDate: startDate || null, endDate: endDate || null },
      rows,
    });
  } catch (err) {
    console.error("Tester review error:", err);
    res.status(500).json({ error: "Failed to fetch tester review report" });
  }
});

// GET Image Details Report
router.get("/reports/image-details", verifyToken, async (req, res) => {
  try {
    const allowedRoles = ["admin", "super_admin", "melbourne_user"];
    if (!allowedRoles.includes(req.user?.role)) {
      return res.status(403).json({ error: "Not authorized" });
    }

    const { startDate, endDate, status: statusFilter } = req.query;
    const connection = await pool.getConnection();

    let whereClause = "WHERE 1=1";
    const params = [];
    if (startDate) {
      whereClause += " AND i.created_at >= ?";
      params.push(startDate);
    }
    if (endDate) {
      whereClause += " AND i.created_at <= ?";
      params.push(endDate);
    }
    if (statusFilter && statusFilter !== "all") {
      whereClause += " AND i.status = ?";
      params.push(statusFilter);
    }

    const [rows] = await connection.execute(
      `SELECT
        i.id,
        i.image_name,
        i.model_type,
        i.status,
        i.objects_count,
        i.annotator_feedback,
        i.tester_feedback,
        i.melbourne_user_feedback,
        prev_ann.previous_annotator_name,
        i.previous_tester_name,
        i.previous_feedback,
        i.created_at,
        i.updated_at,
        a.name as annotator_name,
        t.name as tester_name,
        m.name as melbourne_user_name,
        ann.annotation_assigned_date,
        ann.annotation_completed_date,
        tst.testing_assigned_date,
        tst.testing_completed_date
       FROM images i
       LEFT JOIN users a ON i.annotator_id = a.id
       LEFT JOIN users t ON i.tester_id = t.id
       LEFT JOIN users m ON i.melbourne_user_id = m.id
       LEFT JOIN (
         SELECT
           ih.image_id,
           SUBSTRING_INDEX(
             GROUP_CONCAT(
               NULLIF(JSON_UNQUOTE(JSON_EXTRACT(ih.details, '$.previousAnnotator')), '')
               ORDER BY ih.created_at DESC SEPARATOR '||'
             ),
             '||',
             1
           ) as previous_annotator_name
         FROM image_history ih
         WHERE ih.event_type = 'reassigned'
         GROUP BY ih.image_id
       ) prev_ann ON prev_ann.image_id = i.id
       LEFT JOIN (
         SELECT image_id,
           MAX(assigned_date) as annotation_assigned_date,
           MAX(completed_date) as annotation_completed_date
         FROM tasks
         WHERE task_type = 'annotation'
         GROUP BY image_id
       ) ann ON ann.image_id = i.id
       LEFT JOIN (
         SELECT image_id,
           MAX(assigned_date) as testing_assigned_date,
           MAX(completed_date) as testing_completed_date
         FROM tasks
         WHERE task_type = 'testing'
         GROUP BY image_id
       ) tst ON tst.image_id = i.id
       ${whereClause}
       ORDER BY i.id ASC`,
      params
    );

    await connection.release();

    const images = rows.map((row) => ({
      id: row.id,
      imageName: row.image_name,
      modelType: row.model_type || "-",
      status: row.status,
      objectsCount: Number(row.objects_count || 0),
      annotatorName: row.annotator_name || "Not assigned",
      testerName: row.tester_name || "Not assigned",
      melbourneUserName: row.melbourne_user_name || "Not assigned",
      annotatorFeedback: row.annotator_feedback || "",
      testerFeedback: row.tester_feedback || "",
      melbourneFeedback: row.melbourne_user_feedback || "",
      previousAnnotatorName: row.previous_annotator_name || "",
      previousTesterName: row.previous_tester_name || "",
      previousFeedback: row.previous_feedback || "",
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      annotationAssignedDate: row.annotation_assigned_date,
      annotationCompletedDate: row.annotation_completed_date,
      testingAssignedDate: row.testing_assigned_date,
      testingCompletedDate: row.testing_completed_date,
    }));

    res.json({
      filters: {
        startDate: startDate || null,
        endDate: endDate || null,
        status: statusFilter || "all",
      },
      summary: {
        totalImages: images.length,
        totalObjects: images.reduce((sum, img) => sum + Number(img.objectsCount || 0), 0),
      },
      images,
    });
  } catch (err) {
    console.error("Image details report error:", err);
    res.status(500).json({ error: "Failed to fetch image details report" });
  }
});

// GET Image Set Allocation Report
router.get("/reports/image-set-allocation", verifyToken, async (req, res) => {
  try {
    const allowedRoles = ["admin", "super_admin", "melbourne_user"];
    if (!allowedRoles.includes(req.user?.role)) {
      return res.status(403).json({ error: "Not authorized" });
    }

    const { startDate, endDate } = req.query;
    const connection = await pool.getConnection();

    let whereClause = "WHERE 1=1";
    const params = [];
    if (startDate) {
      whereClause += " AND i.created_at >= ?";
      params.push(startDate);
    }
    if (endDate) {
      whereClause += " AND i.created_at <= ?";
      params.push(endDate);
    }

    const [rows] = await connection.execute(
      `SELECT 
        i.id,
        i.image_name,
        i.status,
        i.created_at as assignedDate,
        i.updated_at as completionDate,
        a.name as annotatorName,
        t.name as testerName
       FROM images i
       LEFT JOIN users a ON i.annotator_id = a.id
       LEFT JOIN users t ON i.tester_id = t.id
       ${whereClause}
       ORDER BY i.created_at DESC`,
      params
    );

    await connection.release();

    const imageSets = rows.map((row) => ({
      id: row.id,
      imageName: row.image_name,
      annotatorName: row.annotatorName || "Not assigned",
      testerName: row.testerName || "Not assigned",
      status: row.status,
      assignedDate: row.assignedDate,
      completionDate: row.status === 'approved' || row.status === 'rejected' ? row.completionDate : null,
    }));

    res.json({
      filters: { startDate: startDate || null, endDate: endDate || null },
      imageSets,
      totalSets: imageSets.length,
    });
  } catch (err) {
    console.error("Image set allocation error:", err);
    res.status(500).json({ error: "Failed to fetch image set allocation report" });
  }
});

// GET Payment Report
router.get("/reports/payment-report", verifyToken, async (req, res) => {
  try {
    const allowedRoles = ["admin", "super_admin", "melbourne_user"];
    if (!allowedRoles.includes(req.user?.role)) {
      return res.status(403).json({ error: "Not authorized" });
    }

    const { startDate, endDate, status: statusFilter } = req.query;
    const connection = await pool.getConnection();

    let whereClause = "WHERE 1=1";
    const params = [];
    if (startDate) {
      whereClause += " AND p.created_at >= ?";
      params.push(startDate);
    }
    if (endDate) {
      whereClause += " AND p.created_at <= ?";
      params.push(endDate);
    }
    if (statusFilter && statusFilter !== 'all') {
      whereClause += " AND p.status = ?";
      params.push(statusFilter);
    }

    // Get payment data with user information
    const [rows] = await connection.execute(
      `SELECT 
        p.id,
        p.user_id,
        u.name as annotatorName,
        u.email as annotatorEmail,
        p.images_completed as completedTasks,
        p.amount,
        p.status,
        p.payment_date,
        p.approved_date,
        p.created_at,
        p.model_type,
        approver.name as approvedBy
       FROM payments p
       INNER JOIN users u ON p.user_id = u.id
       LEFT JOIN users approver ON p.approved_by = approver.id
       ${whereClause}
       ORDER BY p.created_at DESC`,
      params
    );

    await connection.release();

    const payments = rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      annotatorName: row.annotatorName,
      annotatorEmail: row.annotatorEmail,
      completedTasks: row.completedTasks || 0,
      amount: Number(row.amount || 0).toFixed(2),
      status: row.status,
      paymentDate: row.payment_date,
      approvedDate: row.approved_date,
      approvedBy: row.approvedBy || 'Pending',
      modelType: row.model_type,
      createdAt: row.created_at,
    }));

    // Calculate summary statistics
    const totalAmount = payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const pendingCount = payments.filter(p => p.status === 'pending').length;
    const approvedCount = payments.filter(p => p.status === 'approved').length;
    const paidCount = payments.filter(p => p.status === 'paid').length;
    const rejectedCount = payments.filter(p => p.status === 'rejected').length;

    res.json({
      filters: { 
        startDate: startDate || null, 
        endDate: endDate || null,
        status: statusFilter || 'all'
      },
      payments,
      summary: {
        totalPayments: payments.length,
        totalAmount: totalAmount.toFixed(2),
        pendingCount,
        approvedCount,
        paidCount,
        rejectedCount,
      }
    });
  } catch (err) {
    console.error("Payment report error:", err);
    res.status(500).json({ error: "Failed to fetch payment report" });
  }
});

// GET Performance overview for annotators/testers with date filters
router.get("/performance/users", verifyToken, async (req, res) => {
  try {
    const allowedRoles = ["admin", "super_admin", "melbourne_user"];
    if (!allowedRoles.includes(req.user?.role)) {
      return res.status(403).json({ error: "Not authorized" });
    }

    const { role, startDate, endDate, period } = req.query;

    // Default to current month if period=month and no explicit dates
    let start = startDate;
    let end = endDate;
    if (!start && period === "month") {
      const now = new Date();
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      start = first.toISOString().slice(0, 10);
    }

    const connection = await pool.getConnection();

    // Build query with filters
    let whereClause = "WHERE u.role IN ('annotator', 'tester')";
    const params = [];

    if (role && ["annotator", "tester"].includes(role)) {
      whereClause += " AND u.role = ?";
      params.push(role);
    }

    let taskFilter = "";
    if (start) {
      taskFilter += " AND t.updated_at >= ?";
      params.push(start);
    }
    if (end) {
      taskFilter += " AND t.updated_at <= ?";
      params.push(end);
    }

    const query = `
      SELECT 
        u.id,
        u.name,
        u.email,
        u.role,
        COALESCE(COUNT(DISTINCT t.id), 0) as tasks_total,
        COALESCE(SUM(CASE WHEN t.status IN ('pending','pending_review','in_progress') THEN 1 ELSE 0 END), 0) as tasks_active,
        COALESCE(SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END), 0) as tasks_completed,
        COALESCE(SUM(CASE WHEN t.status = 'approved' THEN 1 ELSE 0 END), 0) as tasks_approved,
        COALESCE(SUM(CASE WHEN t.status = 'rejected' THEN 1 ELSE 0 END), 0) as tasks_rejected,
        MAX(t.updated_at) as last_task_activity,
        u.last_login,
        (SELECT COUNT(*) FROM login_logs l WHERE l.user_id = u.id AND l.login_time >= DATE_SUB(NOW(), INTERVAL 30 DAY)) as login_count
      FROM users u
      LEFT JOIN tasks t ON u.id = t.user_id AND t.task_type IN ('annotation', 'testing') ${taskFilter}
      ${whereClause}
      GROUP BY u.id, u.name, u.email, u.role, u.last_login
      ORDER BY tasks_approved DESC, tasks_completed DESC
    `;

    const [rows] = await connection.execute(query, params);
    await connection.release();

    res.json({
      filters: { startDate: start || null, endDate: end || null, role: role || null },
      users: rows,
    });
  } catch (err) {
    console.error("Performance users error:", err);
    res.status(500).json({ error: "Failed to fetch performance data" });
  }
});

// GET System performance snapshot (lightweight, near real-time)
router.get("/performance/system", verifyToken, async (req, res) => {
  try {
    const allowedRoles = ["admin", "super_admin", "melbourne_user"];
    if (!allowedRoles.includes(req.user?.role)) {
      return res.status(403).json({ error: "Not authorized" });
    }

    const connection = await pool.getConnection();

    const [statusDistribution] = await connection.execute(`
      SELECT status, COUNT(*) as count FROM images GROUP BY status
    `);

    const [tasks24h] = await connection.execute(`
      SELECT status, COUNT(*) as count
      FROM tasks
      WHERE updated_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
      GROUP BY status
    `);

    const [logins24h] = await connection.execute(`
      SELECT role, COUNT(*) as count
      FROM login_logs
      WHERE login_time >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
      GROUP BY role
    `);

    const [images7d] = await connection.execute(`
      SELECT DATE(created_at) as date, COUNT(*) as total
      FROM images
      WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `);

    await connection.release();

    res.json({
      statusDistribution,
      tasksLast24h: tasks24h,
      loginsLast24h: logins24h,
      imagesLast7d: images7d,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Performance system error:", err);
    res.status(500).json({ error: "Failed to fetch system performance" });
  }
});

// Export performance users as CSV
router.get("/performance/users/export", verifyToken, async (req, res) => {
  try {
    const allowedRoles = ["admin", "super_admin", "melbourne_user"];
    if (!allowedRoles.includes(req.user?.role)) {
      return res.status(403).json({ error: "Not authorized" });
    }

    const { role, startDate, endDate, period } = req.query;
    let start = startDate;
    let end = endDate;
    if (!start && period === "month") {
      const now = new Date();
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      start = first.toISOString().slice(0, 10);
    }

    const whereParts = ["u.role IN ('annotator','tester')"];
    const params = [];
    if (role && ["annotator", "tester"].includes(role)) {
      whereParts.push("u.role = ?");
      params.push(role);
    }

    let taskDateClause = "";
    let loginDateClause = "";
    if (start) {
      taskDateClause += " AND t.updated_at >= ?";
      loginDateClause += " AND l.login_time >= ?";
      taskParams.push(start);
      loginParams.push(start);
    }
    if (end) {
      taskDateClause += " AND t.updated_at <= ?";
      loginDateClause += " AND l.login_time <= ?";
      taskParams.push(end);
      loginParams.push(end);
    }

    const query = `
      SELECT 
        u.name,
        u.email,
        u.role,
        COALESCE(COUNT(t.id), 0) as tasks_total,
        COALESCE(SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END), 0) as tasks_completed,
        COALESCE(SUM(CASE WHEN t.status = 'approved' THEN 1 ELSE 0 END), 0) as tasks_approved,
        COALESCE(SUM(CASE WHEN t.status = 'rejected' THEN 1 ELSE 0 END), 0) as tasks_rejected,
        MAX(t.updated_at) as last_task_activity,
        (SELECT MAX(l.login_time) FROM login_logs l WHERE l.user_id = u.id ${loginDateClause}) as last_login,
        (SELECT COUNT(*) FROM login_logs l WHERE l.user_id = u.id ${loginDateClause}) as login_count
      FROM users u
      LEFT JOIN tasks t ON u.id = t.user_id ${taskDateClause} AND t.task_type IN ('annotation', 'testing')
      WHERE ${whereParts.join(" AND ")}
      GROUP BY u.id, u.name, u.email, u.role
      ORDER BY tasks_approved DESC, tasks_completed DESC;
    `;

    const connection = await pool.getConnection();
    const [rows] = await connection.execute(query, [...params, ...taskParams, ...loginParams, ...loginParams]);
    await connection.release();

    const header = ["Name", "Email", "Role", "Tasks Total", "Completed", "Approved", "Rejected", "Last Task Activity", "Last Login", "Login Count"];
    const csvLines = [header.join(",")];
    rows.forEach((r) => {
      csvLines.push([
        r.name || "",
        r.email || "",
        r.role || "",
        r.tasks_total || 0,
        r.tasks_completed || 0,
        r.tasks_approved || 0,
        r.tasks_rejected || 0,
        r.last_task_activity ? new Date(r.last_task_activity).toISOString() : "",
        r.last_login ? new Date(r.last_login).toISOString() : "",
        r.login_count || 0,
      ].join(","));
    });

    const csv = csvLines.join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=performance.csv");
    res.send(csv);
  } catch (err) {
    console.error("Performance export error:", err);
    res.status(500).json({ error: "Failed to export performance data" });
  }
});

// GET Model completion summary for payment eligibility (super admin only)
router.get("/payments/eligible-models", verifyToken, async (req, res) => {
  try {
    if (!isSuperAdmin(req)) {
      return res.status(403).json({ error: "Not authorized" });
    }

    const connection = await pool.getConnection();
    const [rows] = await connection.execute(
      `SELECT
        model_type,
        COUNT(*) as total_image_sets,
        SUM(CASE WHEN status IN ('approved', 'rejected') THEN 1 ELSE 0 END) as completed_image_sets,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_image_sets,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected_image_sets
       FROM images
       WHERE model_type IS NOT NULL AND model_type <> ''
       GROUP BY model_type
       ORDER BY model_type`
    );
    await connection.release();

    const models = rows.map((row) => {
      const totalImageSets = Number(row.total_image_sets || 0);
      const completedImageSets = Number(row.completed_image_sets || 0);
      const eligibleForPayment = totalImageSets > 0 && completedImageSets === totalImageSets;
      return {
        modelName: row.model_type,
        modelType: row.model_type,
        totalImageSets,
        completedImageSets,
        approvedImageSets: Number(row.approved_image_sets || 0),
        rejectedImageSets: Number(row.rejected_image_sets || 0),
        eligibleForPayment,
        isComplete: eligibleForPayment,
      };
    });

    res.json({ models });
  } catch (err) {
    console.error("Eligible models error:", err);
    res.status(500).json({ error: "Failed to fetch eligible models" });
  }
});

// GET Payment Eligibility table summary (super admin only)
router.get("/payments/eligibility-summary", verifyToken, async (req, res) => {
  try {
    if (!isSuperAdmin(req)) {
      return res.status(403).json({ error: "Not authorized" });
    }

    const connection = await pool.getConnection();
    const [rows] = await connection.execute(
      `SELECT
        model_type as model_name,
        COUNT(*) as total_image_sets,
        SUM(CASE WHEN status IN ('approved', 'rejected') THEN 1 ELSE 0 END) as completed_image_sets
       FROM images
       WHERE model_type IS NOT NULL AND model_type <> ''
       GROUP BY model_type
       ORDER BY model_type`
    );
    await connection.release();

    res.json({
      rows: rows.map((row) => {
        const total = Number(row.total_image_sets || 0);
        const completed = Number(row.completed_image_sets || 0);
        return {
          model_name: row.model_name,
          total_image_sets: total,
          completed_image_sets: completed,
          eligible_for_payment: total > 0 && total === completed,
        };
      }),
    });
  } catch (err) {
    console.error("Eligibility summary error:", err);
    res.status(500).json({ error: "Failed to fetch payment eligibility summary" });
  }
});

// GET Eligible users for model-based payments (super admin only)
router.get("/payments/eligible-users", verifyToken, async (req, res) => {
  try {
    if (!isSuperAdmin(req)) {
      return res.status(403).json({ error: "Not authorized" });
    }

    const { modelType } = req.query;
    if (!modelType) {
      return res.status(400).json({ error: "modelType is required" });
    }

    const connection = await pool.getConnection();
    const modelSummary = await getModelSummary(connection, modelType);

    const [annotators] = await connection.execute(
      `SELECT
        u.id,
        u.name,
        u.email,
        u.role,
        COUNT(i.id) as approved_image_sets,
        COALESCE(SUM(i.objects_count), 0) as approved_objects
       FROM images i
       INNER JOIN users u ON i.annotator_id = u.id
       WHERE i.model_type = ? AND i.status = 'approved'
       GROUP BY u.id, u.name, u.email, u.role
       ORDER BY approved_objects DESC`,
      [modelType]
    );

    const [testers] = await connection.execute(
      `SELECT
        u.id,
        u.name,
        u.email,
        u.role,
        COUNT(i.id) as reviewed_image_sets,
        COALESCE(SUM(i.objects_count), 0) as reviewed_objects
       FROM images i
       INNER JOIN users u ON i.tester_id = u.id
       WHERE i.model_type = ? AND i.status IN ('approved', 'rejected')
       GROUP BY u.id, u.name, u.email, u.role
       ORDER BY reviewed_objects DESC`,
      [modelType]
    );

    await connection.release();

    res.json({ modelType, modelSummary, annotators, testers });
  } catch (err) {
    console.error("Eligible users error:", err);
    res.status(500).json({ error: "Failed to fetch eligible users" });
  }
});

// GET Payment Dashboard (super admin only)
router.get("/payments", verifyToken, async (req, res) => {
  try {
    if (!isSuperAdmin(req)) {
      return res.status(403).json({ error: "Not authorized" });
    }

    const connection = await pool.getConnection();

    const [summaryRows] = await connection.execute(
      `SELECT
        SUM(CASE WHEN status IN ('pending_calculation', 'pending_approval') THEN 1 ELSE 0 END) as total_pending_payments,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_payments,
        SUM(CASE WHEN status = 'ready_to_pay' THEN 1 ELSE 0 END) as ready_to_pay_payments,
        SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid_payments,
        COALESCE(SUM(amount), 0) as total_amount,
        COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) as total_paid_amount
       FROM payments`
    );

    const [recentTransactions] = await connection.execute(
      `SELECT
        p.id,
        u.name as user_name,
        u.role as user_role,
        p.model_type,
        p.amount,
        p.status,
        p.payment_method,
        p.payment_date,
        p.created_at
       FROM payments p
       LEFT JOIN users u ON u.id = p.user_id
       ORDER BY COALESCE(p.payment_date, p.created_at) DESC
       LIMIT 10`
    );

    const [savedCards] = await connection.execute(
      `SELECT
        pm.id,
        pm.user_id,
        u.name as user_name,
        pm.card_holder_name,
        pm.masked_card_number,
        pm.card_type,
        pm.expiry_month,
        pm.expiry_year,
        pm.is_default,
        pm.created_at
       FROM payment_methods pm
       LEFT JOIN users u ON u.id = pm.user_id
       ORDER BY pm.is_default DESC, pm.updated_at DESC
       LIMIT 20`
    );

    const [methodBreakdown] = await connection.execute(
      `SELECT
        payment_method,
        COUNT(*) as count,
        COALESCE(SUM(amount), 0) as total
       FROM payments
       WHERE status = 'paid'
       GROUP BY payment_method`
    );

    await connection.release();

    const summary = summaryRows?.[0] || {};
    res.json({
      totalPendingPayments: Number(summary.total_pending_payments || 0),
      approvedPayments: Number(summary.approved_payments || 0),
      readyToPayPayments: Number(summary.ready_to_pay_payments || 0),
      paidPayments: Number(summary.paid_payments || 0),
      totalAmount: Number(summary.total_amount || 0),
      totalPaidAmount: Number(summary.total_paid_amount || 0),
      recentTransactions,
      savedPaymentCards: savedCards,
      methodBreakdown,

      // Backward-compatible fields used by current UI
      totalPaidThisMonth: Number(summary.total_paid_amount || 0),
      modelsReadyForPayment: Number(summary.ready_to_pay_payments || 0),
      pendingAdminPayment: Number(summary.total_pending_payments || 0),
      withdrawalMethods: methodBreakdown,
    });
  } catch (err) {
    console.error("Payments dashboard error:", err);
    res.status(500).json({ error: "Failed to fetch payments dashboard" });
  }
});

// GET Payment history
router.get("/payment-history", verifyToken, async (req, res) => {
  try {
    if (!isSuperAdmin(req)) {
      return res.status(403).json({ error: "Not authorized" });
    }

    const connection = await pool.getConnection();
    const [history] = await connection.execute(
      `SELECT
        p.id,
        p.user_id,
        u.name as user_name,
        u.role as user_role,
        p.amount,
        p.model_type,
        p.images_completed,
        p.objects_count,
        p.hours,
        p.rate_used,
        p.status,
        p.payment_method,
        p.payment_date,
        p.approved_date,
        p.created_at,
        approver.name as approved_by
       FROM payments p
       LEFT JOIN users u ON p.user_id = u.id
       LEFT JOIN users approver ON p.approved_by = approver.id
       ORDER BY p.created_at DESC
       LIMIT 200`
    );

    const [cumulativeSummary] = await connection.execute(
      `SELECT
        COALESCE(SUM(amount), 0) as total_amount,
        COUNT(*) as total_transactions,
        SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as total_paid_transactions
       FROM payments`
    );
    await connection.release();

    res.json({
      history,
      cumulativeSummary: cumulativeSummary?.[0] || {
        total_amount: 0,
        total_transactions: 0,
        total_paid_transactions: 0,
      },
    });
  } catch (err) {
    console.error("Payment history error:", err);
    res.status(500).json({ error: "Failed to fetch payment history" });
  }
});

// GET Model-based payment details (super admin only)
router.get("/reports/model-payment-details", verifyToken, async (req, res) => {
  try {
    if (!isSuperAdmin(req)) {
      return res.status(403).json({ error: "Not authorized" });
    }

    const connection = await pool.getConnection();

    const [rows] = await connection.execute(
      `SELECT 
        i.id,
        i.image_name,
        i.model_type,
        i.objects_count,
        i.status,
        a.id as annotator_id,
        a.name as annotator_name,
        COALESCE(aur.custom_rate, a.annotator_rate, arr.default_rate, 0) as annotator_rate,
        t.id as tester_id,
        t.name as tester_name,
        COALESCE(tur.custom_rate, t.tester_rate, trr.default_rate, 0) as tester_rate
       FROM images i
       LEFT JOIN users a ON i.annotator_id = a.id
       LEFT JOIN users t ON i.tester_id = t.id
       LEFT JOIN user_rates aur ON aur.user_id = a.id AND aur.payment_type = 'per_object'
       LEFT JOIN role_rates arr ON arr.role_name = 'annotator' AND arr.payment_type = 'per_object'
       LEFT JOIN user_rates tur ON tur.user_id = t.id AND tur.payment_type = 'per_object'
       LEFT JOIN role_rates trr ON trr.role_name = 'tester' AND trr.payment_type = 'per_object'
       WHERE i.model_type IS NOT NULL AND i.model_type <> ''
       ORDER BY i.model_type, i.image_name`
    );

    await connection.release();

    const modelMap = new Map();

    rows.forEach((row) => {
      const modelType = row.model_type || "Unknown";
      if (!modelMap.has(modelType)) {
        modelMap.set(modelType, {
          modelType,
          totalImages: 0,
          finalizedImages: 0,
          approvedImages: 0,
          rejectedImages: 0,
          totalPayment: 0,
          images: [],
        });
      }

      const model = modelMap.get(modelType);
      const objectsCount = Number(row.objects_count || 0);
      const annotatorRate = Number(row.annotator_rate || 0);
      const testerRate = Number(row.tester_rate || 0);
      let annotatorPayment = 0;
      let testerPayment = 0;

      if (row.status === "approved") {
        annotatorPayment = objectsCount * annotatorRate;
        testerPayment = objectsCount * testerRate;
      } else if (row.status === "rejected") {
        testerPayment = objectsCount * testerRate;
      }

      const totalPayment = annotatorPayment + testerPayment;

      model.totalImages += 1;
      if (["approved", "rejected"].includes(row.status)) {
        model.finalizedImages += 1;
      }
      if (row.status === "approved") {
        model.approvedImages += 1;
      }
      if (row.status === "rejected") {
        model.rejectedImages += 1;
      }
      model.totalPayment += totalPayment;

      model.images.push({
        id: row.id,
        imageName: row.image_name,
        objectsCount,
        status: row.status,
        annotatorName: row.annotator_name || "Unassigned",
        testerName: row.tester_name || "Unassigned",
        annotatorPayment,
        testerPayment,
        totalPayment,
      });
    });

    const models = Array.from(modelMap.values()).map((model) => ({
      ...model,
      isComplete: model.totalImages > 0 && model.finalizedImages === model.totalImages,
    }));

    res.json({ models });
  } catch (err) {
    console.error("Model payment details error:", err);
    res.status(500).json({ error: "Failed to fetch model payment details" });
  }
});

// GET Admin payment details (super admin only)
router.get("/reports/admin-payment-details", verifyToken, async (req, res) => {
  try {
    if (!isSuperAdmin(req)) {
      return res.status(403).json({ error: "Not authorized" });
    }

    const connection = await pool.getConnection();

    const [rows] = await connection.execute(
      `SELECT 
        p.id,
        u.name as admin_name,
        u.email as admin_email,
        p.amount,
        p.hours,
        p.status,
        p.payment_method,
        p.payment_date,
        p.created_at
       FROM payments p
       INNER JOIN users u ON p.user_id = u.id
       WHERE u.role = 'admin'
       ORDER BY p.created_at DESC
       LIMIT 100`
    );

    await connection.release();

    res.json({ adminPayments: rows });
  } catch (err) {
    console.error("Admin payment details error:", err);
    res.status(500).json({ error: "Failed to fetch admin payment details" });
  }
});

// GET Model-based payments
router.get("/model-payments", verifyToken, async (req, res) => {
  try {
    if (!isSuperAdmin(req)) {
      return res.status(403).json({ error: "Not authorized" });
    }

    const connection = await pool.getConnection();

    const [modelPayments] = await connection.execute(`
      SELECT 
        model_type,
        SUM(CASE WHEN status = 'ready_to_pay' THEN amount ELSE 0 END) as ready_for_payment,
        SUM(CASE WHEN status = 'approved' THEN amount ELSE 0 END) as approved,
        COUNT(DISTINCT user_id) as users_count,
        COUNT(*) as total_payments
      FROM payments
      GROUP BY model_type
    `);

    // Model details with image breakdown
    const [modelDetails] = await connection.execute(`
      SELECT 
        p.model_type,
        p.user_id,
        u.name,
        COUNT(i.id) as images_assigned,
        SUM(CASE WHEN i.status = 'completed' THEN 1 ELSE 0 END) as images_completed,
        p.amount,
        p.status
      FROM payments p
      LEFT JOIN users u ON p.user_id = u.id
      LEFT JOIN images i ON p.user_id = i.annotator_id AND i.model_type = p.model_type
      GROUP BY p.id
      ORDER BY p.model_type, p.amount DESC
    `);

    await connection.release();

    res.json({
      modelPayments: modelPayments,
      modelDetails: modelDetails,
    });
  } catch (err) {
    console.error("Model payments error:", err);
    res.status(500).json({ error: "Failed to fetch model payments" });
  }
});

// POST Calculate/Create payment by role rules
router.post("/payments", verifyToken, async (req, res) => {
  try {
    if (!isSuperAdmin(req)) {
      return res.status(403).json({ error: "Not authorized" });
    }

    const { user_id, model_type, payment_method } = req.body;
    const userId = Number(user_id);

    if (!userId) {
      return res.status(400).json({ error: "user_id is required" });
    }

    const connection = await pool.getConnection();

    const [users] = await connection.execute("SELECT id, role FROM users WHERE id = ?", [userId]);

    if (users.length === 0) {
      await connection.release();
      return res.status(404).json({ error: "User not found" });
    }

    const user = users[0];
    const calculation = await calculatePaymentForUser(connection, user, model_type || null);

    if (calculation.error) {
      await connection.release();
      return res.status(400).json({
        error: calculation.error,
        modelSummary: calculation.modelSummary || null,
      });
    }

    await connection.execute(
      `INSERT INTO payments (
        user_id,
        amount,
        model_type,
        images_completed,
        objects_count,
        hours,
        rate_used,
        payment_method,
        status,
        payment_date,
        approved_date,
        approved_by
      )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        Number(calculation.amount.toFixed(2)),
        calculation.modelType,
        calculation.imageSets || 0,
        calculation.paymentType === "per_object" ? calculation.basisCount : 0,
        calculation.paymentType === "per_hour" ? calculation.basisCount : 0,
        Number(calculation.rateUsed.toFixed(2)),
        payment_method || "bank",
        PAYMENT_STATUS.PENDING_APPROVAL,
        null,
        null,
        null,
      ]
    );

    await connection.release();

    res.status(201).json({
      message: "Payment calculated and submitted for approval",
      calculation,
      status: PAYMENT_STATUS.PENDING_APPROVAL,
    });
  } catch (err) {
    console.error("Add payment error:", err);
    res.status(500).json({ error: "Failed to add payment" });
  }
});

// POST Create Admin Payment (Super Admin)
// Super Admin creates a payment for an admin based on minutes worked
router.post("/admin-payments", verifyToken, async (req, res) => {
  try {
    if (!isSuperAdmin(req)) {
      return res.status(403).json({ error: "Not authorized" });
    }

    const { admin_id, pay_minutes, source_payment_method_id } = req.body;
    const adminId = Number(admin_id);

    if (!adminId) {
      return res.status(400).json({ error: "admin_id is required" });
    }

    if (!pay_minutes) {
      return res.status(400).json({ error: "pay_minutes is required" });
    }

    if (!source_payment_method_id) {
      return res.status(400).json({ error: "Select Super Admin source payment account" });
    }

    const connection = await pool.getConnection();

    try {
      // Verify admin exists
      const [adminUsers] = await connection.execute(
        "SELECT id, name, role FROM users WHERE id = ?",
        [adminId]
      );

      if (adminUsers.length === 0) {
        return res.status(404).json({ error: "Admin user not found" });
      }

      if (adminUsers[0].role !== "admin") {
        return res.status(400).json({ error: "Selected user is not an admin" });
      }

      // Validate and calculate payment
      const calculation = await validateAndCalculateAdminPayment(connection, adminId, pay_minutes);

      if (calculation.error) {
        return res.status(400).json({
          error: calculation.error,
          eligibility: calculation.eligibility || null,
        });
      }

      // Verify Super Admin owns the source payment method
      const [sourceMethods] = await connection.execute(
        "SELECT id, user_id FROM payment_methods WHERE id = ?",
        [source_payment_method_id]
      );

      if (sourceMethods.length === 0) {
        return res.status(404).json({ error: "Source payment method not found" });
      }

      if (sourceMethods[0].user_id !== req.user.id) {
        return res.status(403).json({ error: "Source account does not belong to you" });
      }

      // Create payment record
      const [result] = await connection.execute(
        `INSERT INTO payments (
          user_id,
          amount,
          status,
          hours,
          paid_minutes,
          minute_rate,
          rate_used,
          payment_method_id,
          approved_by,
          created_at,
          approved_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)`,
        [
          adminId,
          calculation.paymentAmount,
          PAYMENT_STATUS.PENDING_APPROVAL,
          Number((calculation.payMinutes / 60).toFixed(2)),
          calculation.payMinutes,
          calculation.minuteRate,
          calculation.eligibility.hourlyRate,
          source_payment_method_id,
          null,
          null,
        ]
      );

      res.status(201).json({
        message: "Admin payment created and submitted for approval",
        paymentId: result.insertId,
        payment: {
          id: result.insertId,
          adminId,
          paidMinutes: calculation.payMinutes,
          paymentAmount: calculation.paymentAmount,
          minuteRate: calculation.minuteRate,
          hourlyRate: calculation.eligibility.hourlyRate,
          status: PAYMENT_STATUS.PENDING_APPROVAL,
          eligibility: calculation.eligibility,
        },
      });
    } finally {
      await connection.release();
    }
  } catch (err) {
    console.error("Create admin payment error:", err);
    res.status(500).json({ error: "Failed to create admin payment" });
  }
});

// GET Admin Payment Eligibility (Super Admin)
// Get payment eligibility info for an admin before creating payment
router.get("/admin-payments/eligibility/:admin_id", verifyToken, async (req, res) => {
  try {
    if (!isSuperAdmin(req)) {
      return res.status(403).json({ error: "Not authorized" });
    }

    const adminId = Number(req.params.admin_id);
    if (!adminId) {
      return res.status(400).json({ error: "admin_id is required" });
    }

    const connection = await pool.getConnection();
    let eligibility;
    try {
      eligibility = await calculateAdminPaymentEligibility(connection, adminId);
    } finally {
      await connection.release();
    }

    if (eligibility.error) {
      return res.status(400).json({ error: eligibility.error });
    }

    res.json(eligibility);
  } catch (err) {
    console.error("Get admin payment eligibility error:", err);
    res.status(500).json({ error: "Failed to fetch payment eligibility" });
  }
});

// POST Pay approved payment (Super Admin)
router.post("/payments/:id/pay", verifyToken, async (req, res) => {
  try {
    if (!isSuperAdmin(req)) {
      return res.status(403).json({ error: "Not authorized" });
    }

    const { id } = req.params;
    const { payment_method_id, source_payment_method_id, payment_method, card } = req.body;
    const sourceMethodId = Number(source_payment_method_id);
    if (!sourceMethodId) {
      return res.status(400).json({ error: "Select Super Admin source account" });
    }

    const connection = await pool.getConnection();

    const [sourceRows] = await connection.execute(
      `SELECT id, card_type, card_holder_name, account_name, bank_name, branch_name, masked_card_number
       FROM payment_methods
       WHERE id = ? AND user_id = ? LIMIT 1`,
      [sourceMethodId, req.user.id]
    );
    if (!sourceRows.length) {
      await connection.release();
      return res.status(404).json({ error: "Super Admin source account not found" });
    }
    const sourceMethod = sourceRows[0];

    const [rows] = await connection.execute(
      `SELECT p.id, p.user_id, p.amount, p.model_type, p.status, u.name, u.role
       FROM payments p
       JOIN users u ON u.id = p.user_id
       WHERE p.id = ? LIMIT 1`,
      [id]
    );

    if (!rows.length) {
      await connection.release();
      return res.status(404).json({ error: "Payment not found" });
    }

    const payment = rows[0];
    if (![PAYMENT_STATUS.APPROVED, PAYMENT_STATUS.READY_TO_PAY].includes(payment.status)) {
      await connection.release();
      return res.status(400).json({ error: "Only approved or ready-to-pay payments can be paid" });
    }

    let destinationMethod = payment_method || "bank";
    let methodId = payment_method_id ? Number(payment_method_id) : null;

    if (methodId) {
      const [methodRows] = await connection.execute(
        `SELECT id, card_type, card_holder_name, account_name, bank_name, branch_name, masked_card_number
         FROM payment_methods
         WHERE id = ? AND user_id = ? LIMIT 1`,
        [methodId, payment.user_id]
      );
      if (!methodRows.length) {
        await connection.release();
        return res.status(404).json({ error: "Payment method not found for user" });
      }
      const method = methodRows[0];
      destinationMethod = formatPaymentMethodLabel(method);
    } else if (card && card.card_holder_name) {
      const masked = card.masked_card_number || maskCardNumber(card.card_number || "");
      if (!masked) {
        await connection.release();
        return res.status(400).json({ error: "Valid card number (or masked card number) is required" });
      }

      await connection.execute(
        `INSERT INTO payment_methods
          (user_id, card_holder_name, account_name, bank_name, branch_name, masked_card_number, card_type, expiry_month, expiry_year, is_default)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
          card_holder_name = VALUES(card_holder_name),
          account_name = VALUES(account_name),
          bank_name = VALUES(bank_name),
          branch_name = VALUES(branch_name),
          card_type = VALUES(card_type),
          expiry_month = VALUES(expiry_month),
          expiry_year = VALUES(expiry_year),
          updated_at = CURRENT_TIMESTAMP`,
        [
          payment.user_id,
          card.card_holder_name,
          card.account_name || card.card_holder_name,
          card.bank_name || null,
          card.branch_name || null,
          masked,
          card.card_type || "card",
          Number(card.expiry_month || 0),
          Number(card.expiry_year || 0),
          Number(card.is_default ? 1 : 0),
        ]
      );

      if (card.is_default) {
        await connection.execute(
          "UPDATE payment_methods SET is_default = 0 WHERE user_id = ? AND masked_card_number <> ?",
          [payment.user_id, masked]
        );
      }

      destinationMethod = formatPaymentMethodLabel({
        card_type: card.card_type || "Card",
        card_holder_name: card.card_holder_name,
        account_name: card.account_name || card.card_holder_name,
        bank_name: card.bank_name || null,
        branch_name: card.branch_name || null,
        masked_card_number: masked,
      });
    }

    const sourceLabel = formatPaymentMethodLabel(sourceMethod);
    const resolvedMethod = `From ${sourceLabel} -> To ${destinationMethod}`;

    await connection.execute(
      `UPDATE payments
       SET status = ?, payment_method = ?, payment_date = NOW(), approved_by = ?, updated_at = NOW()
       WHERE id = ?`,
      [PAYMENT_STATUS.PAID, resolvedMethod, req.user.id, id]
    );

    await connection.release();
    res.json({
      message: "Payment marked as paid",
      payment: {
        id: payment.id,
        user_name: payment.name,
        role: payment.role,
        model_type: payment.model_type,
        amount: Number(payment.amount || 0),
        status: PAYMENT_STATUS.PAID,
        payment_method: resolvedMethod,
        source_account: sourceLabel,
        destination_account: destinationMethod,
      },
    });
  } catch (err) {
    console.error("Pay now error:", err);
    res.status(500).json({ error: "Failed to process payment" });
  }
});

// GET payment methods (super admin: any user, others: own only)
router.get("/payment-methods", verifyToken, async (req, res) => {
  try {
    const requesterId = Number(req.user?.id);
    if (!requesterId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const requestedUserId = req.query.user_id ? Number(req.query.user_id) : null;
    const userId = isSuperAdmin(req)
      ? requestedUserId
      : requestedUserId && requestedUserId !== requesterId
      ? null
      : requesterId;

    if (!isSuperAdmin(req) && requestedUserId && requestedUserId !== requesterId) {
      return res.status(403).json({ error: "Not authorized" });
    }

    const connection = await pool.getConnection();

    const [rows] = userId
      ? await connection.execute(
          `SELECT id, user_id, card_holder_name, account_name, bank_name, branch_name, masked_card_number, card_type, expiry_month, expiry_year, is_default, created_at, updated_at
           FROM payment_methods
           WHERE user_id = ?
           ORDER BY is_default DESC, updated_at DESC`,
          [userId]
        )
      : await connection.execute(
          `SELECT id, user_id, card_holder_name, account_name, bank_name, branch_name, masked_card_number, card_type, expiry_month, expiry_year, is_default, created_at, updated_at
           FROM payment_methods
           ORDER BY is_default DESC, updated_at DESC`
        );

    await connection.release();
    res.json(rows);
  } catch (err) {
    console.error("Get payment methods error:", err);
    res.status(500).json({ error: "Failed to fetch payment methods" });
  }
});

// POST add payment method (super admin: any user, others: own only)
router.post("/payment-methods", verifyToken, async (req, res) => {
  try {
    const requesterId = Number(req.user?.id);
    if (!requesterId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const {
      user_id,
      card_holder_name,
      account_name,
      bank_name,
      branch_name,
      masked_account_number,
      account_number,
      masked_card_number,
      card_number,
      card_type,
      expiry_month,
      expiry_year,
      is_default,
    } = req.body;

    const userId = isSuperAdmin(req) ? Number(user_id) : requesterId;
    if (!isSuperAdmin(req) && user_id && Number(user_id) !== requesterId) {
      return res.status(403).json({ error: "Not authorized" });
    }
    const resolvedAccountName = account_name || card_holder_name;
    const resolvedBankName = bank_name || null;
    const resolvedBranchName = branch_name || null;
    const resolvedType = card_type || (resolvedBankName ? "Bank Account" : null);
    const resolvedMasked =
      masked_account_number ||
      masked_card_number ||
      buildMaskedAccountNumber(account_number || "") ||
      maskCardNumber(card_number || "");

    if (!userId || !resolvedAccountName || !resolvedType || !resolvedMasked) {
      return res.status(400).json({ error: "name, account/card number and payment type are required" });
    }

    if ((resolvedBankName && !resolvedBranchName) || (!resolvedBankName && resolvedBranchName)) {
      return res.status(400).json({ error: "bank_name and branch_name should be provided together" });
    }

    const connection = await pool.getConnection();
    await connection.execute(
      `INSERT INTO payment_methods
        (user_id, card_holder_name, account_name, bank_name, branch_name, masked_card_number, card_type, expiry_month, expiry_year, is_default)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        card_holder_name || resolvedAccountName,
        resolvedAccountName,
        resolvedBankName,
        resolvedBranchName,
        resolvedMasked,
        resolvedType,
        Number(expiry_month || 1),
        Number(expiry_year || new Date().getFullYear()),
        Number(is_default ? 1 : 0),
      ]
    );

    if (is_default) {
      await connection.execute(
        "UPDATE payment_methods SET is_default = 0 WHERE user_id = ? AND masked_card_number <> ?",
        [userId, resolvedMasked]
      );
    }

    await connection.release();
    res.status(201).json({ message: "Payment method saved", masked_card_number: resolvedMasked });
  } catch (err) {
    console.error("Add payment method error:", err);
    res.status(500).json({ error: "Failed to save payment method" });
  }
});

// PUT update payment method (super admin or method owner)
router.put("/payment-methods/:id", verifyToken, async (req, res) => {
  try {
    const requesterId = Number(req.user?.id);
    if (!requesterId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const { id } = req.params;
    const {
      account_name,
      card_holder_name,
      bank_name,
      branch_name,
      account_number,
      masked_account_number,
      card_number,
      masked_card_number,
      card_type,
      expiry_month,
      expiry_year,
      is_default,
    } = req.body;

    const connection = await pool.getConnection();
    const [rows] = await connection.execute(
      "SELECT id, user_id, masked_card_number FROM payment_methods WHERE id = ? LIMIT 1",
      [id]
    );
    if (!rows.length) {
      await connection.release();
      return res.status(404).json({ error: "Payment method not found" });
    }

    const userId = Number(rows[0].user_id);
    if (!isSuperAdmin(req) && userId !== requesterId) {
      await connection.release();
      return res.status(403).json({ error: "Not authorized" });
    }

    const resolvedMasked =
      masked_account_number ||
      masked_card_number ||
      buildMaskedAccountNumber(account_number || "") ||
      maskCardNumber(card_number || "") ||
      rows[0].masked_card_number;

    await connection.execute(
      `UPDATE payment_methods
       SET card_holder_name = COALESCE(?, card_holder_name),
           account_name = COALESCE(?, account_name),
           bank_name = ?,
           branch_name = ?,
           masked_card_number = ?,
           card_type = COALESCE(?, card_type),
           expiry_month = COALESCE(?, expiry_month),
           expiry_year = COALESCE(?, expiry_year),
           is_default = COALESCE(?, is_default),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        card_holder_name || account_name || null,
        account_name || card_holder_name || null,
        bank_name || null,
        branch_name || null,
        resolvedMasked,
        card_type || null,
        expiry_month ? Number(expiry_month) : null,
        expiry_year ? Number(expiry_year) : null,
        is_default === undefined ? null : Number(!!is_default),
        id,
      ]
    );

    if (is_default) {
      await connection.execute("UPDATE payment_methods SET is_default = 0 WHERE user_id = ? AND id <> ?", [userId, id]);
      await connection.execute("UPDATE payment_methods SET is_default = 1 WHERE id = ?", [id]);
    }

    await connection.release();
    res.json({ message: "Payment method updated" });
  } catch (err) {
    console.error("Update payment method error:", err);
    res.status(500).json({ error: "Failed to update payment method" });
  }
});

// PUT set default payment method (super admin or method owner)
router.put("/payment-methods/:id/default", verifyToken, async (req, res) => {
  try {
    const requesterId = Number(req.user?.id);
    if (!requesterId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const { id } = req.params;
    const connection = await pool.getConnection();

    const [rows] = await connection.execute(
      "SELECT id, user_id FROM payment_methods WHERE id = ? LIMIT 1",
      [id]
    );
    if (!rows.length) {
      await connection.release();
      return res.status(404).json({ error: "Payment method not found" });
    }

    const userId = rows[0].user_id;
    if (!isSuperAdmin(req) && Number(userId) !== requesterId) {
      await connection.release();
      return res.status(403).json({ error: "Not authorized" });
    }
    await connection.execute("UPDATE payment_methods SET is_default = 0 WHERE user_id = ?", [userId]);
    await connection.execute("UPDATE payment_methods SET is_default = 1 WHERE id = ?", [id]);

    await connection.release();
    res.json({ message: "Default payment method updated" });
  } catch (err) {
    console.error("Set default payment method error:", err);
    res.status(500).json({ error: "Failed to update default payment method" });
  }
});

// ===== ADMIN WORK HOURS TRACKING =====

// POST Log admin work hours
router.post("/admin/work-hours", verifyToken, async (req, res) => {
  try {
    const adminId = req.user?.id;
    const { date, hours_worked, task_description } = req.body;
    const parsedHoursWorked = parseHoursWorkedInput(hours_worked);

    if (!adminId) {
      return res.status(401).json({ error: "Admin not authenticated" });
    }

    // Verify user is admin
    const connection = await pool.getConnection();
    const [userCheck] = await connection.execute(
      "SELECT role FROM users WHERE id = ?",
      [adminId]
    );

    if (userCheck.length === 0 || userCheck[0].role !== "admin") {
      await connection.release();
      return res.status(403).json({ error: "Only admins can log work hours" });
    }

    if (!date || parsedHoursWorked === null) {
      await connection.release();
      return res.status(400).json({ error: "Date and worked time are required (e.g. 8, 8.5, or 8:30)" });
    }

    if (parsedHoursWorked < 0 || parsedHoursWorked > 24) {
      await connection.release();
      return res.status(400).json({ error: "Hours worked must be between 0 and 24" });
    }

    // Check if entry already exists for this date (manual entries only)
    const [existing] = await connection.execute(
      "SELECT id, is_auto_tracked FROM work_hours WHERE admin_id = ? AND date = ? AND is_auto_tracked = FALSE",
      [adminId, date]
    );

    if (existing.length > 0) {
      // Update existing manual entry
      await connection.execute(
        "UPDATE work_hours SET hours_worked = ?, task_description = ?, updated_at = NOW() WHERE id = ?",
        [Number(parsedHoursWorked.toFixed(2)), task_description || null, existing[0].id]
      );
    } else {
      // Insert new manual entry
      await connection.execute(
        "INSERT INTO work_hours (admin_id, date, hours_worked, task_description, is_auto_tracked) VALUES (?, ?, ?, ?, FALSE)",
        [adminId, date, Number(parsedHoursWorked.toFixed(2)), task_description || null]
      );
    }

    await connection.release();

    res.status(201).json({ message: "Work hours logged successfully" });
  } catch (err) {
    console.error("Log work hours error:", err);
    res.status(500).json({ error: "Failed to log work hours" });
  }
});

// GET Admin work hours
router.get("/admin/work-hours", verifyToken, async (req, res) => {
  try {
    const adminId = req.user?.id;
    const { start_date, end_date, status } = req.query;

    if (!adminId) {
      return res.status(401).json({ error: "Admin not authenticated" });
    }

    const connection = await pool.getConnection();

    let query = `
      SELECT 
        wh.id,
        wh.date,
        wh.hours_worked,
        wh.task_description,
        wh.status,
        wh.is_auto_tracked,
        wh.session_start,
        wh.session_end,
        wh.created_at,
        wh.updated_at,
        u.name as approved_by_name
      FROM work_hours wh
      LEFT JOIN users u ON wh.approved_by = u.id
      WHERE wh.admin_id = ?
    `;
    const params = [adminId];

    if (start_date) {
      query += " AND wh.date >= ?";
      params.push(start_date);
    }

    if (end_date) {
      query += " AND wh.date <= ?";
      params.push(end_date);
    }

    if (status) {
      query += " AND wh.status = ?";
      params.push(status);
    }

    query += " ORDER BY wh.date DESC";

    const [workHours] = await connection.execute(query, params);

    // Get summary
    const [summary] = await connection.execute(
      `SELECT 
        COALESCE(SUM(hours_worked), 0) as total_hours,
        COALESCE(SUM(CASE WHEN status = 'approved' THEN hours_worked ELSE 0 END), 0) as approved_hours,
        COALESCE(SUM(CASE WHEN status = 'pending' THEN hours_worked ELSE 0 END), 0) as pending_hours
      FROM work_hours 
      WHERE admin_id = ?`,
      [adminId]
    );

    await connection.release();

    res.json({
      workHours,
      summary: summary[0],
    });
  } catch (err) {
    console.error("Get work hours error:", err);
    res.status(500).json({ error: "Failed to fetch work hours" });
  }
});

// GET All admin work hours (Super Admin only)
router.get("/superadmin/work-hours", verifyToken, async (req, res) => {
  try {
    const allowedRoles = ["super_admin"];
    if (!allowedRoles.includes(req.user?.role)) {
      return res.status(403).json({ error: "Not authorized" });
    }

    const { start_date, end_date, status, admin_id } = req.query;
    const connection = await pool.getConnection();

    let query = `
      SELECT 
        wh.id,
        wh.admin_id,
        u.name as admin_name,
        u.email as admin_email,
        COALESCE(ur.custom_rate, u.hourly_rate, rr.default_rate, 0) as hourly_rate,
        wh.date,
        wh.hours_worked,
        wh.task_description,
        wh.status,
        wh.created_at,
        approver.name as approved_by_name,
        (wh.hours_worked * COALESCE(ur.custom_rate, u.hourly_rate, rr.default_rate, 0)) as calculated_payment
      FROM work_hours wh
      JOIN users u ON wh.admin_id = u.id
      LEFT JOIN users approver ON wh.approved_by = approver.id
      LEFT JOIN user_rates ur ON ur.user_id = u.id AND ur.payment_type = 'per_hour'
      LEFT JOIN role_rates rr ON rr.role_name = 'admin' AND rr.payment_type = 'per_hour'
      WHERE 1=1
    `;
    const params = [];

    if (admin_id) {
      query += " AND wh.admin_id = ?";
      params.push(admin_id);
    }

    if (start_date) {
      query += " AND wh.date >= ?";
      params.push(start_date);
    }

    if (end_date) {
      query += " AND wh.date <= ?";
      params.push(end_date);
    }

    if (status) {
      query += " AND wh.status = ?";
      params.push(status);
    }

    query += " ORDER BY wh.date DESC, u.name ASC";

    const [workHours] = await connection.execute(query, params);

    // Get summary by admin
    const [adminSummary] = await connection.execute(
      `SELECT 
        u.id,
        u.name,
        u.email,
        COALESCE(ur.custom_rate, u.hourly_rate, rr.default_rate, 0) as hourly_rate,
        COALESCE(SUM(wh.hours_worked), 0) as total_hours,
        COALESCE(SUM(CASE WHEN wh.status = 'approved' THEN wh.hours_worked ELSE 0 END), 0) as approved_hours,
        COALESCE(SUM(CASE WHEN wh.status = 'approved' THEN wh.hours_worked * COALESCE(ur.custom_rate, u.hourly_rate, rr.default_rate, 0) ELSE 0 END), 0) as total_payment_due
      FROM users u
      LEFT JOIN work_hours wh ON u.id = wh.admin_id
      LEFT JOIN user_rates ur ON ur.user_id = u.id AND ur.payment_type = 'per_hour'
      LEFT JOIN role_rates rr ON rr.role_name = 'admin' AND rr.payment_type = 'per_hour'
      WHERE u.role = 'admin'
      GROUP BY u.id, u.name, u.email, COALESCE(ur.custom_rate, u.hourly_rate, rr.default_rate, 0)
      ORDER BY total_hours DESC`
    );

    await connection.release();

    res.json({
      workHours,
      adminSummary,
    });
  } catch (err) {
    console.error("Get all work hours error:", err);
    res.status(500).json({ error: "Failed to fetch work hours" });
  }
});

// PUT Approve/Reject admin work hours (Super Admin only)
router.put("/superadmin/work-hours/:id/status", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const superAdminId = req.user?.id;

    const allowedRoles = ["super_admin"];
    if (!allowedRoles.includes(req.user?.role)) {
      return res.status(403).json({ error: "Not authorized" });
    }

    if (!["approved", "rejected", "pending"].includes(status)) {
      return res.status(400).json({ error: "Invalid status. Must be approved, rejected, or pending" });
    }

    const connection = await pool.getConnection();

    await connection.execute(
      "UPDATE work_hours SET status = ?, approved_by = ?, updated_at = NOW() WHERE id = ?",
      [status, superAdminId, id]
    );

    await connection.release();

    res.json({ message: `Work hours ${status}` });
  } catch (err) {
    console.error("Update work hours status error:", err);
    res.status(500).json({ error: "Failed to update work hours status" });
  }
});

// DELETE Admin work hours entry
router.delete("/admin/work-hours/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user?.id;

    const connection = await pool.getConnection();

    // Verify ownership or super admin - cannot delete auto-tracked entries
    if (req.user?.role !== "super_admin") {
      const [workHour] = await connection.execute(
        "SELECT admin_id, is_auto_tracked FROM work_hours WHERE id = ?",
        [id]
      );

      if (workHour.length === 0 || workHour[0].admin_id !== adminId) {
        await connection.release();
        return res.status(403).json({ error: "Not authorized to delete this entry" });
      }

      if (workHour[0].is_auto_tracked) {
        await connection.release();
        return res.status(403).json({ error: "Cannot delete auto-tracked entries. Please contact administrator." });
      }
    }

    await connection.execute("DELETE FROM work_hours WHERE id = ?", [id]);
    await connection.release();

    res.json({ message: "Work hours entry deleted" });
  } catch (err) {
    console.error("Delete work hours error:", err);
    res.status(500).json({ error: "Failed to delete work hours" });
  }
});

// PUT Toggle auto-tracking for admin
router.put("/admin/toggle-auto-tracking", verifyToken, async (req, res) => {
  try {
    const adminId = req.user?.id;
    const { auto_track_hours } = req.body;

    if (!adminId) {
      return res.status(401).json({ error: "Admin not authenticated" });
    }

    const connection = await pool.getConnection();

    // Verify user is admin
    const [userCheck] = await connection.execute(
      "SELECT role FROM users WHERE id = ?",
      [adminId]
    );

    if (userCheck.length === 0 || userCheck[0].role !== "admin") {
      await connection.release();
      return res.status(403).json({ error: "Only admins can toggle auto-tracking" });
    }

    await connection.execute(
      "UPDATE users SET auto_track_hours = ? WHERE id = ?",
      [auto_track_hours, adminId]
    );

    await connection.release();

    res.json({ 
      message: auto_track_hours ? "Auto-tracking enabled" : "Auto-tracking disabled",
      auto_track_hours 
    });
  } catch (err) {
    console.error("Toggle auto-tracking error:", err);
    res.status(500).json({ error: "Failed to toggle auto-tracking" });
  }
});

// GET Admin sessions for viewing tracking details
router.get("/admin/sessions", verifyToken, async (req, res) => {
  try {
    const adminId = req.user?.id;
    const { start_date, end_date, limit = 50 } = req.query;

    if (!adminId) {
      return res.status(401).json({ error: "Admin not authenticated" });
    }

    const connection = await pool.getConnection();

    let query = `
      SELECT 
        id,
        login_time,
        logout_time,
        session_duration,
        is_processed,
        ip_address,
        created_at
      FROM admin_sessions
      WHERE admin_id = ?
    `;
    const params = [adminId];

    if (start_date) {
      query += " AND DATE(login_time) >= ?";
      params.push(start_date);
    }

    if (end_date) {
      query += " AND DATE(login_time) <= ?";
      params.push(end_date);
    }

    query += " ORDER BY login_time DESC LIMIT ?";
    params.push(parseInt(limit));

    const [sessions] = await connection.execute(query, params);

    // Get user's auto-tracking status
    const [user] = await connection.execute(
      "SELECT auto_track_hours FROM users WHERE id = ?",
      [adminId]
    );

    await connection.release();

    res.json({
      sessions,
      auto_track_hours: user[0]?.auto_track_hours || false,
    });
  } catch (err) {
    console.error("Get sessions error:", err);
    res.status(500).json({ error: "Failed to fetch sessions" });
  }
});

// POST Sync current active session to work hours (for real-time tracking while logged in)
router.post("/admin/sync-active-session", verifyToken, async (req, res) => {
  try {
    const adminId = req.user?.id;
    
    if (!adminId) {
      return res.status(401).json({ error: "Admin not authenticated" });
    }

    const connection = await pool.getConnection();

    // Check if auto-tracking is enabled
    const [user] = await connection.execute(
      "SELECT auto_track_hours, name FROM users WHERE id = ?",
      [adminId]
    );

    if (user.length === 0 || user[0].auto_track_hours === false) {
      await connection.release();
      return res.json({ 
        message: "Auto-tracking disabled", 
        synced: false 
      });
    }

    // Find the most recent unclosed session
    const [sessions] = await connection.execute(
      `SELECT id, login_time FROM admin_sessions 
       WHERE admin_id = ? AND logout_time IS NULL 
       ORDER BY login_time DESC LIMIT 1`,
      [adminId]
    );

    if (sessions.length === 0) {
      await connection.release();
      return res.json({ 
        message: "No active session found", 
        synced: false 
      });
    }

    const session = sessions[0];
    const currentTime = new Date();
    const loginTime = new Date(session.login_time);
    const durationHours = (currentTime - loginTime) / (1000 * 60 * 60); // Convert to hours

    // Only sync if session is at least 15 minutes
    if (durationHours < 0.25) {
      await connection.release();
      return res.json({ 
        message: "Session too short (minimum 15 minutes required)", 
        current_duration_minutes: Math.round(durationHours * 60),
        synced: false 
      });
    }

    const workDate = loginTime.toISOString().split('T')[0];

    // Check if there's already an auto-tracked entry for today
    const [existingEntry] = await connection.execute(
      `SELECT id, hours_worked FROM work_hours 
       WHERE admin_id = ? AND date = ? AND is_auto_tracked = TRUE`,
      [adminId, workDate]
    );

    if (existingEntry.length > 0) {
      // Update existing entry with current session duration
      await connection.execute(
        `UPDATE work_hours 
         SET hours_worked = ?, updated_at = NOW() 
         WHERE id = ?`,
        [durationHours.toFixed(2), existingEntry[0].id]
      );
    } else {
      // Create new work hours entry for active session
      await connection.execute(
        `INSERT INTO work_hours 
         (admin_id, date, hours_worked, task_description, is_auto_tracked, session_start, session_end) 
         VALUES (?, ?, ?, ?, TRUE, ?, NOW())`,
        [
          adminId, 
          workDate, 
          durationHours.toFixed(2),
          'Auto-tracked session (active)',
          session.login_time
        ]
      );
    }

    await connection.release();

    console.log(`Synced active session: ${durationHours.toFixed(2)} hours for admin ${user[0].name}`);

    res.json({ 
      message: "Active session synced to work hours", 
      hours: parseFloat(durationHours.toFixed(2)),
      synced: true 
    });

  } catch (err) {
    console.error("Sync active session error:", err);
    res.status(500).json({ error: "Failed to sync active session" });
  }
});

// ===== END ADMIN WORK HOURS TRACKING =====
// PUT Update payment status
router.put("/payments/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, payment_date, approved_date } = req.body;
    const approverId = Number(req.user?.id || req.user?.userId || 0) || null;

    const toMySqlDateTime = (value) => {
      if (!value) return null;
      const date = value instanceof Date ? value : new Date(value);
      if (Number.isNaN(date.getTime())) return null;
      return date.toISOString().slice(0, 19).replace("T", " ");
    };

    if (!isSuperAdmin(req)) {
      return res.status(403).json({ error: "Not authorized" });
    }

    const connection = await pool.getConnection();

    const [existing] = await connection.execute(
      "SELECT status FROM payments WHERE id = ?",
      [id]
    );

    if (existing.length === 0) {
      await connection.release();
      return res.status(404).json({ error: "Payment not found" });
    }

    const currentStatus = existing[0].status;
    const nextStatus = status || null;

    if (nextStatus && !PAYMENT_STATUSES.includes(nextStatus)) {
      await connection.release();
      return res.status(400).json({ error: "Invalid payment status" });
    }

    const validTransitions = {
      [PAYMENT_STATUS.PENDING_CALCULATION]: [PAYMENT_STATUS.PENDING_APPROVAL, PAYMENT_STATUS.APPROVED, PAYMENT_STATUS.REJECTED],
      [PAYMENT_STATUS.PENDING_APPROVAL]: [PAYMENT_STATUS.APPROVED, PAYMENT_STATUS.REJECTED],
      [PAYMENT_STATUS.APPROVED]: [PAYMENT_STATUS.READY_TO_PAY, PAYMENT_STATUS.PAID, PAYMENT_STATUS.REJECTED],
      [PAYMENT_STATUS.READY_TO_PAY]: [PAYMENT_STATUS.PAID, PAYMENT_STATUS.REJECTED],
      [PAYMENT_STATUS.REJECTED]: [PAYMENT_STATUS.PENDING_APPROVAL],
      pending: [PAYMENT_STATUS.PENDING_APPROVAL, PAYMENT_STATUS.APPROVED, PAYMENT_STATUS.REJECTED],
      [PAYMENT_STATUS.PAID]: [],
    };

    if (nextStatus) {
      const allowed = validTransitions[currentStatus] || [];
      if (!allowed.includes(nextStatus)) {
        await connection.release();
        return res.status(400).json({
          error: `Invalid transition from ${currentStatus} to ${nextStatus}`,
        });
      }
    }

    const updates = [];
    const values = [];

    if (nextStatus) {
      updates.push("status = ?");
      values.push(nextStatus);
    }
    if (payment_date && nextStatus === PAYMENT_STATUS.PAID) {
      const normalizedPaymentDate = toMySqlDateTime(payment_date);
      if (!normalizedPaymentDate) {
        await connection.release();
        return res.status(400).json({ error: "Invalid payment_date format" });
      }
      updates.push("payment_date = ?");
      values.push(normalizedPaymentDate);
    }
    if (approved_date && nextStatus === PAYMENT_STATUS.APPROVED) {
      const normalizedApprovedDate = toMySqlDateTime(approved_date);
      if (!normalizedApprovedDate) {
        await connection.release();
        return res.status(400).json({ error: "Invalid approved_date format" });
      }
      updates.push("approved_date = ?");
      values.push(normalizedApprovedDate);
      if (approverId) {
        updates.push("approved_by = ?");
        values.push(approverId);
      }
    } else if (nextStatus === PAYMENT_STATUS.APPROVED) {
      updates.push("approved_date = ?");
      values.push(toMySqlDateTime(new Date()));
      if (approverId) {
        updates.push("approved_by = ?");
        values.push(approverId);
      }
    }

    if (nextStatus === PAYMENT_STATUS.PAID && !payment_date) {
      updates.push("payment_date = ?");
      values.push(toMySqlDateTime(new Date()));
    }

    if (updates.length === 0) {
      await connection.release();
      return res.status(400).json({ error: "No fields to update" });
    }

    values.push(id);

    await connection.execute(
      `UPDATE payments SET ${updates.join(", ")} WHERE id = ?`,
      values
    );

    await connection.release();

    res.json({ message: "Payment updated successfully" });
  } catch (err) {
    console.error("Update payment error:", err);
    res.status(500).json({ error: "Failed to update payment" });
  }
});

// DELETE Admin
router.delete("/admins/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const connection = await pool.getConnection();

    await connection.execute("DELETE FROM users WHERE id = ? AND role = 'admin'", [id]);

    await connection.release();

    res.json({ message: "Admin deleted successfully" });
  } catch (err) {
    console.error("Delete admin error:", err);
    res.status(500).json({ error: "Failed to delete admin" });
  }
});

// POST Add admin
router.post("/admins", verifyToken, async (req, res) => {
  try {
    const { name, email, password, hourly_rate } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: "All fields required" });
    }

    const connection = await pool.getConnection();

    const bcrypt = require("bcryptjs");
    const hashedPassword = await bcrypt.hash(password, 10);

    let resolvedHourlyRate = normalizeRateValue(hourly_rate);
    if (resolvedHourlyRate === null) {
      const [defaults] = await connection.execute(
        `SELECT default_rate
         FROM role_rates
         WHERE role_name = 'admin' AND payment_type = 'per_hour'
         LIMIT 1`
      );
      resolvedHourlyRate = Number(defaults?.[0]?.default_rate || 0);
    }

    await connection.execute(
      "INSERT INTO users (name, email, password, role, hourly_rate) VALUES (?, ?, ?, ?, ?)",
      [name, email, hashedPassword, "admin", resolvedHourlyRate]
    );

    await connection.release();

    res.status(201).json({ message: "Admin added successfully" });
  } catch (err) {
    console.error("Add admin error:", err);
    res.status(500).json({ error: "Failed to add admin" });
  }
});

// POST Add image with object count
router.post("/admin/images/add", verifyToken, async (req, res) => {
  try {
    const { filename, objectsCount } = req.body;
    const adminId = req.user?.id;

    if (!filename) {
      return res.status(400).json({ error: "Filename is required" });
    }

    if (!adminId) {
      return res.status(401).json({ error: "Admin not authenticated" });
    }

    const objectCount = Math.max(0, Number(objectsCount) || 0);
    
    // Extract model_type from filename (e.g., "PET_01_2300_2400" -> "PET")
    const modelTypeMatch = filename.match(/^([A-Z]+)_/);
    const modelType = modelTypeMatch ? modelTypeMatch[1] : null;

    const connection = await pool.getConnection();

    const [insertResult] = await connection.execute(
      "INSERT INTO images (image_name, model_type, status, admin_id, objects_count) VALUES (?, ?, ?, ?, ?)",
      [filename, modelType, "pending", adminId, objectCount]
    );

    await logImageHistory(connection, {
      imageId: insertResult.insertId,
      eventType: "created",
      statusFrom: null,
      statusTo: "pending",
      actorId: adminId,
      details: JSON.stringify({
        imageName: filename,
        objectsCount: objectCount,
      }),
    });

    await connection.release();

    res.status(201).json({ message: "Image added successfully" });
  } catch (err) {
    console.error("Add image error:", err);
    res.status(500).json({ error: "Failed to add image" });
  }
});

// DELETE image by ID (deletes related tasks due to CASCADE DELETE)
router.delete("/admin/images/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const connection = await pool.getConnection();

    try {
      // Check if image exists
      const [imageResult] = await connection.execute(
        "SELECT id, image_name FROM images WHERE id = ?",
        [id]
      );

      if (imageResult.length === 0) {
        await connection.release();
        return res.status(404).json({ error: "Image not found" });
      }

      const imageName = imageResult[0].image_name;

      // Temporarily disable foreign key checks to allow deletion
      await connection.execute("SET FOREIGN_KEY_CHECKS = 0");

      try {
        // Delete all tasks related to this image first
        const [deleteTasksResult] = await connection.execute(
          "DELETE FROM tasks WHERE image_id = ?",
          [id]
        );
        console.log(`Deleted ${deleteTasksResult.affectedRows} tasks for image ${id}`);

        // Delete the image
        const [deleteImageResult] = await connection.execute(
          "DELETE FROM images WHERE id = ?",
          [id]
        );
        console.log(`Deleted image ${id} (${imageName})`);

        // Re-enable foreign key checks
        await connection.execute("SET FOREIGN_KEY_CHECKS = 1");

        console.log(`Image ${id} (${imageName}) and related tasks deleted by user ${userId}`);
        await connection.release();
        res.json({ message: "Image and related tasks deleted successfully", deletedTasks: deleteTasksResult.affectedRows });
      } catch (err) {
        // Re-enable foreign key checks even on error
        try {
          await connection.execute("SET FOREIGN_KEY_CHECKS = 1");
        } catch (e) {
          console.error("Failed to re-enable FK checks:", e);
        }
        throw err;
      }
    } catch (err) {
      await connection.release();
      throw err;
    }
  } catch (err) {
    console.error("Delete image error:", err);
    res.status(500).json({ error: "Failed to delete image: " + (err.message || JSON.stringify(err)) });
  }
});

// ===== ADMIN SPECIFIC ROUTES =====

// GET Admin Dashboard - KPIs
// (reuses existing /kpis endpoint but we can add admin-specific data here if needed)

// GET Admin Reports with filtered data
router.get("/admin/reports", verifyToken, async (req, res) => {
  try {
    const connection = await pool.getConnection();

    // Status distribution
    const [statusDistribution] = await connection.execute(
      "SELECT status, COUNT(*) as count FROM images GROUP BY status"
    );

    // User contributions (annotators and testers only)
    const [userContributions] = await connection.execute(
      `SELECT u.id, u.name, u.email, u.role,
              COUNT(DISTINCT i.id) as images_count,
              SUM(CASE WHEN i.status = 'completed' THEN 1 ELSE 0 END) as completed_count
       FROM users u
       LEFT JOIN images i ON u.id = i.annotator_id OR u.id = i.tester_id
       WHERE u.role IN ('annotator', 'tester')
       GROUP BY u.id, u.name, u.email, u.role
       ORDER BY images_count DESC`
    );

    // Progress over time
    const [progressOverTime] = await connection.execute(
      `SELECT DATE(created_at) as date,
              SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
              SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
              SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
              SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
              SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected
       FROM images
       GROUP BY DATE(created_at)
       ORDER BY date DESC
       LIMIT 30`
    );

    await connection.release();

    res.json({
      statusDistribution,
      userContributions,
      progressOverTime,
    });
  } catch (err) {
    console.error("Admin reports error:", err);
    res.status(500).json({ error: "Failed to load reports" });
  }
});

// GET Admin Images list
router.get("/admin/images", verifyToken, async (req, res) => {
  try {
    const connection = await pool.getConnection();

    const [images] = await connection.execute(
      `SELECT 
        i.id,
        i.image_name,
        i.status,
        i.objects_count,
        i.created_at,
        i.admin_id,
        i.annotator_id,
        i.annotator_feedback,
        i.tester_id,
        i.tester_feedback,
        i.melbourne_user_id,
        i.melbourne_user_feedback,
        u_admin.name as admin_name,
        u_ann.name as annotator_name,
        u_test.name as tester_name,
        u_mel.name as melbourne_name,
        i.previous_tester_name,
        i.previous_feedback
       FROM images i
       LEFT JOIN users u_admin ON i.admin_id = u_admin.id
       LEFT JOIN users u_ann ON i.annotator_id = u_ann.id
       LEFT JOIN users u_test ON i.tester_id = u_test.id
       LEFT JOIN users u_mel ON i.melbourne_user_id = u_mel.id
       ORDER BY i.created_at DESC`
    );

    console.log("Admin images endpoint - Images retrieved:", images.length);

    await connection.release();

    res.json(images);
  } catch (err) {
    console.error("Get admin images error:", err);
    res.status(500).json({ error: "Failed to load images" });
  }
});

// GET Admin Image Details + Timeline History
router.get("/admin/images/:id/details", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const connection = await pool.getConnection();

    const [imageRows] = await connection.execute(
      `SELECT
        i.id,
        i.image_name,
        i.model_type,
        i.objects_count,
        i.created_at,
        i.updated_at,
        i.status,
        i.admin_id,
        u_admin.name as admin_name,
        i.annotator_feedback,
        i.tester_feedback,
        i.melbourne_user_feedback,
        i.previous_tester_name,
        i.previous_feedback,
        i.annotator_id,
        i.tester_id,
        i.melbourne_user_id,
        u_ann.name as annotator_name,
        u_ann.profile_picture as annotator_profile_picture,
        u_test.name as tester_name,
        u_test.profile_picture as tester_profile_picture,
        u_mel.name as melbourne_name,
        u_mel.profile_picture as melbourne_profile_picture,
        u_prev_test.profile_picture as previous_tester_profile_picture,
        (SELECT MIN(t1.assigned_date) FROM tasks t1 WHERE t1.image_id = i.id AND t1.task_type = 'annotation') as assignment_date,
        (SELECT MAX(t2.completed_date) FROM tasks t2 WHERE t2.image_id = i.id AND t2.task_type = 'annotation' AND t2.status = 'completed') as annotation_completed_date,
        (SELECT MAX(t3.completed_date) FROM tasks t3 WHERE t3.image_id = i.id AND t3.task_type = 'testing' AND t3.status IN ('approved', 'rejected')) as review_completed_date,
        (SELECT t4.notes FROM tasks t4 WHERE t4.image_id = i.id AND t4.task_type = 'testing' ORDER BY t4.updated_at DESC LIMIT 1) as tester_comments
       FROM images i
      LEFT JOIN users u_admin ON i.admin_id = u_admin.id
       LEFT JOIN users u_ann ON i.annotator_id = u_ann.id
       LEFT JOIN users u_test ON i.tester_id = u_test.id
       LEFT JOIN users u_mel ON i.melbourne_user_id = u_mel.id
       LEFT JOIN users u_prev_test ON i.previous_tester_name = u_prev_test.name
       WHERE i.id = ?
       LIMIT 1`,
      [id]
    );

    if (imageRows.length === 0) {
      await connection.release();
      return res.status(404).json({ error: "Image not found" });
    }

    const [historyRows] = await connection.execute(
      `SELECT
        h.id,
        h.event_type,
        h.status_from,
        h.status_to,
        h.actor_id,
        h.actor_name,
        h.details,
        h.created_at,
        u_actor.profile_picture as actor_profile_picture
       FROM image_history h
       LEFT JOIN users u_actor ON h.actor_name = u_actor.name
       WHERE h.image_id = ?
       ORDER BY h.created_at ASC, h.id ASC`,
      [id]
    );

    await connection.release();

    // Build a user profile lookup map from history to ensure we have all profile pictures
    const userNames = new Set();
    historyRows.forEach(h => {
      if (h.actor_name) userNames.add(h.actor_name);
      try {
        const details = JSON.parse(h.details || '{}');
        if (details.rejectedBy) userNames.add(details.rejectedBy);
        if (details.previousAnnotator) userNames.add(details.previousAnnotator);
        if (details.assignedTo) userNames.add(details.assignedTo);
        if (details.reassignedTo) userNames.add(details.reassignedTo);
        if (details.annotatorName) userNames.add(details.annotatorName);
        if (details.testerName) userNames.add(details.testerName);
        if (details.reviewer) userNames.add(details.reviewer);
      } catch (e) {
        // Ignore JSON parse errors
      }
    });
    
    // Add current and previous user names
    if (imageRows[0].annotator_name) userNames.add(imageRows[0].annotator_name);
    if (imageRows[0].tester_name) userNames.add(imageRows[0].tester_name);
    if (imageRows[0].previous_tester_name) userNames.add(imageRows[0].previous_tester_name);
    if (imageRows[0].melbourne_name) userNames.add(imageRows[0].melbourne_name);
    if (imageRows[0].admin_name) userNames.add(imageRows[0].admin_name);

    // Fetch profile pictures for all mentioned users (with case-insensitive matching)
    const userProfileMap = {};
    if (userNames.size > 0) {
      const connection2 = await pool.getConnection();
      const nameArray = Array.from(userNames);
      const [userProfiles] = await connection2.execute(
        `SELECT name, profile_picture FROM users WHERE name IN (${nameArray.map(() => '?').join(',')})`,
        nameArray
      );
      await connection2.release();
      
      // Create both exact match and lowercase match for better lookups
      userProfiles.forEach(u => {
        if (u.name) {
          userProfileMap[u.name] = u.profile_picture;
          userProfileMap[u.name.toLowerCase()] = u.profile_picture;
        }
      });
    }

    console.log('Image details userProfileMap:', userProfileMap);
    console.log('User names extracted:', Array.from(userNames));

    res.json({
      image: imageRows[0],
      history: historyRows,
      userProfileMap: userProfileMap,
    });
  } catch (err) {
    console.error("Get admin image details error:", err);
    res.status(500).json({ error: "Failed to load image details" });
  }
});

// GET Admin Filtered Users (annotators and testers only)
router.get("/admin/users-filtered", verifyToken, async (req, res) => {
  try {
    const connection = await pool.getConnection();

    const [annotators] = await connection.execute(
      "SELECT id, name, email, role, profile_picture, created_at FROM users WHERE role = 'annotator' ORDER BY name"
    );

    const [testers] = await connection.execute(
      "SELECT id, name, email, role, profile_picture, created_at FROM users WHERE role = 'tester' ORDER BY name"
    );

    const [melbourneUsers] = await connection.execute(
      "SELECT id, name, email, role, profile_picture, created_at FROM users WHERE role = 'melbourne_user' ORDER BY name"
    );

    await connection.release();

    res.json({
      annotators,
      testers,
      melbourneUsers,
    });
  } catch (err) {
    console.error("Get filtered users error:", err);
    res.status(500).json({ error: "Failed to load users" });
  }
});

// PUT Assign image to users
router.put("/admin/images/:id/assign", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { annotatorId, testerId, melbourneUserId, status, feedback, previous_tester_name, previous_feedback } = req.body;
    const adminId = req.user?.id;

    // Log incoming request for debugging
    console.log("Assign image request:", { id, annotatorId, testerId, melbourneUserId, status, feedback, adminId });

    if (!adminId) {
      return res.status(401).json({ error: "Admin user not authenticated" });
    }

    // Validate at least one assignment field is present and is a number if provided
    if (!annotatorId && !testerId && !melbourneUserId) {
      return res.status(400).json({ error: "At least one of annotatorId, testerId, or melbourneUserId is required" });
    }
    if ((annotatorId && isNaN(Number(annotatorId))) || (testerId && isNaN(Number(testerId))) || (melbourneUserId && isNaN(Number(melbourneUserId)))) {
      return res.status(400).json({ error: "annotatorId, testerId, and melbourneUserId must be numbers if provided" });
    }

    const connection = await pool.getConnection();

    // Check if image exists - fetch joined user names for reassignment history
    const [imageRows] = await connection.execute(
      `SELECT
        i.status,
        i.annotator_id,
        i.image_name,
        i.tester_id,
        i.annotator_feedback,
        u_ann.name as current_annotator_name,
        u_ann.profile_picture as current_annotator_profile_picture,
        u_test.name as current_tester_name,
        u_test.profile_picture as current_tester_profile_picture
       FROM images i
       LEFT JOIN users u_ann ON i.annotator_id = u_ann.id
       LEFT JOIN users u_test ON i.tester_id = u_test.id
       WHERE i.id = ?`,
      [id]
    );
    if (imageRows.length === 0) {
      await connection.release();
      return res.status(404).json({ error: "Image not found" });
    }
    const currentImage = imageRows[0];
    const [adminData] = await connection.execute(
      `SELECT name FROM users WHERE id = ?`,
      [adminId]
    );
    const adminName = adminData[0]?.name || "Admin";

    // Define isRejectedReassignment before it is used
    const isRejectedReassignment = currentImage.status === 'rejected' && annotatorId;

    let query = "UPDATE images SET ";
    let params = [];
    let fields = [];

    if (annotatorId) {
      fields.push("annotator_id = ?");
      params.push(annotatorId);
      // When reassigning after rejection, preserve the rejection history
      if (isRejectedReassignment) {
        fields.push("previous_tester_name = ?");
        params.push(previous_tester_name || currentImage.current_tester_name || null);
        if (previous_feedback) {
          fields.push("previous_feedback = ?");
          params.push(previous_feedback);
        }
      }
      // Reset status to in_progress when reassigning after rejection
      if (isRejectedReassignment && !status) {
        fields.push("status = ?");
        params.push("in_progress");
      }
    }
    if (testerId) {
      fields.push("tester_id = ?");
      params.push(testerId);
      if (!status) {
        fields.push("status = ?");
        params.push("pending_review");
      }
    }
    if (melbourneUserId) {
      fields.push("melbourne_user_id = ?");
      params.push(melbourneUserId);
    }
    if (status) {
      fields.push("status = ?");
      params.push(status);
    }
if (feedback && annotatorId) {
        fields.push("annotator_feedback = ?");
        params.push(feedback);
      } else if (feedback && testerId) {
        fields.push("tester_feedback = ?");
        params.push(feedback);
      } else if (feedback && melbourneUserId) {
        fields.push("melbourne_user_feedback = ?");
      params.push(feedback);
    }

    if (fields.length === 0) {
      await connection.release();
      return res.status(400).json({ error: "No fields to update" });
    }

    query += fields.join(", ") + " WHERE id = ?";
    params.push(id);

    await connection.execute(query, params);
    console.log(`Image ${id} updated with fields:`, fields);

    // Timeline logging for assignment/reassignment lifecycle
    if (annotatorId) {
      const [newAnnotatorRows] = await connection.execute(
        `SELECT name FROM users WHERE id = ? LIMIT 1`,
        [annotatorId]
      );
      const reassignedToName = newAnnotatorRows[0]?.name || `User #${annotatorId}`;

      if (isRejectedReassignment) {
        const historyDetails = JSON.stringify({
          rejectedBy: previous_tester_name || currentImage.current_tester_name || null,
          rejectedByProfilePicture: currentImage.current_tester_profile_picture || null,
          rejectionReason: previous_feedback || currentImage.annotator_feedback || null,
          previousAnnotator: currentImage.current_annotator_name || null,
          previousAnnotatorProfilePicture: currentImage.current_annotator_profile_picture || null,
          reassignedBy: adminName,
          reassignedTo: reassignedToName,
          reassignedAt: new Date().toISOString(),
        });

        await logImageHistory(connection, {
          imageId: id,
          eventType: "reassigned",
          statusFrom: currentImage.status,
          statusTo: status || "in_progress",
          actorId: adminId,
          actorName: adminName,
          details: historyDetails,
        });
      } else {
        await logImageHistory(connection, {
          imageId: id,
          eventType: "assigned_to_annotator",
          statusFrom: currentImage.status,
          statusTo: status || currentImage.status,
          actorId: adminId,
          actorName: adminName,
          details: JSON.stringify({
            assignedTo: reassignedToName,
            assignedToId: Number(annotatorId),
            assignedAt: new Date().toISOString(),
          }),
        });
      }
    }

    if (testerId) {
      const [newTesterRows] = await connection.execute(
        `SELECT name FROM users WHERE id = ? LIMIT 1`,
        [testerId]
      );
      const testerName = newTesterRows[0]?.name || `User #${testerId}`;

      await logImageHistory(connection, {
        imageId: id,
        eventType: "assigned_to_tester",
        statusFrom: currentImage.status,
        statusTo: status || "pending_review",
        actorId: adminId,
        actorName: adminName,
        details: JSON.stringify({
          assignedTester: testerName,
          assignedTesterId: Number(testerId),
        }),
      });
    }

    if (melbourneUserId) {
      const [newMelRows] = await connection.execute(
        `SELECT name FROM users WHERE id = ? LIMIT 1`,
        [melbourneUserId]
      );

      await logImageHistory(connection, {
        imageId: id,
        eventType: "sent_to_melbourne",
        statusFrom: currentImage.status,
        statusTo: status || currentImage.status,
        actorId: adminId,
        actorName: adminName,
        details: JSON.stringify({
          melbourneUser: newMelRows[0]?.name || `User #${melbourneUserId}`,
          melbourneUserId: Number(melbourneUserId),
        }),
      });
    }

    // Create task if assigning to annotator
    if (annotatorId) {
      try {
        const taskId = `TASK_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const imageName = currentImage.image_name || `Image #${id}`;

        await connection.execute(
          `INSERT INTO tasks (task_id, image_id, user_id, assigned_by, task_type, status, assigned_date)
           VALUES (?, ?, ?, ?, 'annotation', 'pending', NOW())`,
          [taskId, id, annotatorId, adminId]
        );
        // Create notification for annotator
        await createNotification(
          connection,
          annotatorId,
          'image_assigned_annotator',
          `${adminName} assigned "${imageName}" to you for annotation | ACTION: Open Dashboard -> Click image -> Start annotating`,
          id
        );
        console.log(`Task created: ${taskId} for annotator ${annotatorId}`);
      } catch (taskErr) {
        console.error("Failed to create annotator task:", taskErr);
      }
    }

    // Create task if assigning to tester
    if (testerId) {
      try {
        const taskId = `TASK_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const [existingTesterTask] = await connection.execute(
          `SELECT id FROM tasks WHERE image_id = ? AND task_type = 'testing' LIMIT 1`,
          [id]
        );
        const imageName = currentImage.image_name || `Image #${id}`;
        if (existingTesterTask.length === 0) {
          await connection.execute(
            `INSERT INTO tasks (task_id, image_id, user_id, assigned_by, task_type, status, assigned_date)
             VALUES (?, ?, ?, ?, 'testing', 'pending_review', NOW())`,
            [taskId, id, testerId, adminId]
          );
          await createNotification(
            connection,
            testerId,
            'image_assigned_tester',
            `${adminName} assigned "${imageName}" to you for review/testing | ACTION: Open Dashboard -> Click image -> Approve or Reject`,
            id
          );
          console.log(`Task created: ${taskId} for tester ${testerId}`);
        } else {
          // Task already exists from a previous cycle — reassign to the (possibly new) tester and reset status
          await connection.execute(
            `UPDATE tasks SET user_id = ?, assigned_by = ?, status = 'pending_review',
             notes = NULL, assigned_date = NOW(), updated_at = NOW(), completed_date = NULL
             WHERE id = ?`,
            [testerId, adminId, existingTesterTask[0].id]
          );
          await createNotification(
            connection,
            testerId,
            'image_assigned_tester',
            `${adminName} assigned "${imageName}" to you for review/testing | ACTION: Open Dashboard -> Click image -> Approve or Reject`,
            id
          );
          console.log(`Task reset to pending_review for tester ${testerId} (task id ${existingTesterTask[0].id})`);
        }
      } catch (taskErr) {
        console.error("Failed to create tester task:", taskErr);
      }
    }

    await connection.release();
    res.json({ message: "Image assigned successfully" });
  } catch (err) {
    console.error("Assign image error:", err);
    res.status(500).json({ error: "Failed to assign image", details: err.message });
  }
});

// GET Payment Eligibility Report
// Shows which annotators are eligible for payment on each task
router.get("/admin/payment-eligibility", verifyToken, async (req, res) => {
  try {
    const connection = await pool.getConnection();

    // Get all tasks with payment eligibility status
    const [tasks] = await connection.execute(`
      SELECT 
        t.id,
        t.task_id,
        i.image_name,
        i.id as image_id,
        u.name as annotator_name,
        u.email as annotator_email,
        t.status,
        t.eligible_for_payment,
        t.assigned_date,
        t.completed_date,
        ua.name as assigned_by_name,
        (SELECT COUNT(*) FROM tasks t2 
         WHERE t2.image_id = i.id 
         AND t2.task_type = 'annotation') as total_assignments
      FROM tasks t
      LEFT JOIN images i ON t.image_id = i.id
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN users ua ON t.assigned_by = ua.id
      WHERE t.task_type = 'annotation'
      ORDER BY i.id, t.assigned_date DESC
    `);

    // Group by image to show reassignment history
    const imageGroups = {};
    tasks.forEach(task => {
      if (!imageGroups[task.image_id]) {
        imageGroups[task.image_id] = {
          image_name: task.image_name,
          image_id: task.image_id,
          assignments: []
        };
      }
      imageGroups[task.image_id].assignments.push(task);
    });

    await connection.release();
    res.json({ 
      tasks,
      imageGroups: Object.values(imageGroups)
    });
  } catch (err) {
    console.error("Payment eligibility report error:", err);
    res.status(500).json({ error: "Failed to fetch payment eligibility report" });
  }
});

// GET Admin Payments
router.get("/admin/payments", verifyToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const connection = await pool.getConnection();

    const [userRole] = await connection.execute(
      `SELECT role FROM users WHERE id = ? LIMIT 1`,
      [userId]
    );
    if (!userRole.length || userRole[0].role !== "admin") {
      await connection.release();
      return res.status(403).json({ error: "Not authorized" });
    }

    // Get total earned and hours for this admin
    const [payments] = await connection.execute(
      `SELECT 
              SUM(amount) as totalEarned,
              SUM(hours) as totalHours,
              AVG(CASE WHEN hours > 0 THEN amount / hours ELSE NULL END) as perHourRate
       FROM payments
       WHERE user_id = ?`,
      [userId]
    );

    // Get payment history
    const [history] = await connection.execute(
      `SELECT
         COALESCE(payment_date, created_at) as date,
         CONCAT('Payment ', UPPER(COALESCE(status, 'pending'))) as description,
         COALESCE(payment_method, 'bank') as type,
         amount,
         hours
       FROM payments
       WHERE user_id = ?
       ORDER BY COALESCE(payment_date, created_at) DESC
       LIMIT 20`,
      [userId]
    );

    await connection.release();

    const totalEarned = payments[0]?.totalEarned || 0;
    const totalHours = payments[0]?.totalHours || 0;
    const perHourRate = payments[0]?.perHourRate || 10;
    const monthlyTotal = totalEarned; // Could be filtered by date

    res.json({
      totalEarned,
      totalHours,
      perHourRate,
      history: history || [],
      monthlyTotal,
    });
  } catch (err) {
    console.error("Get payments error:", err);
    res.status(500).json({ error: "Failed to load payments" });
  }
});

// PUT Update Admin Profile
router.put("/admin/profile", verifyToken, async (req, res) => {
  try {
    const { name, email, phone } = req.body;
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const connection = await pool.getConnection();

    await connection.execute(
      `UPDATE users SET name = ?, email = ?, phone = ? WHERE id = ?`,
      [name, email, phone || null, userId]
    );

    await connection.release();
    res.json({ message: "Profile updated successfully" });
  } catch (err) {
    console.error("Update profile error:", err);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

// PUT Change Admin Password
router.put("/admin/change-password", verifyToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Current and new password required" });
    }

    const connection = await pool.getConnection();
    const bcrypt = require("bcryptjs");

    const [user] = await connection.execute(
      `SELECT password FROM users WHERE id = ?`,
      [userId]
    );

    if (!user || !user[0]) {
      await connection.release();
      return res.status(404).json({ error: "User not found" });
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, user[0].password);
    if (!isPasswordValid) {
      await connection.release();
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await connection.execute(
      `UPDATE users SET password = ? WHERE id = ?`,
      [hashedPassword, userId]
    );

    await connection.release();
    res.json({ message: "Password changed successfully" });
  } catch (err) {
    console.error("Change password error:", err);
    res.status(500).json({ error: "Failed to change password" });
  }
});

// PUT Change Password (backward-compatible route for older clients)
router.put("/change-password", verifyToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Current and new password required" });
    }

    const connection = await pool.getConnection();
    const bcrypt = require("bcryptjs");

    const [user] = await connection.execute(
      `SELECT password FROM users WHERE id = ?`,
      [userId]
    );

    if (!user || !user[0]) {
      await connection.release();
      return res.status(404).json({ error: "User not found" });
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, user[0].password);
    if (!isPasswordValid) {
      await connection.release();
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await connection.execute(
      `UPDATE users SET password = ? WHERE id = ?`,
      [hashedPassword, userId]
    );

    await connection.release();
    res.json({ message: "Password changed successfully" });
  } catch (err) {
    console.error("Change password error:", err);
    res.status(500).json({ error: "Failed to change password" });
  }
});

// PUT Update Super Admin Profile
router.put("/super-admin/profile", verifyToken, async (req, res) => {
  try {
    const { name, email, phone } = req.body;
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const connection = await pool.getConnection();

    await connection.execute(
      `UPDATE users SET name = ?, email = ?, phone = ? WHERE id = ?`,
      [name, email, phone || null, userId]
    );

    await connection.release();
    res.json({ message: "Profile updated successfully" });
  } catch (err) {
    console.error("Update profile error:", err);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

// PUT Change Super Admin Password
router.put("/super-admin/change-password", verifyToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Current and new password required" });
    }

    const connection = await pool.getConnection();
    const bcrypt = require("bcryptjs");

    const [user] = await connection.execute(
      `SELECT password FROM users WHERE id = ?`,
      [userId]
    );

    if (!user || !user[0]) {
      await connection.release();
      return res.status(404).json({ error: "User not found" });
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, user[0].password);
    if (!isPasswordValid) {
      await connection.release();
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await connection.execute(
      `UPDATE users SET password = ? WHERE id = ?`,
      [hashedPassword, userId]
    );

    await connection.release();
    res.json({ message: "Password changed successfully" });
  } catch (err) {
    console.error("Change password error:", err);
    res.status(500).json({ error: "Failed to change password" });
  }
});

// PUT Update Melbourne User Profile
router.put("/melbourne/profile", verifyToken, async (req, res) => {
  try {
    const { name, email, phone } = req.body;
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const connection = await pool.getConnection();

    await connection.execute(
      `UPDATE users SET name = ?, email = ?, phone = ? WHERE id = ?`,
      [name, email, phone || null, userId]
    );

    await connection.release();
    res.json({ message: "Profile updated successfully" });
  } catch (err) {
    console.error("Update profile error:", err);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

// PUT Change Melbourne User Password
router.put("/melbourne/change-password", verifyToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Current and new password required" });
    }

    const connection = await pool.getConnection();
    const bcrypt = require("bcryptjs");

    const [user] = await connection.execute(
      `SELECT password FROM users WHERE id = ?`,
      [userId]
    );

    if (!user || !user[0]) {
      await connection.release();
      return res.status(404).json({ error: "User not found" });
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, user[0].password);
    if (!isPasswordValid) {
      await connection.release();
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await connection.execute(
      `UPDATE users SET password = ? WHERE id = ?`,
      [hashedPassword, userId]
    );

    await connection.release();
    res.json({ message: "Password changed successfully" });
  } catch (err) {
    console.error("Change password error:", err);
    res.status(500).json({ error: "Failed to change password" });
  }
});

// ========== ANNOTATOR ROUTES ==========

// GET Annotator KPIs
router.get("/annotator/kpis", verifyToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }
    const connection = await pool.getConnection();

    const [assignedImages] = await connection.execute(
      `SELECT COUNT(*) as count FROM tasks WHERE user_id = ? AND status IN ('pending', 'in_progress')`,
      [userId]
    );

    const [inProgress] = await connection.execute(
      `SELECT COUNT(*) as count FROM tasks WHERE user_id = ? AND status = 'in_progress'`,
      [userId]
    );

    const [completed] = await connection.execute(
      `SELECT COUNT(*) as count FROM tasks WHERE user_id = ? AND status = 'completed'`,
      [userId]
    );

    const [pendingReview] = await connection.execute(
      `SELECT COUNT(*) as count FROM tasks WHERE user_id = ? AND status = 'pending_review'`,
      [userId]
    );

    await connection.release();

    res.json({
      assignedImages: assignedImages[0].count,
      inProgress: inProgress[0].count,
      completed: completed[0].count,
      pendingReview: pendingReview[0].count,
    });
  } catch (err) {
    console.error("Annotator KPIs error:", err);
    res.status(500).json({ error: "Failed to fetch KPIs" });
  }
});

// GET Annotator Tasks
router.get("/annotator/tasks", verifyToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const connection = await pool.getConnection();

    const [tasks] = await connection.execute(`
      SELECT 
        t.id,
        t.task_id,
        i.image_name,
        t.status,
        u.name as assigned_by,
        t.notes as annotator_notes,
        i.melbourne_user_feedback as melbourne_feedback,
        (SELECT t2.notes FROM tasks t2 WHERE t2.image_id = i.id AND t2.task_type = 'testing' LIMIT 1) as tester_feedback,
        t.assigned_date
      FROM tasks t
      LEFT JOIN images i ON t.image_id = i.id
      LEFT JOIN users u ON t.assigned_by = u.id
      WHERE t.user_id = ? AND t.task_type = 'annotation'
      AND t.status IN ('pending', 'in_progress', 'pending_review', 'completed')
      ORDER BY t.assigned_date ASC
    `, [userId]);

    await connection.release();
    res.json(tasks);
  } catch (err) {
    console.error("Annotator tasks error:", err);
    res.status(500).json({ error: "Failed to fetch tasks" });
  }
});

// PUT Update Task Status
router.put("/annotator/tasks/:id/status", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    if (!status) {
      return res.status(400).json({ error: "Status is required" });
    }

    const connection = await pool.getConnection();

    // First, get the image_id from the task
    const [taskResult] = await connection.execute(
      `SELECT image_id, status FROM tasks WHERE id = ? AND user_id = ?`,
      [id, userId]
    );

    if (taskResult.length === 0) {
      await connection.release();
      return res.status(404).json({ error: "Task not found" });
    }

    const imageId = taskResult[0].image_id;
    const previousStatus = taskResult[0].status;

    // Update task status with completed_date if status is completed
    let updateQuery = `UPDATE tasks SET status = ?, notes = ?, updated_at = NOW()`;
    if (status === 'completed') {
      updateQuery += `, completed_date = NOW()`;
    }
    updateQuery += ` WHERE id = ? AND user_id = ?`;
    
    await connection.execute(
      updateQuery,
      [status, notes || null, id, userId]
    );

    // Also update the corresponding image status
    if (status === "completed") {
      // When annotator completes, save their notes to annotator_feedback
      await connection.execute(
        `UPDATE images SET status = ?, annotator_feedback = ?, updated_at = NOW() WHERE id = ?`,
        [status, notes || null, imageId]
      );
    } else {
      await connection.execute(
        `UPDATE images SET status = ?, updated_at = NOW() WHERE id = ?`,
        [status, imageId]
      );
    }

    if (status === "completed") {
      await logImageHistory(connection, {
        imageId,
        eventType: "annotation_completed",
        statusFrom: previousStatus,
        statusTo: status,
        actorId: userId,
        details: JSON.stringify({
          notes: notes || null,
          completedAt: new Date().toISOString(),
        }),
      });
    }

    await connection.release();
    res.json({ message: "Task status updated successfully" });
  } catch (err) {
    console.error("Update task status error:", err);
    res.status(500).json({ error: "Failed to update task status" });
  }
});

// GET Annotator Task History
router.get("/annotator/task-history", verifyToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }
    const connection = await pool.getConnection();

    const [tasks] = await connection.execute(`
      SELECT 
        t.id,
        t.task_id,
        i.image_name,
        t.status,
        t.notes,
        i.annotator_feedback,
        t.assigned_date,
        t.completed_date,
        (SELECT t2.notes FROM tasks t2 WHERE t2.image_id = i.id AND t2.task_type = 'testing' ORDER BY t2.updated_at DESC LIMIT 1) as tester_feedback
      FROM tasks t
      LEFT JOIN images i ON t.image_id = i.id
      WHERE t.user_id = ? AND t.task_type = 'annotation'
      ORDER BY t.assigned_date DESC
    `, [userId]);

    await connection.release();
    res.json(tasks);
  } catch (err) {
    console.error("Task history error:", err);
    res.status(500).json({ error: "Failed to fetch task history" });
  }
});

// GET Annotator Payments
router.get("/annotator/payments", verifyToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }
    const connection = await pool.getConnection();

    const [paymentDue] = await connection.execute(
      `SELECT COALESCE(SUM(amount), 0) as total
       FROM payments
       WHERE user_id = ?
         AND status IN ('pending_calculation', 'pending_approval', 'approved', 'ready_to_pay')`,
      [userId]
    );

    // Only count completed tasks that are eligible for payment (not from rejected work)
    const [tasksCompleted] = await connection.execute(
      `SELECT COUNT(*) as count FROM tasks 
       WHERE user_id = ? AND status = 'completed' AND eligible_for_payment = TRUE`,
      [userId]
    );

    const [totalAmountDue] = await connection.execute(
      `SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE user_id = ?`,
      [userId]
    );

    const [completedAmount] = await connection.execute(
      `SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE user_id = ? AND status = 'paid'`,
      [userId]
    );

    const [paymentHistory] = await connection.execute(
      `SELECT * FROM payments WHERE user_id = ? ORDER BY created_at DESC LIMIT 10`,
      [userId]
    );

    await connection.release();

    res.json({
      paymentDue: paymentDue[0].total,
      tasksCompleted: tasksCompleted[0].count,
      totalAmountDue: totalAmountDue[0].total,
      completedAmount: completedAmount[0].total,
      previousAmount: completedAmount[0].total > 0 ? completedAmount[0].total - 1000 : 0,
      paymentHistory: paymentHistory,
    });
  } catch (err) {
    console.error("Annotator payments error:", err);
    res.status(500).json({ error: "Failed to fetch payments" });
  }
});

// PUT Update Annotator Profile
router.put("/annotator/profile", verifyToken, async (req, res) => {
  try {
    const { name, email, phone } = req.body;
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const connection = await pool.getConnection();

    await connection.execute(
      `UPDATE users SET name = ?, email = ?, phone = ? WHERE id = ?`,
      [name, email, phone || null, userId]
    );

    await connection.release();
    res.json({ message: "Profile updated successfully" });
  } catch (err) {
    console.error("Update profile error:", err);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

// PUT Change Annotator Password
router.put("/annotator/change-password", verifyToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Current and new password required" });
    }

    const connection = await pool.getConnection();
    const bcrypt = require("bcryptjs");

    const [user] = await connection.execute(
      `SELECT password FROM users WHERE id = ?`,
      [userId]
    );

    if (!user || !user[0]) {
      await connection.release();
      return res.status(404).json({ error: "User not found" });
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, user[0].password);
    if (!isPasswordValid) {
      await connection.release();
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await connection.execute(
      `UPDATE users SET password = ? WHERE id = ?`,
      [hashedPassword, userId]
    );

    await connection.release();
    res.json({ message: "Password changed successfully" });
  } catch (err) {
    console.error("Change password error:", err);
    res.status(500).json({ error: "Failed to change password" });
  }
});

// ===================== TESTER ROUTES =====================

// GET Tester Dashboard
router.get("/tester/dashboard", verifyToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const connection = await pool.getConnection();

    // Get today's approved count
    const [approvedToday] = await connection.execute(
      `SELECT COUNT(*) as count FROM tasks 
       WHERE user_id = ? AND status = 'approved' 
       AND DATE(updated_at) = CURDATE()`,
      [userId]
    );

    // Get today's rejected count
    const [rejectedToday] = await connection.execute(
      `SELECT COUNT(*) as count FROM tasks 
       WHERE user_id = ? AND status = 'rejected' 
       AND DATE(updated_at) = CURDATE()`,
      [userId]
    );

    // Get pending reviews count for tester
    const [pendingReviews] = await connection.execute(
      `SELECT COUNT(*) as count FROM tasks 
       WHERE user_id = ? AND task_type = 'testing' AND status IN ('pending', 'pending_review', 'completed')`,
      [userId]
    );

    // Get total earnings
    const [totalEarnings] = await connection.execute(
      `SELECT COALESCE(SUM(amount), 0) as total 
       FROM payments WHERE user_id = ?`,
      [userId]
    );

    await connection.release();

    res.json({
      approvedToday: approvedToday[0].count,
      rejectedToday: rejectedToday[0].count,
      pendingReviews: pendingReviews[0].count,
      totalEarnings: totalEarnings[0].total,
    });
  } catch (err) {
    console.error("Tester dashboard error:", err);
    res.status(500).json({ error: "Failed to fetch tester dashboard data" });
  }
});

// GET Tester Pending Tasks (Image Sets to Review)
router.get("/tester/tasks", verifyToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const connection = await pool.getConnection();

    const [tasks] = await connection.execute(
      `SELECT 
        t.id,
        t.task_id,
        i.image_name,
        i.objects_count,
        t.status,
        t.assigned_date,
        t.notes as tester_notes,
        (SELECT t2.notes FROM tasks t2 WHERE t2.image_id = i.id AND t2.task_type = 'annotation' LIMIT 1) as annotator_notes,
        i.melbourne_user_feedback as melbourne_feedback,
        u.name as assigned_by_name
      FROM tasks t
      LEFT JOIN images i ON t.image_id = i.id
      LEFT JOIN users u ON t.assigned_by = u.id
      WHERE t.user_id = ? AND t.task_type = 'testing' AND t.status IN ('pending', 'pending_review', 'completed')
      ORDER BY t.assigned_date ASC`,
      [userId]
    );

    await connection.release();
    res.json(tasks);
  } catch (err) {
    console.error("Tester tasks error:", err);
    res.status(500).json({ error: "Failed to fetch tester tasks" });
  }
});

// PUT Tester Review Task (Approve/Reject)
router.put("/tester/tasks/:id/review", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, feedback } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    if (!status || !['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: "Valid status (approved/rejected) is required" });
    }

    const connection = await pool.getConnection();

    // Get the image_id, task details, and annotator from the task
    const [taskResult] = await connection.execute(
      `SELECT t.image_id, t.task_type, i.image_name, i.annotator_id, u_ann.name as annotator_name,
              u_ann.profile_picture as annotator_profile_picture
       FROM tasks t
       LEFT JOIN images i ON t.image_id = i.id
       LEFT JOIN users u_ann ON i.annotator_id = u_ann.id
       WHERE t.id = ? AND t.user_id = ?`,
      [id, userId]
    );

    if (taskResult.length === 0) {
      await connection.release();
      return res.status(404).json({ error: "Task not found" });
    }

    const imageId = taskResult[0].image_id;
    const imageName = taskResult[0].image_name || `Image #${imageId}`;
    const annotatorId = taskResult[0].annotator_id;
    const annotatorName = taskResult[0].annotator_name || null;
    const annotatorProfilePicture = taskResult[0].annotator_profile_picture || null;
    console.log(`Tester ${userId} reviewing task ${id} with status ${status}`);

    // If rejecting, mark all previous annotation tasks for this image as ineligible for payment
    if (status === 'rejected') {
      await connection.execute(
        `UPDATE tasks SET eligible_for_payment = FALSE 
         WHERE image_id = ? AND task_type = 'annotation' AND status IN ('completed', 'pending_review', 'rejected')`,
        [imageId]
      );
      console.log(`Marked previous annotation tasks for image ${imageId} as ineligible for payment`);
    }

    // Update task status and set completed_date
    await connection.execute(
      `UPDATE tasks SET status = ?, notes = ?, updated_at = NOW(), completed_date = NOW() 
       WHERE id = ? AND user_id = ?`,
      [status, feedback || null, id, userId]
    );

    // Also update the corresponding image status and tester feedback
    await connection.execute(
      `UPDATE images SET status = ?, tester_feedback = ?, updated_at = NOW() WHERE id = ?`,
      [status, feedback || null, imageId]
    );

    const [testerData] = await connection.execute(
      `SELECT name, profile_picture FROM users WHERE id = ?`,
      [userId]
    );
    const testerName = testerData[0]?.name || 'Tester';
    const testerProfilePicture = testerData[0]?.profile_picture || null;

    await logImageHistory(connection, {
      imageId,
      eventType: "reviewed",
      statusFrom: "pending_review",
      statusTo: "pending_review",
      actorId: userId,
      actorName: testerName,
      details: JSON.stringify({
        reviewer: testerName,
        decision: status,
        comments: feedback || null,
      }),
    });

    await logImageHistory(connection, {
      imageId,
      eventType: status === "rejected" ? "rejected" : "approved",
      statusFrom: "pending_review",
      statusTo: status,
      actorId: userId,
      actorName: testerName,
      details: JSON.stringify({
        rejectedBy: status === "rejected" ? testerName : null,
        rejectedByProfilePicture: status === "rejected" ? testerProfilePicture : null,
        rejectionDate: status === "rejected" ? new Date().toISOString() : null,
        rejectionReason: status === "rejected" ? (feedback || null) : null,
        previousAnnotator: status === "rejected" ? annotatorName : null,
        previousAnnotatorProfilePicture: status === "rejected" ? annotatorProfilePicture : null,
        testerComments: feedback || null,
      }),
    });

    // Create notifications
    const notificationType = status === 'approved' ? 'image_approved' : 'image_rejected';

    const notificationMessage = status === 'approved' 
      ? `${testerName} approved "${imageName}" | ACTION: Check your Dashboard for next steps` 
      : `${testerName} rejected "${imageName}" | ACTION: Review feedback and resubmit if needed`;

    // Notify annotator about the review result
    if (annotatorId) {
      await createNotification(
        connection,
        annotatorId,
        notificationType,
        notificationMessage,
        imageId
      );
    }

    // Notify all admins
    const [admins] = await connection.execute(
      `SELECT id, name FROM users WHERE role = 'admin'`
    );
    for (const admin of admins) {
      await createNotification(
        connection,
        admin.id,
        notificationType,
        `${testerName} ${status} image: "${imageName}" | Assigned by: ${admin.name} | ACTION: Check Dashboard for details`,
        imageId
      );
    }

    console.log(`Task ${id} and image ${imageId} updated to status: ${status}`);
    await connection.release();
    res.json({ message: "Review submitted successfully" });
  } catch (err) {
    console.error("Tester review error:", err);
    res.status(500).json({ error: "Failed to submit review" });
  }
});

// GET Tester Payments
router.get("/tester/payments", verifyToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const connection = await pool.getConnection();

    const [paymentDue] = await connection.execute(
      `SELECT COALESCE(SUM(amount), 0) as total
       FROM payments
       WHERE user_id = ?
         AND status IN ('pending_calculation', 'pending_approval', 'approved', 'ready_to_pay')`,
      [userId]
    );

    const [totalEarnings] = await connection.execute(
      `SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE user_id = ?`,
      [userId]
    );

    const [paymentHistory] = await connection.execute(
      `SELECT 
        DATE_FORMAT(payment_date, '%Y-%m-%d') as date,
        images_completed as image_sets,
        amount,
        status
      FROM payments 
      WHERE user_id = ?
      ORDER BY payment_date DESC`,
      [userId]
    );

    await connection.release();

    res.json({
      paymentDue: paymentDue[0].total,
      totalEarnings: totalEarnings[0].total,
      paymentHistory,
    });
  } catch (err) {
    console.error("Tester payments error:", err);
    res.status(500).json({ error: "Failed to fetch payment data" });
  }
});

// GET Tester Task History
router.get("/tester/task-history", verifyToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const connection = await pool.getConnection();

    const [tasks] = await connection.execute(
      `SELECT 
        t.id,
        t.task_id,
        i.image_name,
        i.objects_count,
        t.status,
        t.task_type,
        t.assigned_date,
        t.completed_date,
        t.notes as tester_notes,
        (SELECT t2.notes FROM tasks t2 WHERE t2.image_id = i.id AND t2.task_type = 'annotation' LIMIT 1) as annotator_notes,
        i.melbourne_user_feedback as melbourne_feedback,
        u.name as assigned_by_name
      FROM tasks t
      LEFT JOIN images i ON t.image_id = i.id
      LEFT JOIN users u ON t.assigned_by = u.id
      WHERE t.user_id = ? AND t.task_type = 'testing'
      ORDER BY t.assigned_date DESC`,
      [userId]
    );

    console.log(`Tester ${userId} task history: ${tasks.length} tasks found`);
    await connection.release();
    res.json(tasks);
  } catch (err) {
    console.error("Tester task history error:", err);
    res.status(500).json({ error: "Failed to fetch task history" });
  }
});

// GET Tester Profile
router.get("/tester/profile", verifyToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const connection = await pool.getConnection();

    const [user] = await connection.execute(
      `SELECT id, name, email, role, created_at FROM users WHERE id = ?`,
      [userId]
    );

    await connection.release();

    if (!user || !user[0]) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(user[0]);
  } catch (err) {
    console.error("Tester profile error:", err);
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

// PUT Update Tester Profile
router.put("/tester/profile", verifyToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    const { name, email, phone } = req.body;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const connection = await pool.getConnection();

    // Check if phone column exists, if not we'll skip it
    await connection.execute(
      `UPDATE users SET name = ?, email = ? WHERE id = ?`,
      [name, email, userId]
    );

    await connection.release();
    res.json({ message: "Profile updated successfully" });
  } catch (err) {
    console.error("Update tester profile error:", err);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

// PUT Change Tester Password
router.put("/tester/change-password", verifyToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Current and new password required" });
    }

    const connection = await pool.getConnection();
    const bcrypt = require("bcryptjs");

    const [user] = await connection.execute(
      `SELECT password FROM users WHERE id = ?`,
      [userId]
    );

    if (!user || !user[0]) {
      await connection.release();
      return res.status(404).json({ error: "User not found" });
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, user[0].password);
    if (!isPasswordValid) {
      await connection.release();
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await connection.execute(
      `UPDATE users SET password = ? WHERE id = ?`,
      [hashedPassword, userId]
    );

    await connection.release();
    res.json({ message: "Password changed successfully" });
  } catch (err) {
    console.error("Change tester password error:", err);
    res.status(500).json({ error: "Failed to change password" });
  }
});

// ===================== MELBOURNE USER ROUTES =====================

// GET Melbourne User Dashboard
router.get("/melbourne/dashboard", verifyToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const connection = await pool.getConnection();

    // Get pending review count (tester approved datasets)
    const [pendingReview] = await connection.execute(
      `SELECT COUNT(*) as count FROM images WHERE status = 'approved' AND melbourne_user_id IS NULL`
    );

    // Get approved count (by Melbourne user)
    const [approved] = await connection.execute(
      `SELECT COUNT(*) as count FROM images WHERE melbourne_user_id = ? AND status = 'approved'`,
      [userId]
    );

    // Get rejected count (by Melbourne user)
    const [rejected] = await connection.execute(
      `SELECT COUNT(*) as count FROM images WHERE melbourne_user_id = ? AND status = 'rejected'`,
      [userId]
    );

    // Progress over time
    const [progressOverTime] = await connection.execute(
      `SELECT DATE(updated_at) as date,
              SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
              SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
              SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected
       FROM images
       WHERE melbourne_user_id = ? OR status = 'approved'
       GROUP BY DATE(updated_at)
       ORDER BY date DESC
       LIMIT 30`,
      [userId]
    );

    await connection.release();

    res.json({
      pendingReview: pendingReview[0].count,
      approved: approved[0].count,
      rejected: rejected[0].count,
      progressOverTime,
    });
  } catch (err) {
    console.error("Melbourne dashboard error:", err);
    res.status(500).json({ error: "Failed to fetch Melbourne dashboard data" });
  }
});

// GET Melbourne User Datasets for Review
router.get("/melbourne/datasets", verifyToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const connection = await pool.getConnection();

    // Get all tester-approved datasets
    const [datasets] = await connection.execute(
      `SELECT 
        i.id,
        i.image_name,
        i.status,
        i.objects_count,
        i.created_at,
        i.updated_at,
        u_ann.name as annotator_name,
        u_test.name as tester_name,
        (SELECT t2.notes FROM tasks t2 WHERE t2.image_id = i.id AND t2.task_type = 'annotation' LIMIT 1) as annotator_notes,
        t.notes as tester_feedback,
        i.melbourne_user_feedback as melbourne_feedback,
        t.completed_date as tester_review_date
      FROM images i
      LEFT JOIN users u_ann ON i.annotator_id = u_ann.id
      LEFT JOIN users u_test ON i.tester_id = u_test.id
      LEFT JOIN tasks t ON i.id = t.image_id AND t.task_type = 'testing' AND t.status = 'approved'
      WHERE i.status = 'approved'
      ORDER BY i.updated_at DESC`
    );

    await connection.release();
    res.json(datasets);
  } catch (err) {
    console.error("Melbourne datasets error:", err);
    res.status(500).json({ error: "Failed to fetch datasets" });
  }
});

// PUT Melbourne User Review Dataset
router.put("/melbourne/datasets/:id/review", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, feedback } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    if (!status || !['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: "Valid status (approved/rejected) is required" });
    }

    const connection = await pool.getConnection();

    // Get image details
    const [imageResult] = await connection.execute(
      `SELECT image_name, annotator_id, tester_id, status FROM images WHERE id = ?`,
      [id]
    );

    if (imageResult.length === 0) {
      await connection.release();
      return res.status(404).json({ error: "Dataset not found" });
    }

    const imageName = imageResult[0].image_name || `Dataset #${id}`;
    const annotatorId = imageResult[0].annotator_id;
    const testerId = imageResult[0].tester_id;

    // Update image with Melbourne review
    await connection.execute(
      `UPDATE images SET 
        melbourne_user_id = ?,
        status = ?,
        updated_at = NOW()
       WHERE id = ?`,
      [userId, status, id]
    );

    // Store feedback if provided
    if (feedback) {
      await connection.execute(
        `UPDATE images SET melbourne_user_feedback = ? WHERE id = ?`,
        [feedback, id]
      );
    }

    // Create notifications
    const notificationType = status === 'approved' ? 'image_approved' : 'image_rejected';
    const [melbourneUserData] = await connection.execute(
      `SELECT name FROM users WHERE id = ?`,
      [userId]
    );
    const melbourneName = melbourneUserData[0]?.name || 'Melbourne User';

    await logImageHistory(connection, {
      imageId: id,
      eventType: status === "rejected" ? "rejected" : "approved",
      statusFrom: imageResult[0].status,
      statusTo: status,
      actorId: userId,
      actorName: melbourneName,
      details: JSON.stringify({
        reviewedBy: melbourneName,
        reviewLevel: "melbourne",
        rejectionReason: status === "rejected" ? (feedback || null) : null,
        testerComments: feedback || null,
      }),
    });

    const notificationMessage = status === 'approved' 
      ? `${melbourneName} approved "${imageName}" for production | ACTION: Dataset is ready for use` 
      : `${melbourneName} rejected "${imageName}" | ACTION: Review feedback in Dashboard`;

    // Notify annotator
    if (annotatorId) {
      await createNotification(
        connection,
        annotatorId,
        notificationType,
        notificationMessage,
        id
      );
    }

    // Notify tester
    if (testerId) {
      await createNotification(
        connection,
        testerId,
        notificationType,
        notificationMessage,
        id
      );
    }

    // Notify all admins
    const [admins] = await connection.execute(
      `SELECT id, name FROM users WHERE role IN ('admin', 'super_admin')`
    );
    for (const admin of admins) {
      await createNotification(
        connection,
        admin.id,
        notificationType,
        `${melbourneName} ${status} dataset: "${imageName}" | ACTION: Check Dashboard for final status`,
        id
      );
    }

    console.log(`Melbourne user ${userId} ${status} dataset ${id}`);
    await connection.release();
    res.json({ message: "Review submitted successfully" });
  } catch (err) {
    console.error("Melbourne review error:", err);
    res.status(500).json({ error: "Failed to submit review" });
  }
});

// GET Melbourne User Recent Reviews
router.get("/melbourne/recent-reviews", verifyToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const connection = await pool.getConnection();

    const [reviews] = await connection.execute(
      `SELECT 
        i.id,
        i.image_name,
        i.status,
        i.objects_count,
        i.melbourne_user_feedback as melbourne_feedback,
        i.updated_at,
        u_ann.name as annotator_name,
        u_test.name as tester_name,
        (SELECT t2.notes FROM tasks t2 WHERE t2.image_id = i.id AND t2.task_type = 'annotation' LIMIT 1) as annotator_notes,
        (SELECT t2.notes FROM tasks t2 WHERE t2.image_id = i.id AND t2.task_type = 'testing' LIMIT 1) as tester_feedback
      FROM images i
      LEFT JOIN users u_ann ON i.annotator_id = u_ann.id
      LEFT JOIN users u_test ON i.tester_id = u_test.id
      WHERE i.melbourne_user_id = ?
      ORDER BY i.updated_at DESC
      LIMIT 10`,
      [userId]
    );

    await connection.release();
    res.json(reviews);
  } catch (err) {
    console.error("Melbourne recent reviews error:", err);
    res.status(500).json({ error: "Failed to fetch recent reviews" });
  }
});

// ===================== NOTIFICATIONS ROUTES =====================

// Helper function to create notifications
const createNotification = async (connection, userId, type, message, imageId = null) => {
  try {
    await connection.execute(
      `INSERT INTO notifications (user_id, type, message, image_id, read_status, created_at)
       VALUES (?, ?, ?, ?, FALSE, NOW())`,
      [userId, type, message, imageId]
    );
  } catch (err) {
    console.error(`Failed to create notification for user ${userId}:`, err);
  }
};

// GET User Notifications
router.get("/notifications", verifyToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const connection = await pool.getConnection();

    const [notifications] = await connection.execute(
      `SELECT 
        id,
        type,
        message,
        image_id,
        read_status,
        created_at
      FROM notifications
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 50`,
      [userId]
    );

    // Get unread count
    const [unreadCount] = await connection.execute(
      `SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read_status = FALSE`,
      [userId]
    );

    await connection.release();

    res.json({
      notifications,
      unreadCount: unreadCount[0].count,
    });
  } catch (err) {
    console.error("Get notifications error:", err);
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

// PUT Mark notification as read
router.put("/notifications/:id/read", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const connection = await pool.getConnection();

    await connection.execute(
      `UPDATE notifications SET read_status = TRUE, updated_at = NOW() 
       WHERE id = ? AND user_id = ?`,
      [id, userId]
    );

    await connection.release();
    res.json({ message: "Notification marked as read" });
  } catch (err) {
    console.error("Mark notification read error:", err);
    res.status(500).json({ error: "Failed to mark notification" });
  }
});

// PUT Mark all notifications as read
router.put("/notifications/mark-all-read", verifyToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const connection = await pool.getConnection();

    await connection.execute(
      `UPDATE notifications SET read_status = TRUE, updated_at = NOW() 
       WHERE user_id = ? AND read_status = FALSE`,
      [userId]
    );

    await connection.release();
    res.json({ message: "All notifications marked as read" });
  } catch (err) {
    console.error("Mark all notifications read error:", err);
    res.status(500).json({ error: "Failed to mark notifications" });
  }
});

// GET Annotated Images and Hours by Date (PowerBI-style detailed report)
router.get("/detailed-annotations", verifyToken, async (req, res) => {
  try {
    const allowedRoles = ["admin", "super_admin", "melbourne_user"];
    if (!allowedRoles.includes(req.user?.role)) {
      return res.status(403).json({ error: "Not authorized" });
    }

    const { startDate, endDate, role } = req.query;

    let whereClause = "WHERE 1=1";
    const params = [];

    if (startDate) {
      whereClause += " AND DATE(t.updated_at) >= ?";
      params.push(startDate);
    }
    if (endDate) {
      whereClause += " AND DATE(t.updated_at) <= ?";
      params.push(endDate);
    }

    if (role && role !== "all" && ["annotator", "tester"].includes(role)) {
      whereClause += " AND u.role = ?";
      params.push(role);
    } else {
      whereClause += " AND u.role IN ('annotator', 'tester')";
    }

    const query = `
      SELECT 
        DATE(t.updated_at) as date,
        COUNT(DISTINCT CASE WHEN t.task_type = 'annotation' THEN t.image_id END) as annotated_images,
        ROUND(SUM(CASE WHEN t.task_type = 'annotation' THEN TIMESTAMPDIFF(MINUTE, t.assigned_date, COALESCE(t.completed_date, t.updated_at)) / 60 ELSE 0 END), 2) as annotation_hrs,
        ROUND(AVG(CASE WHEN t.task_type = 'annotation' THEN TIMESTAMPDIFF(MINUTE, t.assigned_date, COALESCE(t.completed_date, t.updated_at)) / 60 ELSE NULL END), 2) as avg_annotation_hrs_per_image,
        COUNT(DISTINCT CASE WHEN t.task_type = 'testing' THEN t.image_id END) as verified_images,
        ROUND(SUM(CASE WHEN t.task_type = 'testing' THEN TIMESTAMPDIFF(MINUTE, t.assigned_date, COALESCE(t.completed_date, t.updated_at)) / 60 ELSE 0 END), 2) as verification_hrs,
        ROUND(AVG(CASE WHEN t.task_type = 'testing' THEN TIMESTAMPDIFF(MINUTE, t.assigned_date, COALESCE(t.completed_date, t.updated_at)) / 60 ELSE NULL END), 2) as avg_verification_hrs_per_image,
        COUNT(DISTINCT CASE WHEN t.task_type = 'annotation' AND t.status = 'approved' THEN t.image_id END) as approved_annotations,
        ROUND(
          (COUNT(DISTINCT CASE WHEN t.task_type = 'annotation' AND t.status = 'approved' THEN t.image_id END) * 100.0) / 
          NULLIF(COUNT(DISTINCT CASE WHEN t.task_type = 'annotation' THEN t.image_id END), 0), 
          2
        ) as annotation_approval_rate
      FROM tasks t
      JOIN users u ON t.user_id = u.id
      ${whereClause}
      GROUP BY DATE(t.updated_at)
      ORDER BY date DESC
    `;

    const connection = await pool.getConnection();
    const [rows] = await connection.execute(query, params);
    await connection.release();

    res.json({
      data: rows,
      filters: { startDate, endDate, role },
    });
  } catch (err) {
    console.error("Detailed annotations error:", err);
    res.status(500).json({ error: "Failed to fetch annotation details" });
  }
});


// ==================== RATE MANAGEMENT APIs ====================

const assertSuperAdmin = (req, res) => {
  if (!isSuperAdmin(req)) {
    res.status(403).json({ error: "Not authorized" });
    return false;
  }
  return true;
};

const isValidPaymentType = (paymentType) => ["per_object", "per_hour"].includes(paymentType);

const getUserRateContext = async (connection, userId, paymentType) => {
  const [rows] = await connection.execute("SELECT id, role FROM users WHERE id = ? LIMIT 1", [userId]);
  if (!rows.length) return { error: "User not found" };

  const user = rows[0];
  const expectedPaymentType = ROLE_PAYMENT_TYPE[user.role];
  if (!expectedPaymentType) return { error: "Selected user role does not support custom rates" };
  if (expectedPaymentType !== paymentType) {
    return {
      error: `Invalid payment type for ${user.role}. Expected ${expectedPaymentType}`,
    };
  }

  return { user };
};

const upsertUserRateAndSync = async (connection, userId, paymentType, customRate) => {
  const { user, error } = await getUserRateContext(connection, userId, paymentType);
  if (error) return { error };

  await connection.execute(
    `INSERT INTO user_rates (user_id, payment_type, custom_rate)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE custom_rate = VALUES(custom_rate), updated_at = CURRENT_TIMESTAMP`,
    [userId, paymentType, customRate]
  );

  await syncLegacyRateColumn(connection, userId, user.role, customRate);
  return { user };
};

const deleteUserRateAndSync = async (connection, userId, paymentType) => {
  const { user, error } = await getUserRateContext(connection, userId, paymentType);
  if (error) return { error };

  await connection.execute("DELETE FROM user_rates WHERE user_id = ? AND payment_type = ?", [userId, paymentType]);
  await syncLegacyRateColumn(connection, userId, user.role, null);
  return { user };
};

router.get("/role-rates", verifyToken, async (req, res) => {
  if (!assertSuperAdmin(req, res)) return;

  try {
    const connection = await pool.getConnection();
    const [rates] = await connection.execute(
      `SELECT id, role_name, payment_type, default_rate, updated_at
       FROM role_rates
       ORDER BY FIELD(role_name, 'annotator', 'tester', 'admin'), payment_type`
    );
    await connection.release();
    res.json(rates);
  } catch (err) {
    console.error("Get role rates error:", err);
    res.status(500).json({ error: "Failed to fetch role rates" });
  }
});

router.put("/role-rates/:id", verifyToken, async (req, res) => {
  if (!assertSuperAdmin(req, res)) return;

  try {
    const { id } = req.params;
    const { default_rate } = req.body;
    const normalized = normalizeRateValue(default_rate);

    if (normalized === null) {
      return res.status(400).json({ error: "Valid default_rate is required" });
    }

    const connection = await pool.getConnection();
    const [result] = await connection.execute(
      "UPDATE role_rates SET default_rate = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [normalized, id]
    );
    await connection.release();

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Role rate not found" });
    }

    res.json({ message: "Role rate updated successfully" });
  } catch (err) {
    console.error("Update role rate error:", err);
    res.status(500).json({ error: "Failed to update role rate" });
  }
});

router.get("/user-rates", verifyToken, async (req, res) => {
  if (!assertSuperAdmin(req, res)) return;

  try {
    const connection = await pool.getConnection();
    const [rates] = await connection.execute(
      `SELECT 
         ur.id,
         ur.user_id,
         u.name,
         u.email,
         u.role,
         ur.payment_type,
         ur.custom_rate,
         ur.updated_at
       FROM user_rates ur
       JOIN users u ON ur.user_id = u.id
       WHERE u.role IN ('annotator', 'tester', 'admin')
       ORDER BY u.name, ur.payment_type`
    );
    await connection.release();
    res.json(rates);
  } catch (err) {
    console.error("Get user rates error:", err);
    res.status(500).json({ error: "Failed to fetch user rates" });
  }
});

router.post("/user-rates", verifyToken, async (req, res) => {
  if (!assertSuperAdmin(req, res)) return;

  try {
    const { user_id, payment_type, custom_rate } = req.body;
    const userId = Number(user_id);
    const normalized = normalizeRateValue(custom_rate);

    if (!userId || !isValidPaymentType(payment_type) || normalized === null) {
      return res.status(400).json({ error: "user_id, payment_type, and valid custom_rate are required" });
    }

    const connection = await pool.getConnection();
    const result = await upsertUserRateAndSync(connection, userId, payment_type, normalized);
    await connection.release();

    if (result.error) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ message: "User rate saved successfully" });
  } catch (err) {
    console.error("Add user rate error:", err);
    res.status(500).json({ error: "Failed to save user rate" });
  }
});

router.put("/user-rates/by-user/:userId/:paymentType", verifyToken, async (req, res) => {
  if (!assertSuperAdmin(req, res)) return;

  try {
    const userId = Number(req.params.userId);
    const paymentType = req.params.paymentType;
    const normalized = normalizeRateValue(req.body.custom_rate);

    if (!userId || !isValidPaymentType(paymentType) || normalized === null) {
      return res.status(400).json({ error: "Valid userId, paymentType, and custom_rate are required" });
    }

    const connection = await pool.getConnection();
    const result = await upsertUserRateAndSync(connection, userId, paymentType, normalized);
    await connection.release();

    if (result.error) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ message: "User rate updated successfully" });
  } catch (err) {
    console.error("Update user rate by user error:", err);
    res.status(500).json({ error: "Failed to update user rate" });
  }
});

router.put("/user-rates/:id", verifyToken, async (req, res) => {
  if (!assertSuperAdmin(req, res)) return;

  try {
    const { id } = req.params;
    const normalized = normalizeRateValue(req.body.custom_rate);
    if (normalized === null) {
      return res.status(400).json({ error: "Valid custom_rate is required" });
    }

    const connection = await pool.getConnection();
    const [rows] = await connection.execute(
      "SELECT user_id, payment_type FROM user_rates WHERE id = ? LIMIT 1",
      [id]
    );

    if (!rows.length) {
      await connection.release();
      return res.status(404).json({ error: "User rate not found" });
    }

    const row = rows[0];
    const result = await upsertUserRateAndSync(connection, Number(row.user_id), row.payment_type, normalized);
    await connection.release();

    if (result.error) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ message: "User rate updated successfully" });
  } catch (err) {
    console.error("Update user rate error:", err);
    res.status(500).json({ error: "Failed to update user rate" });
  }
});

router.delete("/user-rates/by-user/:userId/:paymentType", verifyToken, async (req, res) => {
  if (!assertSuperAdmin(req, res)) return;

  try {
    const userId = Number(req.params.userId);
    const paymentType = req.params.paymentType;

    if (!userId || !isValidPaymentType(paymentType)) {
      return res.status(400).json({ error: "Valid userId and paymentType are required" });
    }

    const connection = await pool.getConnection();
    const result = await deleteUserRateAndSync(connection, userId, paymentType);
    await connection.release();

    if (result.error) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ message: "User rate override deleted successfully" });
  } catch (err) {
    console.error("Delete user rate by user error:", err);
    res.status(500).json({ error: "Failed to delete user rate" });
  }
});

router.delete("/user-rates/:id", verifyToken, async (req, res) => {
  if (!assertSuperAdmin(req, res)) return;

  try {
    const { id } = req.params;
    const connection = await pool.getConnection();
    const [rows] = await connection.execute(
      "SELECT user_id, payment_type FROM user_rates WHERE id = ? LIMIT 1",
      [id]
    );

    if (!rows.length) {
      await connection.release();
      return res.status(404).json({ error: "User rate not found" });
    }

    const row = rows[0];
    const result = await deleteUserRateAndSync(connection, Number(row.user_id), row.payment_type);
    await connection.release();

    if (result.error) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ message: "User rate deleted successfully" });
  } catch (err) {
    console.error("Delete user rate error:", err);
    res.status(500).json({ error: "Failed to delete user rate" });
  }
});
module.exports = router;

