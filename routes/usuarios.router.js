const express = require("express");
const tokenHandler = require("../middlewares/token.handler");
const requireAdmin = require("../middlewares/admin.handler");
const Usuario = require("../models/usuario.model");

const router = express.Router();

// GET /api/usuarios — listado sin contraseña (solo admins)
router.get("/", tokenHandler(), requireAdmin(), async (req, res) => {
  try {
    const usuarios = await Usuario.find({})
      .select("cedula nombre rol")
      .sort({ nombre: 1 })
      .lean();

    return res.json({
      usuarios: usuarios.map((u) => ({
        id: String(u._id),
        cedula: u.cedula != null ? String(u.cedula) : "",
        nombre: u.nombre || "",
        rol: u.rol || "",
      })),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

module.exports = router;
