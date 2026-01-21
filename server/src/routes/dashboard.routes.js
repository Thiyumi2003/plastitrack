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

    // Progress over time (last 30 days)
    const [progressData] = await connection.execute(`
      SELECT 
        DATE(uploaded_at) as date,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected
      FROM images
      GROUP BY DATE(uploaded_at)
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

// POST Add image by name only (no file upload)
router.post("/admin/images/add", verifyToken, async (req, res) => {
  try {
    const { filename, fileSizeMB } = req.body;
    const adminId = req.user?.id;

    if (!filename) {
      return res.status(400).json({ error: "Filename is required" });
    }

    if (!adminId) {
      return res.status(401).json({ error: "Admin not authenticated" });
    }

    const sizeBytes = Math.max(0, Number(fileSizeMB) || 0) * 1024 * 1024;

    const connection = await pool.getConnection();

    await connection.execute(
      "INSERT INTO images (image_name, file_size, status, assigned_to, uploaded_at) VALUES (?, ?, ?, ?, NOW())",
      [filename, sizeBytes, "pending", adminId]
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
      `SELECT 
        i.id,
        i.image_name,
        i.status,
        i.objects_count,
        i.uploaded_at,
        i.created_at,
        i.file_size,
        i.assigned_to,
        i.annotator_id,
        i.tester_id,
        i.melbourne_user_id,
        u_admin.name as admin_name,
        u_ann.name as annotator_name,
        u_test.name as tester_name,
        u_mel.name as melbourne_name
       FROM images i
       LEFT JOIN users u_admin ON i.assigned_to = u_admin.id
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
    const adminId = req.user?.id;

    if (!adminId) {
      return res.status(401).json({ error: "Admin user not authenticated" });
    }

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
    console.log(`Image ${id} updated with fields:`, fields);

    // Create task if assigning to annotator
    if (annotatorId) {
      try {
        const taskId = `TASK_${Date.now()}_${Math.random().toString(36).substring(7)}`;

        // Get image name for notification
        const [imageData] = await connection.execute(
          `SELECT image_name FROM images WHERE id = ?`,
          [id]
        );
        const imageName = imageData[0]?.image_name || `Image #${id}`;

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
          `New image set assigned: ${imageName}`,
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
          `SELECT id FROM tasks WHERE image_id = ? AND user_id = ? AND task_type = 'testing' LIMIT 1`,
          [id, testerId]
        );

        if (existingTesterTask.length === 0) {
          // Get image name for notification
          const [imageData] = await connection.execute(
            `SELECT image_name FROM images WHERE id = ?`,
            [id]
          );
          const imageName = imageData[0]?.image_name || `Image #${id}`;

          await connection.execute(
            `INSERT INTO tasks (task_id, image_id, user_id, assigned_by, task_type, status, assigned_date)
             VALUES (?, ?, ?, ?, 'testing', 'pending_review', NOW())`,
            [taskId, id, testerId, adminId]
          );
          
          // Create notification for tester
          await createNotification(
            connection,
            testerId,
            'image_assigned_tester',
            `New image set for review: ${imageName}`,
            id
          );
          
          console.log(`Task created: ${taskId} for tester ${testerId}`);
        }
      } catch (taskErr) {
        console.error("Failed to create tester task:", taskErr);
      }
    }

    await connection.release();
    res.json({ message: "Image assigned successfully" });
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
        t.notes,
        t.assigned_date
      FROM tasks t
      LEFT JOIN images i ON t.image_id = i.id
      LEFT JOIN users u ON t.assigned_by = u.id
      WHERE t.user_id = ?
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
      `SELECT image_id FROM tasks WHERE id = ? AND user_id = ?`,
      [id, userId]
    );

    if (taskResult.length === 0) {
      await connection.release();
      return res.status(404).json({ error: "Task not found" });
    }

    const imageId = taskResult[0].image_id;

    // Update task status
    await connection.execute(
      `UPDATE tasks SET status = ?, notes = ?, updated_at = NOW() WHERE id = ? AND user_id = ?`,
      [status, notes || null, id, userId]
    );

    // Also update the corresponding image status
    await connection.execute(
      `UPDATE images SET status = ?, updated_at = NOW() WHERE id = ?`,
      [status, imageId]
    );

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
        t.assigned_date,
        t.completed_date
      FROM tasks t
      LEFT JOIN images i ON t.image_id = i.id
      WHERE t.user_id = ?
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
      `SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE user_id = ? AND status = 'pending'`,
      [userId]
    );

    const [tasksCompleted] = await connection.execute(
      `SELECT COUNT(*) as count FROM tasks WHERE user_id = ? AND status = 'completed'`,
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
        t.notes,
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
      `SELECT t.image_id, t.task_type, i.image_name, i.annotator_id
       FROM tasks t
       LEFT JOIN images i ON t.image_id = i.id
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
    console.log(`Tester ${userId} reviewing task ${id} with status ${status}`);

    // Update task status and set completed_date
    await connection.execute(
      `UPDATE tasks SET status = ?, notes = ?, updated_at = NOW(), completed_date = NOW() 
       WHERE id = ? AND user_id = ?`,
      [status, feedback || null, id, userId]
    );

    // Also update the corresponding image status
    await connection.execute(
      `UPDATE images SET status = ?, updated_at = NOW() WHERE id = ?`,
      [status, imageId]
    );

    // Create notifications
    const notificationType = status === 'approved' ? 'image_approved' : 'image_rejected';
    const notificationMessage = status === 'approved' 
      ? `Image "${imageName}" approved by tester` 
      : `Image "${imageName}" rejected by tester`;

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
      `SELECT id FROM users WHERE role = 'admin'`
    );
    for (const admin of admins) {
      await createNotification(
        connection,
        admin.id,
        notificationType,
        `Tester ${status} image: "${imageName}"`,
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
      `SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE user_id = ? AND status = 'pending'`,
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
        t.notes,
        u.name as assigned_by_name
      FROM tasks t
      LEFT JOIN images i ON t.image_id = i.id
      LEFT JOIN users u ON t.assigned_by = u.id
      WHERE t.user_id = ? AND (t.task_type = 'testing' OR t.task_type IS NULL)
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
        i.uploaded_at,
        i.updated_at,
        u_ann.name as annotator_name,
        u_test.name as tester_name,
        t.notes as tester_feedback,
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
      `SELECT image_name, annotator_id, tester_id FROM images WHERE id = ?`,
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
        `UPDATE images SET feedback = ? WHERE id = ?`,
        [feedback, id]
      );
    }

    // Create notifications
    const notificationType = status === 'approved' ? 'image_approved' : 'image_rejected';
    const notificationMessage = status === 'approved' 
      ? `Dataset "${imageName}" approved by Melbourne user for production` 
      : `Dataset "${imageName}" rejected by Melbourne user`;

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
      `SELECT id FROM users WHERE role IN ('admin', 'super_admin')`
    );
    for (const admin of admins) {
      await createNotification(
        connection,
        admin.id,
        notificationType,
        `Melbourne user ${status} dataset: "${imageName}"`,
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
        i.feedback,
        i.updated_at,
        u_ann.name as annotator_name,
        u_test.name as tester_name
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

module.exports = router;
