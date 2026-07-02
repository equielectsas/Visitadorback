const mongoose = require("mongoose");

const contactoMigradoSchema = new mongoose.Schema(
  {
    cliente: { type: String, required: true, trim: true, index: true },
    clienteNorm: { type: String, required: true, trim: true, index: true },
    segmentoMercado: { type: String, trim: true, default: "" },
    actividadEconomica: { type: String, trim: true, default: "" },
    nombre: { type: String, trim: true, default: "" },
    apellido: { type: String, trim: true, default: "" },
    celular: { type: String, trim: true, default: "" },
    correo: { type: String, trim: true, default: "" },
    telEmpresa: { type: String, trim: true, default: "" },
    cargo: { type: String, trim: true, default: "" },
    nivelInfluencia: { type: String, trim: true, default: "" },
    direccion: { type: String, trim: true, default: "" },
    ciudad: { type: String, trim: true, default: "" },
    departamento: { type: String, trim: true, default: "" },
    importedAt: { type: Date, default: Date.now },
    importBatchId: { type: String, trim: true },
  },
  { collection: "contactosMigrados", timestamps: false }
);

contactoMigradoSchema.index({ clienteNorm: 1 });

module.exports = mongoose.model("ContactoMigrado", contactoMigradoSchema);
