const mongoose = require("mongoose");
const { config } = require("../config/config");
const safix = require("../models/safix.model"); // 👈 AGREGA ESTO

const connect = async () => {
  try {
    await mongoose.connect(config.dbCnx);
    console.log("✅ Conectado a MongoDB");

    // 🔥 LIMPIAR TOKENS VIEJOS (SOLO UNA VEZ)
    await safix.deleteMany({});
    console.log("🧹 safix limpiado");

  } catch (error) {
    console.error("❌ Error conectando a MongoDB:", error.message);
    process.exit(1);
  }
};

module.exports = { connect };