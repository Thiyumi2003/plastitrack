require("dotenv").config();
const app = require("./app.js");

const PORT = process.env.PORT || 5000;

console.log("SERVER STARTUP: Loading init...");

// Import and call init
const init = require("./db/init.js");

console.log("SERVER STARTUP: Init loaded, setting up listener...");

// The init file calls initDatabase() directly, so we just need to start the server
const server = app.listen(PORT, () => {
  console.log(`✓ Server listening on port ${PORT}`);
});

console.log("SERVER STARTUP: Listener created, server should be running...");

// Keep the process alive
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled rejection at:", promise, "reason:", reason);
});
