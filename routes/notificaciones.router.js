const express = require("express");
const router = express.Router();

const tokenHandler = require("../middlewares/token.handler");
const notificacionService = require("../services/notificacion.service");

/** Recordatorios / deduplicados: el asesor registra una notificación persistente (p. ej. visita en 24 h). */
router.post("/dedupe", tokenHandler(), async (req, res) => {
  try {
    if (req.auth.rol !== "comercial") {
      return res.status(403).json({ message: "Solo disponible para asesores" });
    }
    const { dedupeKey, type, title, body } = req.body || {};
    if (!dedupeKey || !title) {
      return res.status(400).json({ message: "dedupeKey y title son obligatorios" });
    }
    await notificacionService.crearParaAsesor(req.auth.cedula, {
      type: type || "cita",
      title: String(title),
      body: String(body || ""),
      dedupeKey: String(dedupeKey),
    });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: e.message || "Error" });
  }
});

router.get("/", tokenHandler(), async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 80, 200);
    const items = await notificacionService.listarParaUsuario({
      rol: req.auth.rol,
      cedula: req.auth.cedula,
      limit,
    });
    res.json({ items });
  } catch (e) {
    res.status(500).json({ message: e.message || "Error al listar notificaciones" });
  }
});

router.patch("/marcar-todas-leidas", tokenHandler(), async (req, res) => {
  try {
    await notificacionService.marcarTodasLeidas({
      rol: req.auth.rol,
      cedula: req.auth.cedula,
    });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: e.message || "Error" });
  }
});

router.patch("/:id/leida", tokenHandler(), async (req, res) => {
  try {
    await notificacionService.marcarLeida(req.params.id, {
      rol: req.auth.rol,
      cedula: req.auth.cedula,
    });
    res.json({ ok: true });
  } catch (e) {
    const code = e.message?.includes("No autorizado") ? 403 : e.message?.includes("no encontrada") ? 404 : 500;
    res.status(code).json({ message: e.message || "Error" });
  }
});

module.exports = router;
