const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const cors = require("cors");

const authRoutes = require("./routes/auth.routes.js");
const dashboardRoutes = require("./routes/dashboard.routes.js");

const app = express();



// Middleware
app.use(cors({
  origin: [
    "http://localhost:5173",
    "https://lemon-sand-00cd61800.6.azurestaticapps.net"
  ],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/dashboard", dashboardRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "OK" });
});

module.exports = app;
