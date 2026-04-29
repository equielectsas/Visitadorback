const express = require("express");
const router = express.Router();
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const authSafixHandler = require("../middlewares/authSafix.handler");
const tokenHandler = require("../middlewares/token.handler");
const clienteService = require("../services/cliente.service");
const Cliente = require("../models/cliente.model");

// ──────────────────────────────────────────────────────────────────────────────
// ESTADO EN MEMORIA DE LA SINCRONIZACIÓN (1 proceso Node)
// ──────────────────────────────────────────────────────────────────────────────
const syncState = {
  running: false,
  startedAt: null,
  finishedAt: null,
  processed: 0,
  lastError: null,
  summary: null, // { creados, actualizados, convertidos, errores[] }
};

// ══════════════════════════════════════════════════════════════════
// GET /api/clientes
// Lista clientes desde MongoDB local con filtros y paginación
// ══════════════════════════════════════════════════════════════════
router.get("/", tokenHandler(), async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = "",
      source,
      isProspect,
      ciudad,
      grupoEmpresarial,
    } = req.query;

    const resultado = await clienteService.listar({
      page: parseInt(page),
      limit: parseInt(limit),
      search,
      source,
      isProspect: isProspect !== undefined ? isProspect === "true" : undefined,
      ciudad,
      grupoEmpresarial,
    });

    return res.json(resultado);
  } catch (error) {
    console.error("❌ Error listando clientes:", error.message);
    return res.status(500).json({ message: "Error al listar clientes" });
  }
});

