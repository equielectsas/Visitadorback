const jwt = require("jsonwebtoken");
const { config } = require("../config/config");
const safix = require("../models/safix.model");
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));
const moment = require("moment");

function authSafixHandler() {
  return async (req, res, next) => {
    try {
      const rta = await safix.findOne({}, {}, { sort: { createdAt: -1 } });

      if (rta?.token) {
        const updatedAt = moment(rta.updatedAt);
        const currentTime = moment(new Date());
        const diff = currentTime.diff(updatedAt, "m");

        if (diff < 14) {
          req.Authorization = `Bearer ${
            jwt.verify(rta.token, config.jwtSecret).token
          }`;
          return next();
        } else {
          return await refreshSafixToken(rta._id, req, res, next);
        }
      } else {
        return await createSafixToken(req, res, next);
      }
    } catch (error) {
      console.error("❌ authSafixHandler error:", error.message);
      return res.status(400).json({
        message:
          "Problemas de autenticación en SAFIX, contacta con tu administrador",
      });
    }
  };
}

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

async function refreshSafixToken(id, req, res, next) {
  const formBody = buildFormBody();
  const response = await fetch(`${process.env.DB_SFX}Autenticar`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formBody,
  });
  const newToken = await response.json();
  const token = jwt.sign({ token: newToken.token }, config.jwtSecret);
  await safix.findByIdAndUpdate(id, { token });
  req.Authorization = `Bearer ${newToken.token}`;
  next();
}

async function createSafixToken(req, res, next) {
  const formBody = buildFormBody();
  const response = await fetch(`${process.env.DB_SFX}Autenticar`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formBody,
  });
  const data = await response.json();
  const token = jwt.sign({ token: data.token }, config.jwtSecret);
  const newSafix = new safix({ token });
  const saved = await newSafix.save();
  req.Authorization = `Bearer ${jwt.verify(saved.token, config.jwtSecret).token}`;
  next();
}

module.exports = authSafixHandler;