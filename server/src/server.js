require("dotenv").config();
const app = require("./app.js");

const PORT = process.env.PORT || 5000;

// Import init for DB bootstrap side effects.
require("./db/init.js");

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Keep the process alive
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled rejection at:", promise, "reason:", reason);
});
