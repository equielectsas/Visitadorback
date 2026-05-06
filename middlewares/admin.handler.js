/**
 * Solo adminPlataforma / adminComercial (misma convención que el front).
 */
function requireAdmin() {
  return (req, res, next) => {
    const r = req.auth?.rol;
    if (r === "adminPlataforma" || r === "adminComercial") return next();
    return res.status(403).json({ message: "No tienes permiso para esta acción" });
  };
}

module.exports = requireAdmin;
