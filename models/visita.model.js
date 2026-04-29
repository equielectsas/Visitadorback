const mongoose = require("mongoose");

const tareaSchema = new mongoose.Schema(
  {
    texto: { type: String, trim: true, required: true },
    done: { type: Boolean, default: false },
  },
  { _id: false }
);

const geoSchema = new mongoose.Schema(
  {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    accuracy: { type: Number },
  },
  { _id: false }
);

const visitaSchema = new mongoose.Schema(
  {
    // Quién hace la visita (desde JWT)
    asesor: {
      cedula: { type: Number, index: true },
      nombre: { type: String, trim: true },
      rol: { type: String, trim: true, index: true },
    },

    // Cliente seleccionado / creado
    clienteId: { type: mongoose.Schema.Types.ObjectId, ref: "Cliente", required: true, index: true },

    // Estado y programación
    estado: {
      type: String,
      enum: ["pendiente", "activa", "realizada", "reprogramada", "perdida"],
      default: "pendiente",
      index: true,
    },
    fecha: { type: String, trim: true, index: true }, // yyyy-mm-dd (UI)
    hora: { type: String, trim: true }, // HH:mm (UI)
    scheduledAt: { type: Date, index: true },

    startedAt: { type: Date },
    finishedAt: { type: Date },

    // Snapshot + formulario del front
    datosVisita: {
      nit: { type: String, trim: true },
      nombreEmpresa: { type: String, trim: true },
      direccionEmpresa: { type: String, trim: true },
      municipio: { type: String, trim: true },
      tipoVisita: { type: String, trim: true },
      tipoVehiculo: { type: String, trim: true },
      nombreEncargado: { type: String, trim: true },
      cargoEncargado: { type: String, trim: true },
      observaciones: { type: String, trim: true },
      geoCoords: { type: geoSchema },
      tareasPendientes: { type: [tareaSchema], default: [] },
    },

    motivoReprogramacion: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    collection: "visitas",
  }
);

visitaSchema.index({ clienteId: 1, createdAt: -1 });
visitaSchema.index({ "asesor.cedula": 1, createdAt: -1 });

module.exports = mongoose.model("Visita", visitaSchema);

