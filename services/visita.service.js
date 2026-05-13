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

function fechaHoraLocalDesdeDate(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return { fecha: `${y}-${m}-${day}`, hora: `${hh}:${mm}` };
}

function isAdminRole(rol) {
  return rol === "adminPlataforma" || rol === "adminComercial";
}

function applyAuthScope(query, rol, asesorCedula) {
  if (rol === "comercial") query["asesor.cedula"] = asesorCedula;
  return query;
}

function pickDefined(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}

class VisitaService {
  async buildClientePatch({ clienteId, clienteCrear, datosVisita = {} } = {}) {
    let finalClienteId = clienteId;
    if (!finalClienteId && clienteCrear) {
      const nuevo = await clienteService.crearClienteManual(clienteCrear);
      finalClienteId = nuevo._id;
    }
    if (!finalClienteId) return {};

    const cliente = await Cliente.findById(finalClienteId)
      .select("_id identificacion razonSocial nombrePunto direccion ciudad telefono")
      .lean();
    if (!cliente) throw new Error("Cliente no encontrado");

    const nombreEmpresa =
      datosVisita.nombreEmpresa ||
      (cliente.nombrePunto
        ? `${cliente.razonSocial || ""} - ${cliente.nombrePunto}`.trim()
        : cliente.razonSocial);

    return pickDefined({
      clienteId: finalClienteId,
      "datosVisita.nit": datosVisita.nit ?? cliente.identificacion,
      "datosVisita.nombreEmpresa": nombreEmpresa || `Cliente ${cliente.identificacion || ""}`.trim(),
      "datosVisita.direccionEmpresa": datosVisita.direccionEmpresa ?? cliente.direccion,
      "datosVisita.municipio": datosVisita.municipio ?? cliente.ciudad,
    });
  }

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

