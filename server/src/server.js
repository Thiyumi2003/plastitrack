require("dotenv").config();
const app = require("./app.js");

const PORT = process.env.PORT || 5000;

// Initialize database on startup
console.log("Initializing database...");
require("./db/init.js");

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
