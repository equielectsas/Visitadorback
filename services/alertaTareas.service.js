const mongoose = require("mongoose");
const Visita = require("../models/visita.model");
const TaskUrgencyAlert = require("../models/taskUrgencyAlert.model");
const Usuario = require("../models/usuario.model");
const notificacionService = require("./notificacion.service");

function tieneTareasPendientes(visita) {
  const t = visita?.datosVisita?.tareasPendientes;
  if (!Array.isArray(t) || t.length === 0) return false;
  return t.some((x) => !x?.done);
}

class AlertaTareasService {
  /**
   * Prioridad: alerta explícita del admin; si no, visita realizada/activa con tareas incompletas.
   */
  async obtenerActivaParaAsesor(asesorCedula) {
    const c = Number(asesorCedula);
    if (!Number.isFinite(c)) return { activa: null };

    const adminAlert = await TaskUrgencyAlert.findOne({
      asesorCedula: c,
      acknowledgedAt: null,
    })
      .sort({ createdAt: -1 })
      .lean();

    if (adminAlert) {
      return {
        activa: {
          kind: "admin",
          id: String(adminAlert._id),
          visitaId: String(adminAlert.visitaId),
          empresa: adminAlert.empresa || "la visita",
        },
      };
    }

    const u = await Usuario.findOne({ cedula: c }).select("pendingTasksAckAt").lean();
    // Si el asesor ya confirmó "Lo haré!" una vez (sistema), no se vuelve a mostrar esta alerta automática.
    if (u?.pendingTasksAckAt) return { activa: null };

    const visita = await Visita.findOne({
      isActive: true,
      "asesor.cedula": c,
      estado: { $in: ["realizada", "activa"] },
      "datosVisita.tareasPendientes": { $elemMatch: { done: false } },
    })
      .sort({ finishedAt: -1, updatedAt: -1 })
      .lean();

    if (visita && tieneTareasPendientes(visita)) {
      const empresa = visita.datosVisita?.nombreEmpresa || "la visita";
      return {
        activa: {
          kind: "sistema",
          id: null,
          visitaId: String(visita._id),
          empresa,
        },
      };
    }

    return { activa: null };
  }

  async crearAlertaAdmin({ visitaId, rol }) {
    if (rol !== "adminPlataforma" && rol !== "adminComercial") {
      throw new Error("Solo administradores pueden enviar esta alerta");
    }
    if (!mongoose.Types.ObjectId.isValid(visitaId)) throw new Error("visitaId inválido");

    const visita = await Visita.findById(visitaId).lean();
    if (!visita) throw new Error("Visita no encontrada");
    const c = visita.asesor?.cedula;
    if (c == null || !Number.isFinite(Number(c))) throw new Error("La visita no tiene cédula de asesor");

    const empresa = visita.datosVisita?.nombreEmpresa || "la visita";

    const exists = await TaskUrgencyAlert.findOne({
      visitaId: visita._id,
      asesorCedula: Number(c),
      acknowledgedAt: null,
    });
    if (!exists) {
      await TaskUrgencyAlert.create({
        visitaId: visita._id,
        asesorCedula: Number(c),
        empresa,
        source: "admin",
      });
    }

    await notificacionService.crearParaAsesor(Number(c), {
      type: "alerta",
      title: "Tareas pendientes",
      body: `El administrador te recuerda completar las tareas pendientes en ${empresa}.`,
    });

    return { ok: true, empresa };
  }

  async reconocer({ asesorCedula, asesorNombre, alertId, visitaId, kind }) {
    const c = Number(asesorCedula);
    if (!Number.isFinite(c)) throw new Error("Sesión inválida");

    if (kind === "admin" && alertId && mongoose.Types.ObjectId.isValid(alertId)) {
      const alert = await TaskUrgencyAlert.findById(alertId);
      if (!alert || alert.asesorCedula !== c) throw new Error("Alerta no encontrada");
      if (!alert.acknowledgedAt) {
        alert.acknowledgedAt = new Date();
        await alert.save();
      }
    }

    if (kind === "sistema") {
      await Usuario.updateOne({ cedula: c }, { $set: { pendingTasksAckAt: new Date() } });
    }

    let empresaLabel = "la visita";
    if (visitaId && mongoose.Types.ObjectId.isValid(visitaId)) {
      const visita = await Visita.findById(visitaId).lean();
      if (visita) empresaLabel = visita.datosVisita?.nombreEmpresa || empresaLabel;
    }

    const nombre = String(asesorNombre || c);
    await notificacionService.crearParaAdmins({
      type: "exito",
      title: "Asesor confirmó compromiso con tareas pendientes",
      body: `${nombre} pulsó "Lo haré!" respecto a las tareas pendientes en ${empresaLabel}.`,
    });

    return { ok: true };
  }
}

module.exports = new AlertaTareasService();
