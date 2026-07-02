const XLSX = require("xlsx");
const ContactoMigrado = require("../models/contactoMigrado.model");
const {
  contactoMigradoToUi,
  mapExcelRowToContactoMigrado,
  normalizeClienteKey,
} = require("../utils/contactosMigradosHelpers");

async function listarAgrupadoPorEmpresa({ search = "", page = 1, limit = 12 } = {}) {
  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.min(200, Math.max(1, parseInt(limit, 10) || 12));
  const skip = (p - 1) * l;
  const term = String(search || "").trim();

  const match = {};
  if (term) {
    const rx = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    match.$or = [
      { cliente: rx },
      { nombre: rx },
      { apellido: rx },
      { cargo: rx },
      { celular: rx },
      { correo: rx },
      { telEmpresa: rx },
      { ciudad: rx },
      { departamento: rx },
      { segmentoMercado: rx },
    ];
  }

  const basePipeline = [
    ...(Object.keys(match).length ? [{ $match: match }] : []),
    {
      $group: {
        _id: "$clienteNorm",
        cliente: { $first: "$cliente" },
        empresaCiudad: { $first: "$ciudad" },
        contactosRaw: { $push: "$$ROOT" },
      },
    },
    { $sort: { cliente: 1 } },
  ];

  const [countResult, groups] = await Promise.all([
    ContactoMigrado.aggregate([...basePipeline, { $count: "total" }]),
    ContactoMigrado.aggregate([...basePipeline, { $skip: skip }, { $limit: l }]),
  ]);

  const total = countResult[0]?.total || 0;
  const items = groups.map((g) => ({
    clienteId: g._id,
    empresaNombre: g.cliente || "",
    empresaCiudad: g.empresaCiudad || "",
    empresaNit: "",
    empresaDireccion: "",
    contactos: (g.contactosRaw || []).map((row) => {
      const ui = contactoMigradoToUi(row);
      return {
        id: ui._id,
        nombre: ui.nombre,
        cargo: ui.cargo,
        telefono: ui.telefono,
        email: ui.correo,
        correo: ui.correo,
        ciudad: ui.ciudad,
        departamento: ui.departamento,
        fuente: "migrados",
        segmentoMercado: ui.segmentoMercado,
        actividadEconomica: ui.actividadEconomica,
        nivelInfluencia: ui.nivelInfluencia,
        importedAt: row.importedAt,
      };
    }),
  }));

  return { items, total, page: p, limit: l };
}

async function listarPorEmpresa(cliente) {
  const clienteNorm = normalizeClienteKey(cliente);
  if (!clienteNorm) {
    const err = new Error("Parámetro cliente requerido.");
    err.status = 400;
    throw err;
  }

  const rows = await ContactoMigrado.find({ clienteNorm })
    .sort({ nombre: 1, apellido: 1 })
    .limit(200)
    .lean();

  const contactos = rows.map(contactoMigradoToUi);
  return { contactos, total: contactos.length };
}

async function obtenerEstado() {
  const [total, empresas, last] = await Promise.all([
    ContactoMigrado.countDocuments(),
    ContactoMigrado.distinct("clienteNorm").then((arr) => arr.length),
    ContactoMigrado.findOne({}, { importedAt: 1, importBatchId: 1 })
      .sort({ importedAt: -1 })
      .lean(),
  ]);

  return {
    total,
    empresas,
    ultimaImportacion: last?.importedAt || null,
    ultimoLote: last?.importBatchId || null,
  };
}

async function importarDesdeExcel({ buffer, reemplazar = false }) {
  if (!buffer?.length) {
    const err = new Error("Archivo Excel requerido (campo archivo).");
    err.status = 400;
    throw err;
  }

  const wb = XLSX.read(buffer, { type: "buffer", cellDates: false });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) {
    const err = new Error("El archivo no contiene hojas.");
    err.status = 400;
    throw err;
  }

  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: "" });
  if (!rows.length) {
    const err = new Error("La hoja de Excel está vacía.");
    err.status = 400;
    throw err;
  }

  const importBatchId = `batch_${Date.now()}`;
  const importedAt = new Date();
  const docs = [];

  for (const row of rows) {
    const doc = mapExcelRowToContactoMigrado(row);
    if (!doc) continue;
    docs.push({ ...doc, importedAt, importBatchId });
  }

  if (!docs.length) {
    const err = new Error("No se encontraron filas válidas. Verifica la columna cliente.");
    err.status = 400;
    throw err;
  }

  if (reemplazar) {
    await ContactoMigrado.deleteMany({});
  }

  const result = await ContactoMigrado.insertMany(docs, { ordered: false });
  await ContactoMigrado.syncIndexes();

  return {
    ok: true,
    insertados: result.length,
    filasLeidas: rows.length,
    filasValidas: docs.length,
    reemplazar: Boolean(reemplazar),
    importBatchId,
    importedAt,
  };
}

module.exports = {
  listarPorEmpresa,
  listarAgrupadoPorEmpresa,
  obtenerEstado,
  importarDesdeExcel,
};
