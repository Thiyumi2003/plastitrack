const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host: "plastitrack-mysql.mysql.database.azure.com",
  user: "adminuser",
  password: "Thi&u20037191",
  database: "plastitrack_db",
  port: 3306,
  ssl: {
    rejectUnauthorized: false
  }
});

module.exports = pool;