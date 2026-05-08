const mongoose = require("mongoose");

const notificacionSchema = new mongoose.Schema(
  {
    recipientCedula: { type: Number, index: true },
    recipientScope: {
      type: String,
      enum: ["asesor", "admin"],
      required: true,
      index: true,
    },
    type: { type: String, default: "sistema" },
    title: { type: String, required: true, trim: true },
    body: { type: String, default: "" },
    read: { type: Boolean, default: false },
    /** Para no duplicar recordatorios de la misma visita */
    dedupeKey: { type: String, sparse: true, index: true },
  },
  { timestamps: true, collection: "notificaciones" }
);

module.exports = mongoose.model("Notificacion", notificacionSchema);
