require("dotenv").config();

let db;

switch (process.env.NODE_ENV) {
  case "test":
    db = process.env.DB_CNX_TEST;
    break;
  case "dev":
    db = process.env.DB_CNX_DEV;
    break;
  default:
    db = process.env.DB_CNX;
}

const config = {
  env: process.env.NODE_ENV || "dev",
  jwtSecret: process.env.JWT_SECRET,
  dbCnx: db,
};

module.exports = { config };