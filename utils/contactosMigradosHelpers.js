const mongoose = require("mongoose");

const CONTACTO_MIGRADO_PREFIX = "migrado:";

function normalizeClienteKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function nombreCompletoContactoMigrado(row) {
  const nombre = String(row?.nombre || "").trim();
  const apellido = String(row?.apellido || "").trim();
  return [nombre, apellido].filter(Boolean).join(" ").trim();
}

function contactoMigradoToUi(row) {
  const id = row?._id != null ? String(row._id) : "";
  const nombre = nombreCompletoContactoMigrado(row);
  return {
    _id: id ? `${CONTACTO_MIGRADO_PREFIX}${id}` : "",
    nombre,
    cargo: String(row?.cargo || "").trim(),
    telefono: String(row?.celular || row?.telEmpresa || "").trim(),
    correo: String(row?.correo || "").trim(),
    fuente: "migrados",
    segmentoMercado: row?.segmentoMercado || "",
    actividadEconomica: row?.actividadEconomica || "",
    nivelInfluencia: row?.nivelInfluencia || "",
    direccion: row?.direccion || "",
    ciudad: row?.ciudad || "",
    departamento: row?.departamento || "",
    cliente: row?.cliente || "",
  };
}

function normHeader(h) {
  return String(h || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

const HEADER_MAP = {
  id: "_id",
  _id: "_id",
  cliente: "cliente",
  segmentomercado: "segmentoMercado",
  actividadeconomica: "actividadEconomica",
  nombre: "nombre",
  apellido: "apellido",
  celular: "celular",
  correo: "correo",
  telempresa: "telEmpresa",
  telefonodeempresa: "telEmpresa",
  cargo: "cargo",
  nivelinfluencia: "nivelInfluencia",
  direccion: "direccion",
  ciudad: "ciudad",
  departamento: "departamento",
};

function cellToString(v) {
  if (v == null) return "";
  if (typeof v === "number" && Number.isFinite(v)) {
    if (Number.isInteger(v) && Math.abs(v) > 1e9) return String(Math.trunc(v));
    return String(v);
  }
  return String(v).trim();
}

function mapExcelRowToContactoMigrado(rawRow) {
  const mapped = {};
  for (const [key, value] of Object.entries(rawRow || {})) {
    const field = HEADER_MAP[normHeader(key)];
    if (!field) continue;
    mapped[field] = cellToString(value);
  }

  if (!mapped.cliente) return null;

  const doc = {
    cliente: mapped.cliente,
    clienteNorm: normalizeClienteKey(mapped.cliente),
    segmentoMercado: mapped.segmentoMercado || "",
    actividadEconomica: mapped.actividadEconomica || "",
    nombre: mapped.nombre || "",
    apellido: mapped.apellido || "",
    celular: mapped.celular || "",
    correo: mapped.correo || "",
    telEmpresa: mapped.telEmpresa || "",
    cargo: mapped.cargo || "",
    nivelInfluencia: mapped.nivelInfluencia || "",
    direccion: mapped.direccion || "",
    ciudad: mapped.ciudad || "",
    departamento: mapped.departamento || "",
  };

  if (mapped._id) {
    try {
      doc._id = new mongoose.Types.ObjectId(mapped._id);
    } catch {
      // MongoDB generará _id si el del Excel no es válido.
    }
  }

  return doc;
}

module.exports = {
  CONTACTO_MIGRADO_PREFIX,
  normalizeClienteKey,
  nombreCompletoContactoMigrado,
  contactoMigradoToUi,
  mapExcelRowToContactoMigrado,
};
