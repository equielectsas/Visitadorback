const express = require("express");
const router = express.Router();
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));
const authSafixHandler = require("../middlewares/authSafix.handler");
const tokenHandler = require("../middlewares/token.handler");

// GET /api/clientes?limit=200&offset=0
router.get(
  "/",
  tokenHandler(),
  authSafixHandler(),
  async (req, res) => {
    try {
      const limit  = parseInt(req.query.limit)  || 200;
      const offset = parseInt(req.query.offset) || 0;

      const response = await fetch(
        `${process.env.DB_SFX}ObtenerCliente`,
        {
          method: "GET",
          headers: {
            Authorization: req.Authorization,
            P_LIMIT:  String(limit),
            P_OFFSET: String(offset),
          },
        }
      );

      if (!response.ok) {
        const errText = await response.text();
        return res.status(response.status).json({ message: errText });
      }

      const data = await response.json();
      return res.json(data);
    } catch (error) {
      console.error("❌ Error obteniendo clientes:", error.message);
      return res.status(500).json({ message: "Error al obtener clientes" });
    }
  }
);

module.exports = router;