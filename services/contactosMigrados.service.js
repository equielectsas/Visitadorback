const XLSX = require("xlsx");
const ContactoMigrado = require("../models/contactoMigrado.model");
const {
  contactoMigradoToUi,
  mapExcelRowToContactoMigrado,
  normalizeClienteKey,
} = require("../utils/contactosMigradosHelpers");

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
  obtenerEstado,
  importarDesdeExcel,
};
