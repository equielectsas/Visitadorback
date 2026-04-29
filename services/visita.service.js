const Visita = require("../models/visita.model");
const Cliente = require("../models/cliente.model");
const clienteService = require("./cliente.service");

function buildScheduledAt(fecha, hora) {
  if (!fecha) return null;
  // fecha: yyyy-mm-dd, hora: HH:mm
  const h = hora || "00:00";
  const d = new Date(`${fecha}T${h}:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

class VisitaService {
  async crearVisita({ asesor, clienteId, clienteCrear, fecha, hora, estado = "pendiente" }) {
    let finalClienteId = clienteId;

    if (!finalClienteId && clienteCrear) {
      const nuevo = await clienteService.crearClienteManual(clienteCrear);
      finalClienteId = nuevo._id;
    }

    if (!finalClienteId) {
      throw new Error("clienteId o clienteCrear es obligatorio");
    }

    const cliente = await Cliente.findById(finalClienteId).select("_id identificacion razonSocial direccion ciudad telefono").lean();
    if (!cliente) throw new Error("Cliente no encontrado");

    const visita = await Visita.create({
      asesor,
      clienteId: finalClienteId,
      estado,
      fecha,
      hora,
      scheduledAt: buildScheduledAt(fecha, hora),
      datosVisita: {
        nit: cliente.identificacion,
        nombreEmpresa: cliente.razonSocial,
        direccionEmpresa: cliente.direccion,
      },
    });

    return visita.toObject();
  }

  async listar({ rol, asesorCedula, estado, desde, hasta, page = 1, limit = 20, clienteId }) {
    const query = { isActive: true };

    // Permisos: asesor solo ve lo suyo
    if (rol === "comercial") {
      query["asesor.cedula"] = asesorCedula;
    } else if (asesorCedula) {
      // admin/programador puede filtrar
      query["asesor.cedula"] = asesorCedula;
    }

    if (estado) query.estado = estado;
    if (clienteId) query.clienteId = clienteId;

    if (desde || hasta) {
      query.scheduledAt = {};
      if (desde) query.scheduledAt.$gte = new Date(`${desde}T00:00:00`);
      if (hasta) query.scheduledAt.$lte = new Date(`${hasta}T23:59:59`);
    }

    const skip = (page - 1) * limit;
    const [visitas, total] = await Promise.all([
      Visita.find(query)
        .sort({ scheduledAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Visita.countDocuments(query),
    ]);

    return {
      visitas,
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }

  async iniciar({ id, rol, asesorCedula }) {
    const query = { _id: id, isActive: true };
    if (rol === "comercial") query["asesor.cedula"] = asesorCedula;

    const v = await Visita.findOneAndUpdate(
      query,
      { $set: { estado: "activa", startedAt: new Date() } },
      { new: true }
    ).lean();
    if (!v) throw new Error("Visita no encontrada o sin permisos");
    return v;
  }

  async finalizar({ id, rol, asesorCedula, datosVisita, estadoFinal = "realizada" }) {
    const query = { _id: id, isActive: true };
    if (rol === "comercial") query["asesor.cedula"] = asesorCedula;

    const v = await Visita.findOneAndUpdate(
      query,
      {
        $set: {
          estado: estadoFinal,
          finishedAt: new Date(),
          "datosVisita.nit": datosVisita?.nit,
          "datosVisita.nombreEmpresa": datosVisita?.nombreEmpresa,
          "datosVisita.direccionEmpresa": datosVisita?.direccionEmpresa,
          "datosVisita.municipio": datosVisita?.municipio,
          "datosVisita.tipoVisita": datosVisita?.tipoVisita,
          "datosVisita.tipoVehiculo": datosVisita?.tipoVehiculo,
          "datosVisita.nombreEncargado": datosVisita?.nombreEncargado,
          "datosVisita.cargoEncargado": datosVisita?.cargoEncargado,
          "datosVisita.observaciones": datosVisita?.observaciones,
          "datosVisita.geoCoords": datosVisita?.geoCoords,
          "datosVisita.tareasPendientes": Array.isArray(datosVisita?.tareasPendientes) ? datosVisita.tareasPendientes : [],
        },
      },
      { new: true }
    ).lean();
    if (!v) throw new Error("Visita no encontrada o sin permisos");
    return v;
  }

  async reprogramar({ id, rol, asesorCedula, fecha, hora, motivo }) {
    const query = { _id: id, isActive: true };
    if (rol === "comercial") query["asesor.cedula"] = asesorCedula;

    const v = await Visita.findOneAndUpdate(
      query,
      {
        $set: {
          estado: "reprogramada",
          fecha,
          hora,
          scheduledAt: buildScheduledAt(fecha, hora),
          motivoReprogramacion: motivo || "",
        },
      },
      { new: true }
    ).lean();
    if (!v) throw new Error("Visita no encontrada o sin permisos");
    return v;
  }
}

module.exports = new VisitaService();

