const jwt = require("jsonwebtoken");
const { config } = require("../config/config");
const safix = require("../models/safix.model");

const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

function authSafixHandler() {
  return async (req, res, next) => {
    try {
      const rta = await safix.findOne({}, {}, { sort: { createdAt: -1 } });

      // Si ya hay token guardado
      if (rta?.token) {
        const diff = (Date.now() - new Date(rta.updatedAt)) / 60000;

        // Token válido (menos de 14 minutos)
        if (diff < 14) {
          try {
            const decoded = jwt.verify(rta.token, config.jwtSecret);
            req.safixToken = decoded.token;
            return next();
          } catch (err) {
            // Token inválido → refrescar
            return await refreshSafixToken(rta._id, req, res, next);
          }
        } else {
          // Token expirado → refrescar
          return await refreshSafixToken(rta._id, req, res, next);
        }
      } else {
        // No hay token → crear
        return await createSafixToken(req, res, next);
      }
    } catch (error) {
      console.error("❌ authSafixHandler error:", error.message);
      return res.status(500).json({
        message:
          "Problemas de autenticación en SAFIX, contacta con tu administrador",
      });
    }
  };
}

// Construir body tipo x-www-form-urlencoded
function buildFormBody() {
  const body = {
    user: process.env.USR,
    password: process.env.PSWRD,
    clientId: process.env.CLNTID,
  };

  return Object.entries(body)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
}

// Refrescar token existente
async function refreshSafixToken(id, req, res, next) {
  try {
    const formBody = buildFormBody();

    const response = await fetch(`${process.env.DB_SFX}Autenticar`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formBody,
    });

    if (!response.ok) {
      throw new Error("Error al autenticar con SAFIX");
    }

    const newToken = await response.json();

    const token = jwt.sign({ token: newToken.token }, config.jwtSecret);

    await safix.findByIdAndUpdate(id, { token });

    req.safixToken = newToken.token;

    next();
  } catch (error) {
    console.error("❌ refreshSafixToken error:", error.message);
    return res.status(500).json({
      message: "Error al refrescar token de SAFIX",
    });
  }
}

// Crear token nuevo
async function createSafixToken(req, res, next) {
  try {
    const formBody = buildFormBody();

    const response = await fetch(`${process.env.DB_SFX}Autenticar`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formBody,
    });

    if (!response.ok) {
      throw new Error("Error al autenticar con SAFIX");
    }

    const data = await response.json();

    const token = jwt.sign({ token: data.token }, config.jwtSecret);

    const newSafix = new safix({ token });
    const saved = await newSafix.save();

    const decoded = jwt.verify(saved.token, config.jwtSecret);

    req.safixToken = decoded.token;

    next();
  } catch (error) {
    console.error("❌ createSafixToken error:", error.message);
    return res.status(500).json({
      message: "Error al crear token de SAFIX",
    });
  }
}

module.exports = authSafixHandler;