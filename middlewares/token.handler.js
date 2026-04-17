const jwt = require("jsonwebtoken");
const { config } = require("../config/config");

function tokenHandler() {
  return (req, res, next) => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader) {
        return res.status(401).json({ message: "Debes iniciar sesión", status: 401 });
      }

      const payload = jwt.verify(authHeader, config.jwtSecret);

      req.body = {
        ...req.body,
        cedula: payload?.cedula,
        nombre: payload?.nombre,
        rol: payload?.rol,
      };

      next();
    } catch (error) {
      return res.status(401).json({
        message: "Sesión inválida o expirada, vuelve a iniciar sesión",
        status: 401,
      });
    }
  };
}

module.exports = tokenHandler;