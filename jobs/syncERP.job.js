const cron = require("node-cron");
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));
const jwt = require("jsonwebtoken");
const { config } = require("../config/config");
const safix = require("../models/safix.model");
const clienteService = require("../services/cliente.service");

// ──────────────────────────────────────────────────────────────────────────────
// CRON DE SINCRONIZACIÓN ERP
// Se ejecuta automáticamente según el schedule configurado.
// Por defecto: cada día a las 2:00 AM
// ──────────────────────────────────────────────────────────────────────────────

async function obtenerTokenERP() {
  const safixDoc = await safix.findOne({}, {}, { sort: { createdAt: -1 } });
  if (!safixDoc?.token) throw new Error("No hay token Safix almacenado");
  const decoded = jwt.verify(safixDoc.token, config.jwtSecret);
  return `Bearer ${decoded.token}`;
}

async function ejecutarSync() {
  console.log(`\n🕐 [CRON] Iniciando sync ERP - ${new Date().toISOString()}`);

  try {
    const Authorization = await obtenerTokenERP();

    const LIMIT = 200;
    let offset = 0;
    let totalProcesados = 0;
    const resumenGlobal = { creados: 0, actualizados: 0, convertidos: 0, errores: [] };

    while (true) {
      const response = await fetch(`${process.env.DB_SFX}ObtenerCliente`, {
        method: "GET",
        headers: {
          Authorization,
          P_LIMIT: String(LIMIT),
          P_OFFSET: String(offset),
        },
      });

      if (!response.ok) {
        console.error(`[CRON] ❌ ERP error ${response.status}`);
        break;
      }

      const data = await response.json();
      const lista = Array.isArray(data) ? data : data.clientes ?? data.data ?? [];

      if (lista.length === 0) break;

      const resultado = await clienteService.sincronizarDesdeERP(lista);

      resumenGlobal.creados += resultado.creados;
      resumenGlobal.actualizados += resultado.actualizados;
      resumenGlobal.convertidos += resultado.convertidos;
      resumenGlobal.errores.push(...resultado.errores);

      totalProcesados += lista.length;

      if (lista.length < LIMIT) break;
      offset += LIMIT;
    }

    console.log(`✅ [CRON] Sync completo: procesados=${totalProcesados}`, resumenGlobal);
  } catch (err) {
    console.error("[CRON] ❌ Error en sync:", err.message);
  }
}

/**
 * Inicia el cron de sincronización.
 * Schedule por defecto: todos los días a las 2:00 AM
 * Puedes cambiarlo con la variable de entorno SYNC_CRON_SCHEDULE
 */
function iniciarCronSync() {
  const schedule = process.env.SYNC_CRON_SCHEDULE || "0 2 * * *";

  if (!cron.validate(schedule)) {
    console.warn(`⚠️  SYNC_CRON_SCHEDULE inválido: "${schedule}". Usando "0 2 * * *"`);
  }

  cron.schedule(schedule, ejecutarSync, {
    timezone: "America/Bogota",
  });

  console.log(`⏰ Cron de sincronización ERP iniciado (${schedule})`);
}

module.exports = { iniciarCronSync, ejecutarSync };