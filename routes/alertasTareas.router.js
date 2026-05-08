const express = require("express");
const router = express.Router();

const tokenHandler = require("../middlewares/token.handler");
const requireAdmin = require("../middlewares/admin.handler");
const alertaTareasService = require("../services/alertaTareas.service");

router.get("/activa", tokenHandler(), async (req, res) => {
  try {
    if (req.auth.rol !== "comercial") {
      return res.json({ activa: null });
    }
    const result = await alertaTareasService.obtenerActivaParaAsesor(req.auth.cedula);
    res.json(result);
  } catch (e) {
    res.status(500).json({ message: e.message || "Error" });
  }
});

router.post("/ack", tokenHandler(), async (req, res) => {
  try {
    if (req.auth.rol !== "comercial") {
      return res.status(403).json({ message: "Solo el asesor puede confirmar" });
    }
    const { alertId, visitaId, kind } = req.body || {};
    await alertaTareasService.reconocer({
      asesorCedula: req.auth.cedula,
      asesorNombre: req.auth.nombre,
      alertId,
      visitaId,
      kind: kind || "sistema",
    });
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ message: e.message || "Error" });
  }
});

router.post("/", tokenHandler(), requireAdmin(), async (req, res) => {
  try {
    const { visitaId } = req.body || {};
    if (!visitaId) return res.status(400).json({ message: "visitaId es obligatorio" });
    const out = await alertaTareasService.crearAlertaAdmin({
      visitaId,
      rol: req.auth.rol,
    });
    res.json(out);
  } catch (e) {
    res.status(400).json({ message: e.message || "Error" });
  }
});

module.exports = router;
