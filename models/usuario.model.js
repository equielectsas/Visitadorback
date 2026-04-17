const mongoose = require("mongoose");

const usuarioSchema = new mongoose.Schema(
  {
    cedula: { type: Number, required: true, unique: true },
    nombre: { type: String },
    password: { type: String },
    rol: { type: String },
  },
  {
    collection: "usuario",
  }
);

module.exports = mongoose.model("Usuario", usuarioSchema);