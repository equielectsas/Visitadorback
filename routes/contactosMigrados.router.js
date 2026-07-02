const express = require("express");
const multer = require("multer");
const tokenHandler = require("../middlewares/token.handler");
const requireAdmin = require("../middlewares/admin.handler");
const contactosMigradosService = require("../services/contactosMigrados.service");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/contactos-migrados/con-contactos?page=&limit=&search=
// Empresas con contactos migrados agrupados (asesores y admins)
// ═══════════════════════════════════════════════════════════════════════════
router.get("/con-contactos", tokenHandler(), async (req, res) => {
  try {
    const data = await contactosMigradosService.listarAgrupadoPorEmpresa({
      search: req.query.search || "",
      page: req.query.page,
      limit: req.query.limit,
    });
    return res.json(data);
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json({
      message: error.message || "Error al listar contactos migrados.",
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/contactos-migrados/por-empresa?cliente=...
// Contactos históricos importados, relacionados por nombre de empresa.
// ═══════════════════════════════════════════════════════════════════════════
router.get("/por-empresa", tokenHandler(), async (req, res) => {
  try {
    const cliente = req.query.cliente || req.query.empresa || "";
    const data = await contactosMigradosService.listarPorEmpresa(cliente);
    return res.json(data);
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json({
      message: error.message || "Error al consultar contactos migrados.",
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/contactos-migrados/estado — estadísticas (solo admins)
// ═══════════════════════════════════════════════════════════════════════════
router.get("/estado", tokenHandler(), requireAdmin(), async (req, res) => {
  try {
    const data = await contactosMigradosService.obtenerEstado();
    return res.json(data);
  } catch (error) {
    return res.status(500).json({
      message: error.message || "Error al consultar estado de contactos migrados.",
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/contactos-migrados/importar — subir Excel (solo admins)
// ═══════════════════════════════════════════════════════════════════════════
router.post(
  "/importar",
  tokenHandler(),
  requireAdmin(),
  upload.single("archivo"),
  async (req, res) => {
    try {
      const reemplazar = String(req.body?.reemplazar || "false").toLowerCase() === "true";
      const result = await contactosMigradosService.importarDesdeExcel({
        buffer: req.file?.buffer,
        reemplazar,
      });
      return res.json(result);
    } catch (error) {
      const status = error.status || 500;
      return res.status(status).json({
        message: error.message || "Error al importar contactos desde Excel.",
      });
    }
  }
);

module.exports = router;
