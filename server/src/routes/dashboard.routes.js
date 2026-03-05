
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

    let query = "SELECT id, name, email, role, is_active, hourly_rate, annotator_rate, tester_rate, created_at FROM users WHERE role != 'super_admin'";
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
      params.push(hourly_rate);
    }

    if (annotator_rate !== undefined && role === "annotator") {
      query += ", annotator_rate = ?";
      params.push(annotator_rate);
    }

    if (tester_rate !== undefined && role === "tester") {
      query += ", tester_rate = ?";
      params.push(tester_rate);
    }

    query += " WHERE id = ?";
    params.push(id);

    await connection.execute(query, params);
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
        u4.name as melbourne_user,
        i.status,
        i.created_at,
        i.updated_at,
        i.objects_count,
        (SELECT t2.notes FROM tasks t2 WHERE t2.image_id = i.id AND t2.task_type = 'annotation' LIMIT 1) as annotator_notes,
        (SELECT t2.notes FROM tasks t2 WHERE t2.image_id = i.id AND t2.task_type = 'testing' LIMIT 1) as tester_feedback,
        i.feedback as melbourne_feedback
      FROM images i
      LEFT JOIN users u1 ON i.assigned_to = u1.id
      LEFT JOIN users u2 ON i.annotator_id = u2.id
      LEFT JOIN users u3 ON i.tester_id = u3.id
      LEFT JOIN users u4 ON i.melbourne_user_id = u4.id
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
        totalImageSets: Number(summary.totalImageSets || 0),
        totalAssigned: Number(summary.totalAssigned || 0),
        completedAnnotations: Number(summary.completedAnnotations || 0),
        pendingAnnotations: Number(summary.pendingAnnotations || 0),
        rejectedAnnotations: Number(summary.rejectedAnnotations || 0),
        approvalRate: Number(approvalRate.toFixed(2)),
      },
      pie: [
        { name: "Completed", value: Number(summary.completedAnnotations || 0) },
        { name: "Pending", value: Number(summary.pendingAnnotations || 0) },
      ],
      performance: performanceRows.map((row) => ({
        id: row.id,
        name: row.name,
        assigned: Number(row.assigned || 0),
        completed: Number(row.completed || 0),
      })),
    });
  } catch (err) {
    console.error("Annotation summary error:", err);
    res.status(500).json({ error: "Failed to fetch annotation summary" });
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

    const [taskRows] = await connection.execute(
      `SELECT 
        u.id,
        u.name,
        COUNT(t.id) as total_assigned,
        SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN t.status IN ('pending','in_progress','pending_review') THEN 1 ELSE 0 END) as pending,
        AVG(TIMESTAMPDIFF(MINUTE, t.assigned_date, COALESCE(t.completed_date, t.updated_at))) as avg_completion_minutes
       FROM users u
       LEFT JOIN tasks t ON u.id = t.user_id AND t.task_type = 'annotation'
       ${taskWhere}
       GROUP BY u.id, u.name
       ORDER BY completed DESC, total_assigned DESC`,
      taskParams
    );

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

    const [approvalRows] = await connection.execute(
      `SELECT 
        i.annotator_id as annotator_id,
        SUM(CASE WHEN i.status = 'approved' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN i.status = 'rejected' THEN 1 ELSE 0 END) as rejected
       FROM images i
       ${imageWhere}
       GROUP BY i.annotator_id`,
      imageParams
    );

    await connection.release();

    const approvalMap = new Map();
    approvalRows.forEach((row) => {
      approvalMap.set(row.annotator_id, {
        approved: Number(row.approved || 0),
        rejected: Number(row.rejected || 0),
      });
    });

    const rows = taskRows.map((row) => {
      const approval = approvalMap.get(row.id) || { approved: 0, rejected: 0 };
      const totalReviewed = approval.approved + approval.rejected;
      const accuracyRate = totalReviewed > 0 ? (approval.approved / totalReviewed) * 100 : 0;
      const avgMinutes = Number(row.avg_completion_minutes || 0);
      const safeAvgMinutes = Number.isFinite(avgMinutes) ? avgMinutes : 0;
      return {
        id: row.id,
        name: row.name,
        totalAssigned: Number(row.total_assigned || 0),
        completed: Number(row.completed || 0),
        pending: Number(row.pending || 0),
        approved: approval.approved,
        rejected: approval.rejected,
        accuracyRate: Number(accuracyRate.toFixed(2)),
        avgCompletionMinutes: Number(safeAvgMinutes.toFixed(2)),
      };
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

    let whereClause = "WHERE t.task_type = 'testing'";
    const params = [];
    if (startDate) {
      whereClause += " AND t.assigned_date >= ?";
      params.push(startDate);
    }
    if (endDate) {
      whereClause += " AND t.assigned_date <= ?";
      params.push(endDate);
    }

    const [rows] = await connection.execute(
      `SELECT 
        COUNT(*) as totalReviewed,
        SUM(CASE WHEN t.status = 'approved' THEN 1 ELSE 0 END) as approvedCount,
        SUM(CASE WHEN t.status = 'rejected' THEN 1 ELSE 0 END) as rejectedCount,
        AVG(TIMESTAMPDIFF(MINUTE, t.assigned_date, COALESCE(t.completed_date, t.updated_at))) as avgReviewMinutes
       FROM tasks t
       ${whereClause}
       AND t.status IN ('approved','rejected')`,
      params
    );

    let joinClause = "LEFT JOIN tasks t ON u.id = t.user_id AND t.task_type = 'testing'";
    const testerParams = [];
    if (startDate) {
      joinClause += " AND t.assigned_date >= ?";
      testerParams.push(startDate);
    }
    if (endDate) {
      joinClause += " AND t.assigned_date <= ?";
      testerParams.push(endDate);
    }

    const [testerRows] = await connection.execute(
      `SELECT 
        u.id,
        u.name,
        COUNT(t.id) as assignedCount,
        SUM(CASE WHEN t.status = 'approved' THEN 1 ELSE 0 END) as approvedCount,
        SUM(CASE WHEN t.status = 'rejected' THEN 1 ELSE 0 END) as rejectedCount,
        AVG(CASE WHEN t.status IN ('approved', 'rejected') 
            THEN TIMESTAMPDIFF(MINUTE, t.assigned_date, COALESCE(t.completed_date, t.updated_at)) 
            ELSE NULL END) as avgReviewMinutes
       FROM users u
       ${joinClause}
       WHERE u.role = 'tester'
       GROUP BY u.id, u.name
       ORDER BY assignedCount DESC, approvedCount DESC`,
      testerParams
    );

    await connection.release();

    const summary = rows[0] || {};
    const approved = Number(summary.approvedCount || 0);
    const rejected = Number(summary.rejectedCount || 0);
    const totalReviewed = Number(summary.totalReviewed || 0);
    const rejectionRate = approved + rejected > 0 ? (rejected / (approved + rejected)) * 100 : 0;
    const avgMinutes = Number(summary.avgReviewMinutes || 0);
    const safeAvgMinutes = Number.isFinite(avgMinutes) ? avgMinutes : 0;

    res.json({
      filters: { startDate: startDate || null, endDate: endDate || null },
      summary: {
        totalReviewed,
        approvedCount: approved,
        rejectedCount: rejected,
        avgReviewMinutes: Number(safeAvgMinutes.toFixed(2)),
        rejectionRate: Number(rejectionRate.toFixed(2)),
      },
      testers: testerRows.map((row) => {
        const approved = Number(row.approvedCount || 0);
        const rejected = Number(row.rejectedCount || 0);
        const completed = approved + rejected;
        const accuracyRate = completed > 0 ? (approved / completed) * 100 : 0;
        const avgMinutes = Number(row.avgReviewMinutes || 0);
        const safeAvgMinutes = Number.isFinite(avgMinutes) ? avgMinutes : 0;
        
        return {
          id: row.id,
          name: row.name,
          assignedCount: Number(row.assignedCount || 0),
          approvedCount: approved,
          rejectedCount: rejected,
          accuracyRate: Number(accuracyRate.toFixed(2)),
          avgReviewMinutes: Number(safeAvgMinutes.toFixed(2)),
        };
      }),
    });
  } catch (err) {
    console.error("Tester review error:", err);
    res.status(500).json({ error: "Failed to fetch tester review report" });
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
      SELECT DATE(uploaded_at) as date, COUNT(*) as total
      FROM images
      WHERE uploaded_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
      GROUP BY DATE(uploaded_at)
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
        COUNT(*) as total_images,
        SUM(CASE WHEN status IN ('approved', 'rejected') THEN 1 ELSE 0 END) as finalized_images,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_images,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected_images
       FROM images
       WHERE model_type IS NOT NULL AND model_type <> ''
       GROUP BY model_type
       ORDER BY model_type`
    );

    await connection.release();

    const models = rows.map((row) => {
      const totalImages = Number(row.total_images || 0);
      const finalizedImages = Number(row.finalized_images || 0);
      const approvedImages = Number(row.approved_images || 0);
      const rejectedImages = Number(row.rejected_images || 0);
      return {
        modelType: row.model_type,
        totalImages,
        finalizedImages,
        approvedImages,
        rejectedImages,
        isComplete: totalImages > 0 && finalizedImages === totalImages,
      };
    });

    res.json({ models });
  } catch (err) {
    console.error("Eligible models error:", err);
    res.status(500).json({ error: "Failed to fetch eligible models" });
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
        COUNT(i.id) as approved_images
       FROM images i
       INNER JOIN users u ON i.annotator_id = u.id
       WHERE i.model_type = ? AND i.status = 'approved'
       GROUP BY u.id, u.name, u.email, u.role
       ORDER BY approved_images DESC`,
      [modelType]
    );

    const [testers] = await connection.execute(
      `SELECT 
        u.id,
        u.name,
        u.email,
        u.role,
        COUNT(i.id) as approved_images
       FROM images i
       INNER JOIN users u ON i.tester_id = u.id
       WHERE i.model_type = ? AND i.status = 'approved'
       GROUP BY u.id, u.name, u.email, u.role
       ORDER BY approved_images DESC`,
      [modelType]
    );

    await connection.release();

    res.json({
      modelType,
      modelSummary,
      annotators,
      testers,
    });
  } catch (err) {
    console.error("Eligible users error:", err);
    res.status(500).json({ error: "Failed to fetch eligible users" });
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
        p.user_id,
        u.name as admin_name,
        u.role as user_role,
        p.amount,
        p.model_type,
        p.images_completed,
        p.status,
        p.payment_method,
        p.payment_date,
        p.created_at,
        approver.name as approved_by
      FROM payments p
      LEFT JOIN users u ON p.user_id = u.id
      LEFT JOIN users approver ON p.approved_by = approver.id
      ORDER BY p.created_at DESC
      LIMIT 100
    `);

    // For each payment, get annotator and tester details
    const paymentsWithDetails = await Promise.all(
      paymentHistory.map(async (payment) => {
        // Get annotators who worked on this user's images (for admin payments)
        const [annotators] = await connection.execute(`
          SELECT DISTINCT
            a.id,
            a.name as annotator_name,
            COUNT(DISTINCT i.id) as images_annotated,
            SUM(CASE WHEN i.status = 'approved' THEN 1 ELSE 0 END) as images_approved
          FROM images i
          INNER JOIN users a ON i.annotator_id = a.id
          WHERE i.assigned_to = ? OR (? IN (SELECT id FROM users WHERE role IN ('admin', 'melbourne_user')))
          GROUP BY a.id, a.name
        `, [payment.user_id, payment.user_id]);

        // Get testers who reviewed images
        const [testers] = await connection.execute(`
          SELECT DISTINCT
            t.id,
            t.name as tester_name,
            COUNT(DISTINCT i.id) as images_reviewed,
            SUM(CASE WHEN i.status = 'approved' THEN 1 ELSE 0 END) as images_approved,
            SUM(CASE WHEN i.status = 'rejected' THEN 1 ELSE 0 END) as images_rejected
          FROM images i
          INNER JOIN users t ON i.tester_id = t.id
          WHERE i.assigned_to = ? OR (? IN (SELECT id FROM users WHERE role IN ('admin', 'melbourne_user')))
          GROUP BY t.id, t.name
        `, [payment.user_id, payment.user_id]);

        // Get admin's own work if they're an annotator
        const [adminWork] = await connection.execute(`
          SELECT 
            COUNT(DISTINCT i.id) as images_annotated,
            SUM(CASE WHEN i.status = 'approved' THEN 1 ELSE 0 END) as images_approved,
            SUM(CASE WHEN i.status = 'completed' THEN 1 ELSE 0 END) as images_completed
          FROM images i
          WHERE i.annotator_id = ?
        `, [payment.user_id]);

        return {
          ...payment,
          annotators: annotators,
          testers: testers,
          adminWork: adminWork[0] || { images_annotated: 0, images_approved: 0, images_completed: 0 }
        };
      })
    );

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
      history: paymentsWithDetails,
      cumulativeSummary: cumulativeSummary[0],
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
        a.annotator_rate,
        t.id as tester_id,
        t.name as tester_name,
        t.tester_rate
       FROM images i
       LEFT JOIN users a ON i.annotator_id = a.id
       LEFT JOIN users t ON i.tester_id = t.id
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
// Note: Payments should only be created for tasks where eligible_for_payment = TRUE
// This ensures fairness: if work is rejected and reassigned, only the successful annotator gets paid
router.post("/payments", verifyToken, async (req, res) => {
  try {
    if (!isSuperAdmin(req)) {
      return res.status(403).json({ error: "Not authorized" });
    }

    const { user_id, amount, model_type, payment_method, status } = req.body;

    if (!user_id || !amount) {
      return res.status(400).json({ error: "user_id and amount are required" });
    }

    const connection = await pool.getConnection();

    const [users] = await connection.execute(
      "SELECT role FROM users WHERE id = ?",
      [user_id]
    );

    if (users.length === 0) {
      await connection.release();
      return res.status(404).json({ error: "User not found" });
    }

    const userRole = users[0].role;
    let imagesCompleted = 0;
    let modelType = model_type || null;

    if (["annotator", "tester"].includes(userRole)) {
      if (!modelType) {
        await connection.release();
        return res.status(400).json({ error: "model_type is required for annotator/tester payments" });
      }

      const modelSummary = await getModelSummary(connection, modelType);
      if (!modelSummary.isComplete) {
        await connection.release();
        return res.status(400).json({
          error: "Model is not completed for payment",
          modelSummary,
        });
      }

      imagesCompleted = await getApprovedImageCount(connection, modelType, userRole, user_id);
      if (imagesCompleted === 0) {
        await connection.release();
        return res.status(400).json({ error: "No approved image sets for this user/model" });
      }
    }

    const allowedStatuses = ["pending", "approved", "paid", "rejected"];
    const paymentStatus = allowedStatuses.includes(status) ? status : "pending";
    const approvedDate = paymentStatus === "approved" ? new Date() : null;
    const paymentDate = paymentStatus === "paid" ? new Date() : null;
    const approvedBy = paymentStatus === "approved" ? req.user.id : null;

    await connection.execute(
      `INSERT INTO payments (user_id, amount, model_type, images_completed, payment_method, status, payment_date, approved_date, approved_by) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user_id,
        amount,
        modelType,
        imagesCompleted,
        payment_method || "bank",
        paymentStatus,
        paymentDate,
        approvedDate,
        approvedBy,
      ]
    );

    await connection.release();

    res.status(201).json({
      message: "Payment added successfully",
      imagesCompleted,
      status: paymentStatus,
    });
  } catch (err) {
    console.error("Add payment error:", err);
    res.status(500).json({ error: "Failed to add payment" });
  }
});

