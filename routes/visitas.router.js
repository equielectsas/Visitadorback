const express = require("express");
const router = express.Router();

const tokenHandler = require("../middlewares/token.handler");
const visitaService = require("../services/visita.service");

// ══════════════════════════════════════════════════════════════════
// GET /api/visitas
// Lista visitas (asesor: solo propias; admin/programador: todas o por asesorCedula)
// Query: estado, desde(yyyy-mm-dd), hasta(yyyy-mm-dd), page, limit, asesorCedula, clienteId
// ══════════════════════════════════════════════════════════════════
router.get("/", tokenHandler(), async (req, res) => {
  try {
    const {
      estado,
      desde,
      hasta,
      page = 1,
      limit = 20,
      asesorCedula,
      clienteId,
    } = req.query;

    // Solo "comercial" debe quedar acotado a su cédula cuando no hay filtro explícito.
    // Admin/programador sin ?asesorCedula debe ver todas las visitas (antes se pasaba req.auth.cedula y se filtraba mal).
    const rawAsesor = asesorCedula;
    let filterAsesorCedula;
    if (rawAsesor !== undefined && rawAsesor !== "" && rawAsesor !== null) {
      const n = Number(rawAsesor);
      filterAsesorCedula = Number.isFinite(n) ? n : undefined;
    } else if (req.auth.rol === "comercial") {
      const n = Number(req.auth.cedula);
      filterAsesorCedula = Number.isFinite(n) ? n : undefined;
    } else {
      filterAsesorCedula = undefined;
    }

    const resultado = await visitaService.listar({
      rol: req.auth.rol,
      asesorCedula: filterAsesorCedula,
      estado,
      desde,
      hasta,
      page: parseInt(page),
      limit: parseInt(limit),
      clienteId,
    });

    return res.json(resultado);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

// ══════════════════════════════════════════════════════════════════
// POST /api/visitas
// Crea visita pendiente (o activa)
// Body: { clienteId? , clienteCrear? , fecha, hora, estado? }
// ══════════════════════════════════════════════════════════════════
router.post("/", tokenHandler(), async (req, res) => {
  try {
    const { clienteId, clienteCrear, fecha, hora, estado } = req.body;

    const visita = await visitaService.crearVisita({
      asesor: { cedula: req.auth.cedula, nombre: req.auth.nombre, rol: req.auth.rol },
      clienteId,
      clienteCrear,
      fecha,
      hora,
      estado,
    });

    return res.status(201).json(visita);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

// ══════════════════════════════════════════════════════════════════
// PATCH /api/visitas/:id
// Edita fecha/hora/empresa/datos de visita.
// Asesor: solo sus visitas y no realizadas. Admin: cualquier estado.
// ══════════════════════════════════════════════════════════════════
router.patch("/:id", tokenHandler(), async (req, res) => {
  try {
    const visita = await visitaService.editar({
      id: req.params.id,
      rol: req.auth.rol,
      asesorCedula: Number(req.auth.cedula),
      fecha: req.body.fecha,
      hora: req.body.hora,
      clienteId: req.body.clienteId,
      clienteCrear: req.body.clienteCrear,
      datosVisita: req.body.datosVisita,
      motivo: req.body.motivo,
    });
    return res.json(visita);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

// ══════════════════════════════════════════════════════════════════
// DELETE /api/visitas/:id
// Soft delete. Visita realizada: solo admin. No realizada: usuario con acceso.
// ══════════════════════════════════════════════════════════════════
router.delete("/:id", tokenHandler(), async (req, res) => {
  try {
    const visita = await visitaService.eliminar({
      id: req.params.id,
      rol: req.auth.rol,
      asesorCedula: Number(req.auth.cedula),
    });
    return res.json({ message: "Visita eliminada", visita });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

// ══════════════════════════════════════════════════════════════════
// PATCH /api/visitas/:id/iniciar
// ══════════════════════════════════════════════════════════════════
router.patch("/:id/iniciar", tokenHandler(), async (req, res) => {
  try {
    const visita = await visitaService.iniciar({
      id: req.params.id,
      rol: req.auth.rol,
      asesorCedula: Number(req.auth.cedula),
    });
    return res.json(visita);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

// ══════════════════════════════════════════════════════════════════
// PATCH /api/visitas/:id/finalizar
// Body: { datosVisita, estadoFinal?, fecha?, hora? } — fecha/hora del cierre (día en que se realizó); si no vienen, el servidor usa la hora actual.
// ══════════════════════════════════════════════════════════════════
router.patch("/:id/finalizar", tokenHandler(), async (req, res) => {
  try {
    const visita = await visitaService.finalizar({
      id: req.params.id,
      rol: req.auth.rol,
      asesorCedula: Number(req.auth.cedula),
      datosVisita: req.body.datosVisita,
      estadoFinal: req.body.estadoFinal || "realizada",
      fecha: req.body.fecha,
      hora: req.body.hora,
    });
    return res.json(visita);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

// ══════════════════════════════════════════════════════════════════
// PATCH /api/visitas/:id/reprogramar
// Body: { fecha, hora, motivo? }
// ══════════════════════════════════════════════════════════════════
router.patch("/:id/reprogramar", tokenHandler(), async (req, res) => {
  try {
    const visita = await visitaService.reprogramar({
      id: req.params.id,
      rol: req.auth.rol,
      asesorCedula: Number(req.auth.cedula),
      fecha: req.body.fecha,
      hora: req.body.hora,
      motivo: req.body.motivo,
      clienteId: req.body.clienteId,
      clienteCrear: req.body.clienteCrear,
      datosVisita: req.body.datosVisita,
    });
    return res.json(visita);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

// ══════════════════════════════════════════════════════════════════
// PATCH /api/visitas/:id/tareas
// Body: { tareasPendientes: [{ texto, done, marcadaPorAsesorAt? }] }
// Asesor: solo puede actualizar sus visitas. Admin: todas.
// ══════════════════════════════════════════════════════════════════
router.patch("/:id/tareas", tokenHandler(), async (req, res) => {
  try {
    const visita = await visitaService.actualizarTareasPendientes({
      id: req.params.id,
      rol: req.auth.rol,
      asesorCedula: Number(req.auth.cedula),
      tareasPendientes: req.body?.tareasPendientes,
    });
    return res.json(visita);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

module.exports = router;

