const sql = require("mssql");
require("dotenv").config();

const config = {
  user: "RNDAdmin",
  password: "0f8$4rfT1",
  server: "132.148.105.23",
  database: "RND_HR",
  port: parseInt(process.env.DB_PORT),
  options: {
    encrypt: true,
    trustServerCertificate: true,
  },
};
// const config = {
//   user: process.env.DB_USER,
//   password: process.env.DB_PASSWORD,
//   server: process.env.DB_SERVER,
//   database: process.env.DB_DATABASE,
//   port: parseInt(process.env.DB_PORT, 10),
//   options: {
//     encrypt: false,
//     trustServerCertificate: true,
//   },
// };
let pool;

console.log("db con", config);

async function initializePool() {
  try {
    if (!pool) {
      pool = await sql.connect(config);
      console.log("Database connection pool created.");
    }
  } catch (err) {
    console.error("Error initializing the connection pool:", err);
    throw err;
  }
}

async function executeQuery(query) {
  try {
    await initializePool(); // Ensure the pool is initialized
    const result = await pool.request().query(query);
    console.log(query);
    return result.recordset;
  } catch (err) {
    console.error("Error executing query:", err);
    throw err;
  }
}

// Optionally expose a method to close the pool
async function closePool() {
  if (pool) {
    await pool.close();
    pool = null;
    console.log("Database connection pool closed.");
  }
}

module.exports = {
  executeQuery,
  closePool,
};