// ===== ADMIN WORK HOURS TRACKING =====

// POST Log admin work hours
router.post("/admin/work-hours", verifyToken, async (req, res) => {
  try {
    const adminId = req.user?.id;
    const { date, hours_worked, task_description } = req.body;

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

    if (!date || !hours_worked) {
      await connection.release();
      return res.status(400).json({ error: "Date and hours worked are required" });
    }

    if (hours_worked < 0 || hours_worked > 24) {
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
        [hours_worked, task_description || null, existing[0].id]
      );
    } else {
      // Insert new manual entry
      await connection.execute(
        "INSERT INTO work_hours (admin_id, date, hours_worked, task_description, is_auto_tracked) VALUES (?, ?, ?, ?, FALSE)",
        [adminId, date, hours_worked, task_description || null]
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
        u.hourly_rate,
        wh.date,
        wh.hours_worked,
        wh.task_description,
        wh.status,
        wh.created_at,
        approver.name as approved_by_name,
        (wh.hours_worked * u.hourly_rate) as calculated_payment
      FROM work_hours wh
      JOIN users u ON wh.admin_id = u.id
      LEFT JOIN users approver ON wh.approved_by = approver.id
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
        u.hourly_rate,
        COALESCE(SUM(wh.hours_worked), 0) as total_hours,
        COALESCE(SUM(CASE WHEN wh.status = 'approved' THEN wh.hours_worked ELSE 0 END), 0) as approved_hours,
        COALESCE(SUM(CASE WHEN wh.status = 'approved' THEN wh.hours_worked * u.hourly_rate ELSE 0 END), 0) as total_payment_due
      FROM users u
      LEFT JOIN work_hours wh ON u.id = wh.admin_id
      WHERE u.role = 'admin'
      GROUP BY u.id, u.name, u.email, u.hourly_rate
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

// ===== END ADMIN WORK HOURS TRACKING =====
// PUT Update payment status
router.put("/payments/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, payment_date, approved_date } = req.body;

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
    if (status) {
      if (status === "approved" && currentStatus !== "pending") {
        await connection.release();
        return res.status(400).json({ error: "Only pending payments can be approved" });
      }
      if (status === "paid" && currentStatus !== "approved") {
        await connection.release();
        return res.status(400).json({ error: "Only approved payments can be paid" });
      }
      if (status === "rejected" && currentStatus !== "pending") {
        await connection.release();
        return res.status(400).json({ error: "Only pending payments can be rejected" });
      }
    }

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
      // Also store who approved it
      updates.push("approved_by = ?");
      values.push(req.user.id);
    } else if (status === "approved") {
      updates.push("approved_date = ?");
      values.push(new Date());
      updates.push("approved_by = ?");
      values.push(req.user.id);
    }

    if (status === "paid" && !payment_date) {
      updates.push("payment_date = ?");
      values.push(new Date());
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

    const connection = await pool.getConnection();

    await connection.execute(
      "INSERT INTO images (image_name, status, assigned_to, objects_count, uploaded_at) VALUES (?, ?, ?, ?, NOW())",
      [filename, "pending", adminId, objectCount]
    );

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
        i.assigned_to,
        i.annotator_id,
        i.tester_id,
        i.melbourne_user_id,
        u_admin.name as admin_name,
        u_ann.name as annotator_name,
        u_test.name as tester_name,
        u_mel.name as melbourne_name,
        (SELECT t2.notes FROM tasks t2 WHERE t2.image_id = i.id AND t2.task_type = 'annotation' LIMIT 1) as annotator_notes,
        (SELECT t2.notes FROM tasks t2 WHERE t2.image_id = i.id AND t2.task_type = 'testing' LIMIT 1) as tester_feedback,
        i.feedback as melbourne_feedback
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

    // Check if image exists
    const [imageRows] = await connection.execute("SELECT status, annotator_id, image_name FROM images WHERE id = ?", [id]);
    if (imageRows.length === 0) {
      await connection.release();
      return res.status(404).json({ error: "Image not found" });
    }
    const currentImage = imageRows[0];

    // Define isRejectedReassignment before it is used
    const isRejectedReassignment = currentImage.status === 'rejected' && annotatorId;

    let query = "UPDATE images SET ";
    let params = [];
    let fields = [];

    if (annotatorId) {
      fields.push("annotator_id = ?");
      params.push(annotatorId);
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
        const imageName = currentImage.image_name || `Image #${id}`;
        const [adminData] = await connection.execute(
          `SELECT name FROM users WHERE id = ?`,
          [adminId]
        );
        const adminName = adminData[0]?.name || 'Admin';

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
          `🎯 ${adminName} assigned "​${imageName}" to you for annotation | ACTION: Open Dashboard → Click image → Start annotating`,
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
          const imageName = currentImage.image_name || `Image #${id}`;
          const [adminData] = await connection.execute(
            `SELECT name FROM users WHERE id = ?`,
            [adminId]
          );
          const adminName = adminData[0]?.name || 'Admin';

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
            `🔍 ${adminName} assigned "​${imageName}" to you for review/testing | ACTION: Open Dashboard → Click image → Approve or Reject`,
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
        t.notes as annotator_notes,
        i.feedback as melbourne_feedback,
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
      `SELECT image_id FROM tasks WHERE id = ? AND user_id = ?`,
      [id, userId]
    );

    if (taskResult.length === 0) {
      await connection.release();
      return res.status(404).json({ error: "Task not found" });
    }

    const imageId = taskResult[0].image_id;

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
        t.notes,
        i.feedback,
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
      `SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE user_id = ? AND status = 'pending'`,
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
        i.feedback as melbourne_feedback,
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

    // Also update the corresponding image status and feedback
    await connection.execute(
      `UPDATE images SET status = ?, feedback = ?, updated_at = NOW() WHERE id = ?`,
      [status, feedback || null, imageId]
    );

    // Create notifications
    const notificationType = status === 'approved' ? 'image_approved' : 'image_rejected';
    const [testerData] = await connection.execute(
      `SELECT name FROM users WHERE id = ?`,
      [userId]
    );
    const testerName = testerData[0]?.name || 'Tester';

    const notificationMessage = status === 'approved' 
      ? `✅ ${testerName} approved "​${imageName}" | ACTION: Check your Dashboard for next steps` 
      : `❌ ${testerName} rejected "​${imageName}" | ACTION: Review feedback and resubmit if needed`;

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
        `📋 ${testerName} ${status} image: "​${imageName}" | Assigned by: ${admin.name} | ACTION: Check Dashboard for details`,
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
        t.notes as tester_notes,
        (SELECT t2.notes FROM tasks t2 WHERE t2.image_id = i.id AND t2.task_type = 'annotation' LIMIT 1) as annotator_notes,
        i.feedback as melbourne_feedback,
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
        (SELECT t2.notes FROM tasks t2 WHERE t2.image_id = i.id AND t2.task_type = 'annotation' LIMIT 1) as annotator_notes,
        t.notes as tester_feedback,
        i.feedback as melbourne_feedback,
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
    const [melbourneUserData] = await connection.execute(
      `SELECT name FROM users WHERE id = ?`,
      [userId]
    );
    const melbourneName = melbourneUserData[0]?.name || 'Melbourne User';

    const notificationMessage = status === 'approved' 
      ? `✅ ${melbourneName} approved "​${imageName}" for production | ACTION: Dataset is ready for use` 
      : `❌ ${melbourneName} rejected "​${imageName}" | ACTION: Review feedback in Dashboard`;

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
        `📊 ${melbourneName} ${status} dataset: "​${imageName}" | ACTION: Check Dashboard for final status`,
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
        i.feedback as melbourne_feedback,
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

module.exports = router;
