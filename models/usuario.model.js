const mongoose = require("mongoose");

const usuarioSchema = new mongoose.Schema(
  {
    cedula: { type: Number, required: true, unique: true },
    nombre: { type: String },
    password: { type: String },
    rol: { type: String },
    /** Cuando el asesor confirmó "Lo haré!" (para no preguntar en cada login). */
    pendingTasksAckAt: { type: Date, default: null },
  },
  {
    collection: "usuario",
  }
);

module.exports = mongoose.model("Usuario", usuarioSchema);