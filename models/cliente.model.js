const mongoose = require("mongoose");
const crypto = require("crypto");

// ──────────────────────────────────────────
// SCHEMA PRINCIPAL
// ──────────────────────────────────────────
const clienteSchema = new mongoose.Schema(
  {
    // ── Identificación (OBLIGATORIO) ──
    identificacion: {
      type: String,
      required: [true, "La identificación es obligatoria"],
      trim: true,
      index: true,
    },

    tipoDocumento: {
      type: String,
      enum: ["NIT", "CC", "CE", "PASAPORTE", "OTRO"],
      default: "CC",
    },

    // ── Datos básicos ──
    razonSocial: { type: String, trim: true },

    nombrePunto: {
      type: String,
      trim: true,
      // nombre de la sede específica
    },

    ciudad: { type: String, trim: true, index: true },
    codigoCiudad: { type: Number },

    direccion: { type: String, trim: true },
    telefono: { type: String, trim: true },

    // ── Agrupación empresarial ──
    // Igual a identificacion, permite agrupar todas las sedes de una empresa
    grupoEmpresarial: {
      type: String,
      trim: true,
      index: true,
    },

    // ── Clave única por sede ──
    uniqueKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    // ── Origen del registro ──
    source: {
      type: String,
      enum: ["ERP", "MANUAL"],
      required: true,
      default: "MANUAL",
    },

    isProspect: {
      type: Boolean,
      default: false,
    },

    // ── Datos crudos del ERP (para auditoría y referencia) ──
    erpData: {
      sucursal: Number,
      tipodocumento: String,
      naturaleza: String,
      tipoCliente: String,
      fechaContacto: Date,
      formaPago: String,
      codigoCiudad: Number,
      barrio: Number,
      Valores: [
        {
          codigoValor: String,
          valor: mongoose.Schema.Types.Mixed,
        },
      ],
      HistoricoValores: [
        {
          codigoValor: String,
          fecha: Date,
          valor: Number,
          usuario: String,
        },
      ],
      Telefonos: [mongoose.Schema.Types.Mixed],
      Direcciones: [mongoose.Schema.Types.Mixed],
      Actividad: [mongoose.Schema.Types.Mixed],
      Estados: [mongoose.Schema.Types.Mixed],
    },

    // ── Datos personalizados (NUNCA sobrescribir desde ERP) ──
    customData: {
      notas: { type: String, default: "" },
      vendedorAsignado: { type: String },
      etiquetas: [{ type: String }],
      prioridad: {
        type: String,
        enum: ["ALTA", "MEDIA", "BAJA"],
        default: "MEDIA",
      },
      ultimaVisita: { type: Date },
      totalVisitas: { type: Number, default: 0 },
      extras: { type: mongoose.Schema.Types.Mixed, default: {} },
    },

    // ── Contactos asociados al cliente (para futuras visitas) ──
    contactos: [
      {
        nombre: { type: String, trim: true, required: true },
        cargo: { type: String, trim: true },
        telefono: { type: String, trim: true },
        email: { type: String, trim: true },
        notas: { type: String, trim: true },
        isActive: { type: Boolean, default: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],

    // ── Metadata de sincronización ──
    lastSyncAt: { type: Date },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    collection: "clientes",
  }
);

// ──────────────────────────────────────────
// ÍNDICES COMPUESTOS
// ──────────────────────────────────────────
clienteSchema.index({ identificacion: 1, source: 1 });
clienteSchema.index({ grupoEmpresarial: 1, isActive: 1 });
clienteSchema.index({ ciudad: 1, isActive: 1 });
clienteSchema.index({ razonSocial: "text", nombrePunto: "text", ciudad: "text" });

// ──────────────────────────────────────────
// MÉTODOS ESTÁTICOS: generación de uniqueKey
// ──────────────────────────────────────────

/**
 * Genera uniqueKey para registros del ERP
 * Formato: ERP_{identificacion}_{sucursal}
 */
clienteSchema.statics.generarKeyERP = function (identificacion, sucursal) {
  const id = String(identificacion).trim().toUpperCase();
  const suc = String(sucursal).trim();
  return `ERP_${id}_${suc}`;
};

/**
 * Genera uniqueKey para clientes manuales
 * Formato: MAN_{hash(identificacion+nombre+ciudad)}
 */
clienteSchema.statics.generarKeyManual = function (identificacion, razonSocial = "", ciudad = "") {
  const raw = `${identificacion}_${razonSocial}_${ciudad}`.toLowerCase().trim();
  const hash = crypto.createHash("md5").update(raw).digest("hex").slice(0, 10);
  return `MAN_${String(identificacion).trim().toUpperCase()}_${hash}`;
};

// ──────────────────────────────────────────
// VIRTUAL: nombre display
// ──────────────────────────────────────────
clienteSchema.virtual("nombreDisplay").get(function () {
  if (this.nombrePunto) return `${this.razonSocial || ""} – ${this.nombrePunto}`;
  return this.razonSocial || `Cliente ${this.identificacion}`;
});

const Cliente = mongoose.model("Cliente", clienteSchema);

module.exports = Cliente;