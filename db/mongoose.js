const mongoose = require("mongoose");
const { config } = require("../config/config");

const connect = async () => {
  try {
    await mongoose.connect(config.dbCnx);
    console.log("✅ Conectado a MongoDB");
  } catch (error) {
    console.error("❌ Error conectando a MongoDB:", error.message);
    process.exit(1);
  }
};

module.exports = { connect };