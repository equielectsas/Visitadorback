const Notificacion = require("../models/notificacion.model");

class NotificacionService {
  async listarParaUsuario({ rol, cedula, limit = 80 }) {
    const c = Number(cedula);
    const isAdmin = rol === "adminPlataforma" || rol === "adminComercial";
    const q = isAdmin
      ? { recipientScope: "admin" }
      : { recipientScope: "asesor", recipientCedula: c };
    const items = await Notificacion.find(q).sort({ createdAt: -1 }).limit(limit).lean();
    return items.map((n) => ({
      id: String(n._id),
      recipientKey: isAdmin ? "admin:any" : `user:${c}`,
      type: n.type,
      title: n.title,
      body: n.body,
      read: n.read,
      createdAt: n.createdAt?.toISOString?.() || new Date().toISOString(),
    }));
  }

  async marcarLeida(id, { rol, cedula }) {
    const n = await Notificacion.findById(id);
    if (!n) throw new Error("Notificación no encontrada");
    const c = Number(cedula);
    const isAdmin = rol === "adminPlataforma" || rol === "adminComercial";
    if (isAdmin && n.recipientScope !== "admin") throw new Error("No autorizado");
    if (!isAdmin && (n.recipientScope !== "asesor" || n.recipientCedula !== c)) throw new Error("No autorizado");
    n.read = true;
    await n.save();
    return { ok: true };
  }

  async marcarTodasLeidas({ rol, cedula }) {
    const c = Number(cedula);
    const isAdmin = rol === "adminPlataforma" || rol === "adminComercial";
    const filter = isAdmin
      ? { recipientScope: "admin" }
      : { recipientScope: "asesor", recipientCedula: c };
    await Notificacion.updateMany(filter, { $set: { read: true } });
    return { ok: true };
  }

  async crearParaAsesor(cedula, { type, title, body, dedupeKey }) {
    const c = Number(cedula);
    if (!Number.isFinite(c)) throw new Error("Cédula inválida");
    if (dedupeKey) {
      const exists = await Notificacion.findOne({ dedupeKey });
      if (exists) return exists.toObject();
    }
    const doc = await Notificacion.create({
      recipientCedula: c,
      recipientScope: "asesor",
      type: type || "sistema",
      title,
      body: body || "",
      dedupeKey: dedupeKey || undefined,
    });
    return doc.toObject();
  }

  async crearParaAdmins({ type, title, body }) {
    const doc = await Notificacion.create({
      recipientScope: "admin",
      type: type || "sistema",
      title,
      body: body || "",
    });
    return doc.toObject();
  }
}

module.exports = new NotificacionService();
