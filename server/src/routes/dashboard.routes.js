const express = require("express");
const pool = require("../db/pool");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const router = express.Router();

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "../../uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}_${Math.random().toString(36).substring(7)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|bmp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }
  // Token verification would go here - for now we trust the frontend passed valid token
  next();
};

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
      "SELECT id, name, email, role, created_at FROM users WHERE role = 'admin'"
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

    let query = "SELECT id, name, email, role, created_at FROM users WHERE role != 'super_admin'";
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

// GET Reports/Analytics
router.get("/reports", verifyToken, async (req, res) => {
  try {
    const connection = await pool.getConnection();

    // Progress over time (last 7 days)
    const [progressData] = await connection.execute(`
      SELECT 
        DATE(created_at) as date,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending
      FROM images
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      GROUP BY DATE(created_at)
      ORDER BY date
    `);

    // User contributions
    const [userContributions] = await connection.execute(`
      SELECT 
        u.name,
        u.email,
        COUNT(i.id) as images_count,
        SUM(CASE WHEN i.status = 'completed' THEN 1 ELSE 0 END) as completed_count
      FROM users u
      LEFT JOIN images i ON u.id = i.annotator_id
      WHERE u.role IN ('annotator', 'tester')
      GROUP BY u.id
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
        i.status,
        i.created_at,
        i.updated_at,
        i.objects_count
      FROM images i
      LEFT JOIN users u1 ON i.assigned_to = u1.id
      LEFT JOIN users u2 ON i.annotator_id = u2.id
      LEFT JOIN users u3 ON i.tester_id = u3.id
      ORDER BY i.created_at DESC
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

// GET Payments overview
router.get("/payments", verifyToken, async (req, res) => {
  try {
    const connection = await pool.getConnection();

    // Total paid this month
    const [totalPaidMonth] = await connection.execute(`
      SELECT COALESCE(SUM(amount), 0) as total FROM payments 
      WHERE status = 'paid' 
      AND MONTH(payment_date) = MONTH(NOW()) 
      AND YEAR(payment_date) = YEAR(NOW())
    `);

    // Models ready for payment
    const [modelsReadyForPayment] = await connection.execute(`
      SELECT COUNT(DISTINCT model_type) as count FROM payments 
      WHERE status = 'approved'
    `);

    // Pending admin payment
    const [pendingAdminPayment] = await connection.execute(`
      SELECT COALESCE(SUM(amount), 0) as total FROM payments 
      WHERE status = 'pending'
    `);

    // Withdrawal methods
    const [withdrawalMethods] = await connection.execute(`
      SELECT 
        payment_method,
        COUNT(*) as count,
        SUM(amount) as total
      FROM payments
      WHERE status = 'paid'
      GROUP BY payment_method
    `);

    await connection.release();

    res.json({
      totalPaidThisMonth: totalPaidMonth[0].total,
      modelsReadyForPayment: modelsReadyForPayment[0].count,
      pendingAdminPayment: pendingAdminPayment[0].total,
      withdrawalMethods: withdrawalMethods,
    });
  } catch (err) {
    console.error("Payments error:", err);
    res.status(500).json({ error: "Failed to fetch payments" });
  }
});

// GET Payment history
router.get("/payment-history", verifyToken, async (req, res) => {
  try {
    const connection = await pool.getConnection();

    const [paymentHistory] = await connection.execute(`
      SELECT 
        p.id,
        u.name as admin_name,
        p.amount,
        p.model_type,
        p.images_completed,
        p.status,
        p.payment_method,
        p.payment_date,
        p.created_at
      FROM payments p
      LEFT JOIN users u ON p.user_id = u.id
      ORDER BY p.created_at DESC
      LIMIT 100
    `);

    // Cumulative payment summary
    const [cumulativeSummary] = await connection.execute(`
      SELECT 
        SUM(amount) as total_amount,
        COUNT(*) as total_transactions
      FROM payments
      WHERE status = 'paid'
    `);

    await connection.release();

    res.json({
      history: paymentHistory,
      cumulativeSummary: cumulativeSummary[0],
    });
  } catch (err) {
    console.error("Payment history error:", err);
    res.status(500).json({ error: "Failed to fetch payment history" });
  }
});

// GET Model-based payments
router.get("/model-payments", verifyToken, async (req, res) => {
  try {
    const connection = await pool.getConnection();

    const [modelPayments] = await connection.execute(`
      SELECT 
        model_type,
        SUM(CASE WHEN status = 'ready' THEN amount ELSE 0 END) as ready_for_payment,
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

// POST Add payment
router.post("/payments", verifyToken, async (req, res) => {
  try {
    const { user_id, amount, model_type, images_completed, payment_method, status } = req.body;

    if (!user_id || !amount || !model_type) {
      return res.status(400).json({ error: "Required fields missing" });
    }

    const connection = await pool.getConnection();

    await connection.execute(
      `INSERT INTO payments (user_id, amount, model_type, images_completed, payment_method, status) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [user_id, amount, model_type, images_completed || 0, payment_method || "bank", status || "pending"]
    );

    await connection.release();

    res.status(201).json({ message: "Payment added successfully" });
  } catch (err) {
    console.error("Add payment error:", err);
    res.status(500).json({ error: "Failed to add payment" });
  }
});

// PUT Update payment status
router.put("/payments/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, payment_date, approved_date } = req.body;

    const connection = await pool.getConnection();

    const updates = [];
    const values = [];

    if (status) {
      updates.push("status = ?");
      values.push(status);
    }
    if (payment_date && status === "paid") {
      updates.push("payment_date = ?");
      values.push(payment_date);
    }
    if (approved_date && status === "approved") {
      updates.push("approved_date = ?");
      values.push(approved_date);
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
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: "All fields required" });
    }

    const connection = await pool.getConnection();

    const bcrypt = require("bcryptjs");
    const hashedPassword = await bcrypt.hash(password, 10);

    await connection.execute(
      "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)",
      [name, email, hashedPassword, "admin"]
    );

    await connection.release();

    res.status(201).json({ message: "Admin added successfully" });
  } catch (err) {
    console.error("Add admin error:", err);
    res.status(500).json({ error: "Failed to add admin" });
  }
});

// POST Upload image (Admin)
router.post("/admin/images/upload", verifyToken, upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image file provided" });
    }

    const connection = await pool.getConnection();

    const filename = req.file.originalname;
    const filepath = req.file.path;
    const fileSize = req.file.size;

    await connection.execute(
      "INSERT INTO images (image_name, filepath, file_size, status, uploaded_at) VALUES (?, ?, ?, ?, NOW())",
      [filename, filepath, fileSize, "pending"]
    );

    await connection.release();

    res.status(201).json({ message: "Image uploaded successfully" });
  } catch (err) {
    console.error("Upload image error:", err);
    res.status(500).json({ error: "Failed to upload image" });
  }
});

// POST Add image by name only (no file upload)
router.post("/admin/images/add", verifyToken, async (req, res) => {
  try {
    const { filename, fileSizeMB } = req.body;

    if (!filename) {
      return res.status(400).json({ error: "Filename is required" });
    }

    const sizeBytes = Math.max(0, Number(fileSizeMB) || 0) * 1024 * 1024;

    const connection = await pool.getConnection();

    await connection.execute(
      "INSERT INTO images (image_name, file_size, status, uploaded_at) VALUES (?, ?, ?, NOW())",
      [filename, sizeBytes, "pending"]
    );

    await connection.release();

    res.status(201).json({ message: "Image added successfully" });
  } catch (err) {
    console.error("Add image error:", err);
    res.status(500).json({ error: "Failed to add image" });
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
      `SELECT DATE(uploaded_at) as date,
              SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
              SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
              SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
              SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
              SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected
       FROM images
       GROUP BY DATE(uploaded_at)
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
      `SELECT i.*, 
              u_ann.name as annotator_name,
              u_test.name as tester_name,
              u_mel.name as melbourne_name
       FROM images i
       LEFT JOIN users u_ann ON i.annotator_id = u_ann.id
       LEFT JOIN users u_test ON i.tester_id = u_test.id
       LEFT JOIN users u_mel ON i.melbourne_user_id = u_mel.id
       ORDER BY i.uploaded_at DESC`
    );

    await connection.release();

    res.json(images);
  } catch (err) {
    console.error("Get images error:", err);
    res.status(500).json({ error: "Failed to load images" });
  }
});

// GET Admin Filtered Users (annotators and testers only)
router.get("/admin/users-filtered", verifyToken, async (req, res) => {
  try {
    const connection = await pool.getConnection();

    const [annotators] = await connection.execute(
      "SELECT id, name, email, role, created_at FROM users WHERE role = 'annotator' ORDER BY name"
    );

    const [testers] = await connection.execute(
      "SELECT id, name, email, role, created_at FROM users WHERE role = 'tester' ORDER BY name"
    );

    const [melbourneUsers] = await connection.execute(
      "SELECT id, name, email, role, created_at FROM users WHERE role = 'melbourne_user' ORDER BY name"
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
    const { annotatorId, testerId, melbourneUserId, status, feedback } = req.body;

    const connection = await pool.getConnection();

    let query = "UPDATE images SET ";
    let params = [];
    let fields = [];

    if (annotatorId) {
      fields.push("annotator_id = ?");
      params.push(annotatorId);
    }
    if (testerId) {
      fields.push("tester_id = ?");
      params.push(testerId);
    }
    if (melbourneUserId) {
      fields.push("melbourne_user_id = ?");
      params.push(melbourneUserId);
    }
    if (status) {
      fields.push("status = ?");
      params.push(status);
    }
    if (feedback) {
      fields.push("feedback = ?");
      params.push(feedback);
    }

    if (fields.length === 0) {
      await connection.release();
      return res.status(400).json({ error: "No fields to update" });
    }

    query += fields.join(", ") + " WHERE id = ?";
    params.push(id);

    await connection.execute(query, params);
    await connection.release();

    res.json({ message: "Image updated successfully" });
  } catch (err) {
    console.error("Assign image error:", err);
    res.status(500).json({ error: "Failed to assign image" });
  }
});

// GET Admin Payments
router.get("/admin/payments", verifyToken, async (req, res) => {
  try {
    const connection = await pool.getConnection();

    // Get total earned and hours for this admin
    const [payments] = await connection.execute(
      `SELECT 
              SUM(amount) as totalEarned,
              SUM(hours) as totalHours,
              AVG(amount/hours) as perHourRate
       FROM payments
       WHERE user_id = (SELECT id FROM users WHERE email = ? LIMIT 1)`,
      ["tharuka@gmail.com"] // In real app, get from token
    );

    // Get payment history
    const [history] = await connection.execute(
      `SELECT date, description, type, amount, hours 
       FROM payments
       WHERE user_id = (SELECT id FROM users WHERE email = ? LIMIT 1)
       ORDER BY date DESC
       LIMIT 20`,
      ["tharuka@gmail.com"]
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

module.exports = router;
