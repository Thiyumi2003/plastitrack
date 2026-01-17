const express = require("express");
const router = express.Router();

// Auth routes
router.post("/register", (req, res) => {
  res.json({ message: "Register endpoint" });
});

router.post("/login", (req, res) => {
  res.json({ message: "Login endpoint" });
});

router.post("/logout", (req, res) => {
  res.json({ message: "Logout endpoint" });
});

module.exports = router;
