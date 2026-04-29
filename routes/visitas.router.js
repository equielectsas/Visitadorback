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

    const resultado = await visitaService.listar({
      rol: req.body.rol,
      asesorCedula: asesorCedula ? Number(asesorCedula) : Number(req.body.cedula),
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
      asesor: { cedula: req.body.cedula, nombre: req.body.nombre, rol: req.body.rol },
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
// PATCH /api/visitas/:id/iniciar
// ══════════════════════════════════════════════════════════════════
router.patch("/:id/iniciar", tokenHandler(), async (req, res) => {
  try {
    const visita = await visitaService.iniciar({
      id: req.params.id,
      rol: req.body.rol,
      asesorCedula: Number(req.body.cedula),
    });
    return res.json(visita);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

// ══════════════════════════════════════════════════════════════════
// PATCH /api/visitas/:id/finalizar
// Body: { datosVisita, estadoFinal? }
// ══════════════════════════════════════════════════════════════════
router.patch("/:id/finalizar", tokenHandler(), async (req, res) => {
  try {
    const visita = await visitaService.finalizar({
      id: req.params.id,
      rol: req.body.rol,
      asesorCedula: Number(req.body.cedula),
      datosVisita: req.body.datosVisita,
      estadoFinal: req.body.estadoFinal || "realizada",
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
      rol: req.body.rol,
      asesorCedula: Number(req.body.cedula),
      fecha: req.body.fecha,
      hora: req.body.hora,
      motivo: req.body.motivo,
    });
    return res.json(visita);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

module.exports = router;

