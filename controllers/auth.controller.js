const { request, response } = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const usuario = require("../models/usuario.model");
const { config } = require("../config/config");

class AuthController {
  async loginPassword(req = request, res = response) {
    try {
      const { cedula, password } = req.body;

      if (!cedula || !password) {
        return res
          .status(400)
          .json({ message: "Cédula y contraseña son requeridas", status: 400 });
      }

      // Buscar por número ya que la cédula está guardada como Number en la BD
      const user = await usuario.findOne({ cedula: Number(cedula) });

      if (!user) {
        return res
          .status(404)
          .json({ message: "Usuario no encontrado", status: 404 });
      }

      const isMatch = await bcrypt.compare(password, user.password);

      if (!isMatch) {
        return res
          .status(400)
          .json({ message: "Contraseña incorrecta", status: 400 });
      }

      const payload = {
        cedula: user.cedula,
        nombre: user.nombre,
        rol: user.rol,
      };

      const token = jwt.sign(payload, config.jwtSecret);

      return res.status(201).json({
        token,
        nombre: payload.nombre,
        rol: payload.rol,
        cedula: payload.cedula,
        status: 201,
      });
    } catch (error) {
      console.error("❌ loginPassword error:", error.message);
      return res
        .status(500)
        .json({ message: "Problemas para autenticar", status: 500 });
    }
  }
}

module.exports = AuthController;