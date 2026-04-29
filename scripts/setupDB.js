/**
 * SCRIPT DE SETUP - MongoDB Atlas
 * Ejecutar UNA vez: node scripts/setupDB.js
 *
 * Crea la colección "clientes" con todos los índices necesarios.
 */

require("dotenv").config();
const mongoose = require("mongoose");
const { config } = require("../config/config");
const Cliente = require("../models/cliente.model");

async function setup() {
  try {
    await mongoose.connect(config.dbCnx);
    console.log("✅ Conectado a MongoDB Atlas");

    // Sincronizar índices del schema (Mongoose crea los definidos en el modelo)
    await Cliente.syncIndexes();
    console.log("✅ Índices sincronizados");

    // Listar índices creados
    const indices = await Cliente.collection.indexes();
    console.log("\n📋 Índices en colección 'clientes':");
    indices.forEach((idx) => {
      console.log(`  - ${idx.name}:`, JSON.stringify(idx.key));
    });

    // Insertar documento de ejemplo para verificar
    try {
      await Cliente.create({
        identificacion: "000000000",
        razonSocial: "SETUP TEST (borrar)",
        ciudad: "MEDELLIN",
        grupoEmpresarial: "000000000",
        uniqueKey: "SETUP_TEST_001",
        source: "MANUAL",
        isProspect: false,
      });

      await Cliente.deleteOne({ uniqueKey: "SETUP_TEST_001" });
      console.log("✅ Escritura y borrado de prueba OK");
    } catch (e) {
      console.warn("⚠️  Prueba de escritura:", e.message);
    }

    console.log("\n🎉 Setup completado. La colección 'clientes' está lista.");
  } catch (err) {
    console.error("❌ Error en setup:", err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

setup();