// ══════════════════════════════════════════════════════════════════
// GET /api/clientes/sync/status
// Estado de sincronización + stats para dashboard
// ══════════════════════════════════════════════════════════════════
router.get("/sync/status", tokenHandler(), async (req, res) => {
  try {
    const stats = await clienteService.stats();
    return res.json({
      ...stats,
      running: syncState.running,
      startedAt: syncState.startedAt,
      finishedAt: syncState.finishedAt,
      processed: syncState.processed,
      lastError: syncState.lastError,
      summary: syncState.summary,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

// ══════════════════════════════════════════════════════════════════
// GET /api/clientes/:id
// Obtiene un cliente por su ID de MongoDB
// ══════════════════════════════════════════════════════════════════
router.get("/:id", tokenHandler(), async (req, res) => {
  try {
    const cliente = await clienteService.obtenerPorId(req.params.id);
    if (!cliente) return res.status(404).json({ message: "Cliente no encontrado" });
    return res.json(cliente);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

// ══════════════════════════════════════════════════════════════════
// GET /api/clientes/grupo/:grupoEmpresarial
// Obtiene todas las sedes de un grupo empresarial
// ══════════════════════════════════════════════════════════════════
router.get("/grupo/:grupoEmpresarial", tokenHandler(), async (req, res) => {
  try {
    const sedes = await clienteService.sedesPorGrupo(req.params.grupoEmpresarial);
    return res.json({ sedes, total: sedes.length });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

// ══════════════════════════════════════════════════════════════════
// POST /api/clientes
// Crea un cliente manual (prospecto)
// Body: { identificacion, razonSocial, ciudad, direccion, telefono,
//         tipoDocumento, nombrePunto, customData }
// ══════════════════════════════════════════════════════════════════
router.post("/", tokenHandler(), async (req, res) => {
  try {
    const { identificacion } = req.body;

    if (!identificacion) {
      return res.status(400).json({ message: "La identificación es obligatoria" });
    }

    // 1️⃣ Verificar si ya existe en ERP local → advertir
    const sedesERP = await clienteService.verificarEnERPLocal(identificacion);
    if (sedesERP.length > 0) {
      return res.status(409).json({
        message: "Este cliente ya existe en el ERP",
        code: "EXISTS_IN_ERP",
        sedesExistentes: sedesERP,
        accion: "Puedes seleccionar una sede existente o vincular tu prospecto",
      });
    }

    // 2️⃣ Intentar crear (detecta duplicados locales)
    const nuevo = await clienteService.crearClienteManual(req.body);
    return res.status(201).json(nuevo);
  } catch (error) {
    if (error.code === "DUPLICATE_LOCAL") {
      return res.status(409).json({
        message: error.message,
        code: "DUPLICATE_LOCAL",
        datos: error.datos,
      });
    }
    if (error.code === 11000) {
      return res.status(409).json({ message: "Ya existe un cliente con esa clave única" });
    }
    console.error("❌ Error creando cliente:", error.message);
    return res.status(500).json({ message: error.message });
  }
});

// ══════════════════════════════════════════════════════════════════
// PATCH /api/clientes/:id/customdata
// Actualiza los datos personalizados (customData) de un cliente
// NUNCA sobrescribe datos ERP
// ══════════════════════════════════════════════════════════════════
router.patch("/:id/customdata", tokenHandler(), async (req, res) => {
  try {
    const actualizado = await clienteService.actualizarCustomData(
      req.params.id,
      req.body
    );
    if (!actualizado) return res.status(404).json({ message: "Cliente no encontrado" });
    return res.json(actualizado);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

// ══════════════════════════════════════════════════════════════════
// CONTACTOS DEL CLIENTE
// GET /api/clientes/:id/contactos
// POST /api/clientes/:id/contactos
// PATCH /api/clientes/:id/contactos/:contactoId
// ══════════════════════════════════════════════════════════════════
router.get("/:id/contactos", tokenHandler(), async (req, res) => {
  try {
    const cliente = await Cliente.findById(req.params.id).select("contactos").lean();
    if (!cliente) return res.status(404).json({ message: "Cliente no encontrado" });
    return res.json({ contactos: cliente.contactos || [] });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.post("/:id/contactos", tokenHandler(), async (req, res) => {
  try {
    const { nombre, cargo, telefono, email, notas } = req.body || {};
    if (!nombre?.trim()) return res.status(400).json({ message: "nombre es obligatorio" });

    const actualizado = await Cliente.findByIdAndUpdate(
      req.params.id,
      {
        $push: {
          contactos: {
            nombre: nombre.trim(),
            cargo,
            telefono,
            email,
            notas,
            isActive: true,
            createdAt: new Date(),
          },
        },
      },
      { new: true }
    ).select("contactos").lean();

    if (!actualizado) return res.status(404).json({ message: "Cliente no encontrado" });
    return res.status(201).json({ contactos: actualizado.contactos });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.patch("/:id/contactos/:contactoId", tokenHandler(), async (req, res) => {
  try {
    const allowed = ["nombre", "cargo", "telefono", "email", "notas", "isActive"];
    const set = {};
    for (const k of allowed) {
      if (req.body?.[k] !== undefined) set[`contactos.$.${k}`] = req.body[k];
    }

    if (Object.keys(set).length === 0) {
      return res.status(400).json({ message: "Nada para actualizar" });
    }

    const actualizado = await Cliente.findOneAndUpdate(
      { _id: req.params.id, "contactos._id": req.params.contactoId },
      { $set: set },
      { new: true }
    ).select("contactos").lean();

    if (!actualizado) return res.status(404).json({ message: "Cliente/contacto no encontrado" });
    return res.json({ contactos: actualizado.contactos });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

// ══════════════════════════════════════════════════════════════════
// POST /api/clientes/:prospectoId/convertir/:sedeErpId
// Convierte un prospecto manual en cliente ERP
// (vincula al prospecto con una sede existente del ERP)
// ══════════════════════════════════════════════════════════════════
router.post("/:prospectoId/convertir/:sedeErpId", tokenHandler(), async (req, res) => {
  try {
    const convertido = await clienteService.convertirProspecto(
      req.params.prospectoId,
      req.params.sedeErpId
    );
    return res.json({ message: "Prospecto convertido exitosamente", cliente: convertido });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

// ══════════════════════════════════════════════════════════════════
// DELETE /api/clientes/:id
// Desactiva un cliente (soft delete)
// ══════════════════════════════════════════════════════════════════
router.delete("/:id", tokenHandler(), async (req, res) => {
  try {
    const desactivado = await clienteService.desactivar(req.params.id);
    if (!desactivado) return res.status(404).json({ message: "Cliente no encontrado" });
    return res.json({ message: "Cliente desactivado", cliente: desactivado });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

// ══════════════════════════════════════════════════════════════════
// POST /api/clientes/sync/erp
// Sincronización manual o por cron: jala datos del ERP y sincroniza
// ══════════════════════════════════════════════════════════════════
router.post(
  "/sync/erp",
  tokenHandler(),
  authSafixHandler(),
  async (req, res) => {
    if (syncState.running) {
      return res.status(409).json({
        message: "Ya hay una sincronización en curso",
        running: true,
        startedAt: syncState.startedAt,
        processed: syncState.processed,
      });
    }

    const Authorization = req.Authorization;

    // Responder rápido y ejecutar en background
    syncState.running = true;
    syncState.startedAt = new Date();
    syncState.finishedAt = null;
    syncState.processed = 0;
    syncState.lastError = null;
    syncState.summary = { creados: 0, actualizados: 0, convertidos: 0, errores: [] };

    res.status(202).json({
      message: "Sincronización iniciada",
      running: true,
      startedAt: syncState.startedAt,
    });

    setImmediate(async () => {
      const LIMIT = 200;
      let offset = 0;

      console.log("🔄 Iniciando sincronización con ERP...");

      try {
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
            const errText = await response.text();
            throw new Error(`ERP respondió ${response.status}: ${errText}`);
          }

          const data = await response.json();
          const lista = Array.isArray(data) ? data : data.clientes ?? data.data ?? [];
          if (lista.length === 0) break;

          const resultado = await clienteService.sincronizarDesdeERP(lista);

          syncState.summary.creados += resultado.creados;
          syncState.summary.actualizados += resultado.actualizados;
          syncState.summary.convertidos += resultado.convertidos;
          syncState.summary.errores.push(...resultado.errores);

          syncState.processed += lista.length;
          console.log(`  ✅ Procesados ${syncState.processed} registros...`);

          if (lista.length < LIMIT) break;
          offset += LIMIT;
        }

        console.log("✅ Sincronización completa:", syncState.summary);
      } catch (error) {
        syncState.lastError = error.message;
        console.error("❌ Error en sincronización ERP:", error.message);
      } finally {
        syncState.running = false;
        syncState.finishedAt = new Date();
      }
    });
  }
);

// ══════════════════════════════════════════════════════════════════
// GET /api/clientes/verificar/:identificacion
// Verifica si una identificación existe en ERP local o como prospecto
// (usado antes de crear cliente manual)
// ══════════════════════════════════════════════════════════════════
router.get("/verificar/:identificacion", tokenHandler(), async (req, res) => {
  try {
    const { identificacion } = req.params;

    const [sedesERP, prospectos] = await Promise.all([
      clienteService.verificarEnERPLocal(identificacion),
      clienteService.buscarDuplicados(identificacion),
    ]);

    return res.json({
      identificacion,
      existeEnERP: sedesERP.length > 0,
      sedesERP,
      prospectos: prospectos.filter((p) => p.source === "MANUAL"),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

module.exports = router;