  async finalizar({
    id,
    rol,
    asesorCedula,
    datosVisita,
    estadoFinal = "realizada",
    fecha: fechaBody,
    hora: horaBody,
  }) {
    const query = { _id: id, isActive: true };
    if (rol === "comercial") query["asesor.cedula"] = asesorCedula;

    const fallback = fechaHoraLocalDesdeDate(new Date());
    const fecha =
      typeof fechaBody === "string" && fechaBody.trim() ? fechaBody.trim() : fallback.fecha;
    const hora =
      typeof horaBody === "string" && horaBody.trim() ? horaBody.trim() : fallback.hora;
    const scheduledAt = buildScheduledAt(fecha, hora);

    const v = await Visita.findOneAndUpdate(
      query,
      {
        $set: {
          estado: estadoFinal,
          finishedAt: new Date(),
          fecha,
          hora,
          ...(scheduledAt ? { scheduledAt } : {}),
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

  async reprogramar({ id, rol, asesorCedula, fecha, hora, motivo, clienteId, clienteCrear, datosVisita = {} }) {
    const query = { _id: id, isActive: true };
    if (rol === "comercial") query["asesor.cedula"] = asesorCedula;

    const existing = await Visita.findOne(query).lean();
    if (!existing) throw new Error("Visita no encontrada o sin permisos");
    if (existing.estado === "realizada" && !isAdminRole(rol)) {
      throw new Error("Solo un administrador puede reprogramar una visita realizada");
    }

    const clientePatch = await this.buildClientePatch({ clienteId, clienteCrear, datosVisita });
    const nextFecha = typeof fecha === "string" && fecha.trim() ? fecha.trim() : existing.fecha;
    const nextHora = typeof hora === "string" && hora.trim() ? hora.trim() : existing.hora;
    const scheduledAt = buildScheduledAt(nextFecha, nextHora);

    const v = await Visita.findOneAndUpdate(
      query,
      {
        $set: pickDefined({
          estado: existing.estado === "realizada" ? existing.estado : "reprogramada",
          fecha: nextFecha,
          hora: nextHora,
          ...(scheduledAt ? { scheduledAt } : {}),
          motivoReprogramacion: motivo || "",
          "datosVisita.nit": datosVisita.nit,
          "datosVisita.nombreEmpresa": datosVisita.nombreEmpresa,
          "datosVisita.direccionEmpresa": datosVisita.direccionEmpresa,
          "datosVisita.municipio": datosVisita.municipio,
          ...clientePatch,
        }),
      },
      { new: true }
    ).lean();
    if (!v) throw new Error("Visita no encontrada o sin permisos");
    return v;
  }

  async editar({ id, rol, asesorCedula, fecha, hora, clienteId, clienteCrear, datosVisita = {}, motivo }) {
    const query = applyAuthScope({ _id: id, isActive: true }, rol, asesorCedula);
    const existing = await Visita.findOne(query).lean();
    if (!existing) throw new Error("Visita no encontrada o sin permisos");
    if (existing.estado === "realizada" && !isAdminRole(rol)) {
      throw new Error("Solo un administrador puede editar una visita realizada");
    }

    const nextFecha = typeof fecha === "string" && fecha.trim() ? fecha.trim() : existing.fecha;
    const nextHora = typeof hora === "string" && hora.trim() ? hora.trim() : existing.hora;
    const scheduledAt = buildScheduledAt(nextFecha, nextHora);

    const set = pickDefined({
      fecha: nextFecha,
      hora: nextHora,
      ...(scheduledAt ? { scheduledAt } : {}),
      ...(motivo !== undefined ? { motivoReprogramacion: motivo || "" } : {}),
      "datosVisita.nit": datosVisita.nit,
      "datosVisita.nombreEmpresa": datosVisita.nombreEmpresa,
      "datosVisita.direccionEmpresa": datosVisita.direccionEmpresa,
      "datosVisita.municipio": datosVisita.municipio,
      "datosVisita.tipoVisita": datosVisita.tipoVisita,
      "datosVisita.tipoVehiculo": datosVisita.tipoVehiculo,
      "datosVisita.nombreEncargado": datosVisita.nombreEncargado,
      "datosVisita.cargoEncargado": datosVisita.cargoEncargado,
      "datosVisita.observaciones": datosVisita.observaciones,
      "datosVisita.geoCoords": datosVisita.geoCoords,
      "datosVisita.tareasPendientes": Array.isArray(datosVisita.tareasPendientes) ? datosVisita.tareasPendientes : undefined,
    });

    const clientePatch = await this.buildClientePatch({ clienteId, clienteCrear, datosVisita });
    Object.assign(set, clientePatch);

    const v = await Visita.findOneAndUpdate(query, { $set: set }, { new: true }).lean();
    if (!v) throw new Error("Visita no encontrada o sin permisos");
    return v;
  }

  async eliminar({ id, rol, asesorCedula }) {
    const query = applyAuthScope({ _id: id, isActive: true }, rol, asesorCedula);
    const existing = await Visita.findOne(query).lean();
    if (!existing) throw new Error("Visita no encontrada o sin permisos");
    if (existing.estado === "realizada" && !isAdminRole(rol)) {
      throw new Error("Solo un administrador puede eliminar una visita realizada");
    }
    const v = await Visita.findOneAndUpdate(
      query,
      { $set: { isActive: false } },
      { new: true }
    ).lean();
    if (!v) throw new Error("Visita no encontrada o sin permisos");
    return v;
  }

  async actualizarTareasPendientes({ id, rol, asesorCedula, tareasPendientes }) {
    const query = { _id: id, isActive: true };
    if (rol === "comercial") query["asesor.cedula"] = asesorCedula;

    const existing = await Visita.findOne(query).lean();
    if (!existing) throw new Error("Visita no encontrada o sin permisos");
    const prevTasks = Array.isArray(existing.datosVisita?.tareasPendientes)
      ? existing.datosVisita.tareasPendientes
      : [];

    const safe = Array.isArray(tareasPendientes)
      ? tareasPendientes
          .filter((t) => t && typeof t === "object")
          .map((t, i) => {
            const texto = String(t.texto || "").trim();
            const done = Boolean(t.done);
            const prev = prevTasks[i] || {};
            let marcadaPorAsesorAt = prev.marcadaPorAsesorAt || null;
            if (rol === "comercial") {
              if (done && !prev.done) marcadaPorAsesorAt = new Date();
              if (!done) marcadaPorAsesorAt = null;
            }
            const item = { texto, done };
            if (marcadaPorAsesorAt) item.marcadaPorAsesorAt = marcadaPorAsesorAt;
            return item;
          })
          .filter((t) => t.texto)
      : [];

    const v = await Visita.findOneAndUpdate(
      query,
      { $set: { "datosVisita.tareasPendientes": safe } },
      { new: true }
    ).lean();
    if (!v) throw new Error("Visita no encontrada o sin permisos");
    return v;
  }
}

module.exports = new VisitaService();

