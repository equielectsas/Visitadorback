const mongoose = require("mongoose");

const taskUrgencyAlertSchema = new mongoose.Schema(
  {
    visitaId: { type: mongoose.Schema.Types.ObjectId, ref: "Visita", required: true, index: true },
    asesorCedula: { type: Number, required: true, index: true },
    empresa: { type: String, trim: true, default: "" },
    source: { type: String, enum: ["admin"], default: "admin" },
    acknowledgedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "task_urgency_alerts" }
);

taskUrgencyAlertSchema.index({ asesorCedula: 1, acknowledgedAt: 1, createdAt: -1 });

module.exports = mongoose.model("TaskUrgencyAlert", taskUrgencyAlertSchema);
