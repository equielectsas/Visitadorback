const Cliente = require("../models/cliente.model");

// ──────────────────────────────────────────────────────────────────────────────
// SERVICIO DE CLIENTES
// Centraliza toda la lógica de negocio: sync ERP, creación manual, duplicados
// ──────────────────────────────────────────────────────────────────────────────

class ClienteService {
  // ────────────────────────────────────────
  // 0. STATS / STATUS
  // ────────────────────────────────────────
  /**
   * Estadísticas rápidas para dashboard / sync status.
   * @returns {Promise<{total:number, erp:number, manual:number, ultimaSync:Date|null}>}
   */
  async stats() {
    const [counts] = await Cliente.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          erp: { $sum: { $cond: [{ $eq: ["$source", "ERP"] }, 1, 0] } },
          manual: { $sum: { $cond: [{ $eq: ["$source", "MANUAL"] }, 1, 0] } },
          ultimaSync: { $max: "$lastSyncAt" },
        },
      },
      { $project: { _id: 0, total: 1, erp: 1, manual: 1, ultimaSync: 1 } },
    ]);

    return (
      counts || {
        total: 0,
        erp: 0,
        manual: 0,
        ultimaSync: null,
      }
    );
  }

  // ────────────────────────────────────────
  // 1. SINCRONIZACIÓN CON ERP (INCREMENTAL)
  // ────────────────────────────────────────
  /**
   * Recibe el array de clientes del ERP y los sincroniza en MongoDB.
   * - Si no existe: crea el documento
   * - Si existe: actualiza campos ERP sin tocar customData
   * - Si existía como prospecto manual: lo "convierte" a ERP
   *
   * @param {Array} erpClientes - Array de objetos del ERP
   * @returns {Object} resultado con contadores
   */
  async sincronizarDesdeERP(erpClientes) {
    const resultado = {
      creados: 0,
      actualizados: 0,
      convertidos: 0,
      errores: [],
    };

    // Optimización: 2 consultas + 1 bulkWrite por lote
    const items = Array.isArray(erpClientes) ? erpClientes : [];
    const uniqueKeys = [];
    const nits = [];

    for (const item of items) {
      if (!item?.nit) continue;
      uniqueKeys.push(Cliente.generarKeyERP(item.nit, item.sucursal));
      nits.push(String(item.nit).trim());
    }

    const [existentesERP, prospectosManual] = await Promise.all([
      Cliente.find({ uniqueKey: { $in: uniqueKeys } }).select("_id uniqueKey").lean(),
      Cliente.find({
        identificacion: { $in: nits },
        source: "MANUAL",
        isProspect: true,
      })
        .select("_id identificacion")
        .lean(),
    ]);

    const mapERP = new Map(existentesERP.map((d) => [d.uniqueKey, d]));
    const mapProspecto = new Map(
      prospectosManual.map((d) => [String(d.identificacion).trim(), d])
    );

    const ops = [];
    const now = new Date();

    for (const item of items) {
      try {
        const { nit, sucursal, razonSocial, direccion, telefono, nombreCiudad, codigoCiudad } =
          item || {};

        if (!nit) throw new Error("nit es obligatorio en el ERP");

        const uniqueKey = Cliente.generarKeyERP(nit, sucursal);
        const nitStr = String(nit).trim();
        const grupoEmpresarial = nitStr.toUpperCase();

        // Campos que vienen del ERP (nunca customData)
        const camposERP = {
          identificacion: nitStr,
          razonSocial: razonSocial || undefined,
          nombrePunto: `Sede ${sucursal}`,
          ciudad: nombreCiudad || undefined,
          codigoCiudad: codigoCiudad || undefined,
          direccion: direccion || undefined,
          telefono: telefono || undefined,
          grupoEmpresarial,
          uniqueKey,
          source: "ERP",
          isProspect: false,
          lastSyncAt: now,
          erpData: {
            sucursal: item.sucursal,
            tipodocumento: item.tipodocumento,
            naturaleza: item.naturaleza,
            tipoCliente: item.tipoCliente,
            fechaContacto: item.fechaContacto ? new Date(item.fechaContacto) : undefined,
            formaPago: item.formaPago,
            codigoCiudad: item.codigoCiudad,
            barrio: item.barrio,
            Valores: item.Valores || [],
            HistoricoValores: item.HistoricoValores || [],
            Telefonos: item.Telefonos || [],
            Direcciones: item.Direcciones || [],
            Actividad: item.Actividad || [],
            Estados: item.Estados || [],
          },
        };

        const existePorKey = mapERP.get(uniqueKey);
        if (existePorKey) {
          ops.push({
            updateOne: {
              filter: { _id: existePorKey._id },
              update: { $set: camposERP },
            },
          });
          resultado.actualizados++;
          continue;
        }

        const prospectoManual = mapProspecto.get(nitStr);
        if (prospectoManual) {
          ops.push({
            updateOne: {
              filter: { _id: prospectoManual._id },
              update: { $set: camposERP },
            },
          });
          resultado.convertidos++;
          continue;
        }

        // upsert por uniqueKey (si alguien creó mientras tanto, igual queda actualizado)
        ops.push({
          updateOne: {
            filter: { uniqueKey },
            update: { $setOnInsert: camposERP },
            upsert: true,
          },
        });
        resultado.creados++;
      } catch (err) {
        resultado.errores.push({
          nit: item?.nit,
          sucursal: item?.sucursal,
          error: err.message,
        });
      }
    }

    if (ops.length > 0) {
      await Cliente.bulkWrite(ops, { ordered: false });
    }

    return resultado;
  }

  /**
   * Procesa un ítem individual del ERP.
   */
  async _procesarItemERP(item, resultado) {
    const { nit, sucursal, razonSocial, direccion, telefono, nombreCiudad, codigoCiudad } = item;

    if (!nit) throw new Error("nit es obligatorio en el ERP");

    const uniqueKey = Cliente.generarKeyERP(nit, sucursal);
    const grupoEmpresarial = String(nit).trim().toUpperCase();

    // Campos que vienen del ERP (nunca customData)
    const camposERP = {
      identificacion: String(nit).trim(),
      razonSocial: razonSocial || undefined,
      nombrePunto: `Sede ${sucursal}`,
      ciudad: nombreCiudad || undefined,
      codigoCiudad: codigoCiudad || undefined,
      direccion: direccion || undefined,
      telefono: telefono || undefined,
      grupoEmpresarial,
      source: "ERP",
      isProspect: false,
      lastSyncAt: new Date(),
      erpData: {
        sucursal: item.sucursal,
        tipodocumento: item.tipodocumento,
        naturaleza: item.naturaleza,
        tipoCliente: item.tipoCliente,
        fechaContacto: item.fechaContacto ? new Date(item.fechaContacto) : undefined,
        formaPago: item.formaPago,
        codigoCiudad: item.codigoCiudad,
        barrio: item.barrio,
        Valores: item.Valores || [],
        HistoricoValores: item.HistoricoValores || [],
        Telefonos: item.Telefonos || [],
        Direcciones: item.Direcciones || [],
        Actividad: item.Actividad || [],
        Estados: item.Estados || [],
      },
    };

    // ── Buscar por uniqueKey (sede exacta del ERP) ──
    const existePorKey = await Cliente.findOne({ uniqueKey });

    if (existePorKey) {
      // Actualizar solo campos ERP, NO tocar customData
      await Cliente.findByIdAndUpdate(existePorKey._id, {
        $set: camposERP,
      });
      resultado.actualizados++;
      return;
    }

    // ── Buscar si hay un prospecto manual con la misma identificación ──
    const prospectoManual = await Cliente.findOne({
      identificacion: String(nit).trim(),
      source: "MANUAL",
      isProspect: true,
    });

    if (prospectoManual) {
      // Convertir prospecto en cliente real ERP, conservando customData
      await Cliente.findByIdAndUpdate(prospectoManual._id, {
        $set: {
          ...camposERP,
          uniqueKey, // actualizar a key ERP
        },
        // customData NO se toca (no está en $set)
      });
      resultado.convertidos++;
      return;
    }

    // ── Crear nueva sede ──
    await Cliente.create({
      ...camposERP,
      uniqueKey,
    });
    resultado.creados++;
  }

  // ────────────────────────────────────────
  // 2. CREAR CLIENTE MANUAL
  // ────────────────────────────────────────
  /**
   * Crea un prospecto manual.
   * Valida identificación obligatoria y evita duplicados.
   *
   * @param {Object} datos - Datos del formulario
   * @param {Object} erpCheck - Resultado previo de búsqueda en ERP (opcional)
   */
  async crearClienteManual(datos) {
    const { identificacion, razonSocial, ciudad, direccion, telefono, customData } = datos;

    if (!identificacion) {
      throw new Error("La identificación es obligatoria");
    }

    // Verificar duplicado local
    const duplicadoLocal = await this.buscarDuplicados(identificacion, razonSocial, ciudad);
    if (duplicadoLocal.length > 0) {
      const err = new Error("Ya existe un cliente con datos similares en la base local");
      err.code = "DUPLICATE_LOCAL";
      err.datos = duplicadoLocal;
      throw err;
    }

    const uniqueKey = Cliente.generarKeyManual(identificacion, razonSocial, ciudad);
    const grupoEmpresarial = String(identificacion).trim().toUpperCase();

    const nuevo = await Cliente.create({
      identificacion: String(identificacion).trim(),
      tipoDocumento: datos.tipoDocumento || "CC",
      razonSocial: razonSocial || undefined,
      nombrePunto: datos.nombrePunto || undefined,
      ciudad: ciudad || undefined,
      direccion: direccion || undefined,
      telefono: telefono || undefined,
      grupoEmpresarial,
      uniqueKey,
      source: "MANUAL",
      isProspect: true,
      customData: customData || {},
    });

    return nuevo;
  }

  // ────────────────────────────────────────
  // 3. DETECCIÓN DE DUPLICADOS
  // ────────────────────────────────────────
  /**
   * Busca posibles duplicados por identificacion o nombre similar.
   */
  async buscarDuplicados(identificacion, razonSocial = "", ciudad = "") {
    const queries = [{ identificacion: String(identificacion).trim() }];

    if (razonSocial) {
      queries.push({
        razonSocial: { $regex: new RegExp(razonSocial.slice(0, 10), "i") },
      });
    }

    return Cliente.find({ $or: queries }).select(
      "identificacion razonSocial ciudad source isProspect uniqueKey"
    );
  }

  /**
   * Verifica si una identificación ya existe en el ERP local.
   * Devuelve las sedes del ERP para ese NIT.
   */
  async verificarEnERPLocal(identificacion) {
    return Cliente.find({
      identificacion: String(identificacion).trim(),
      source: "ERP",
    }).select("identificacion razonSocial nombrePunto ciudad direccion uniqueKey");
  }

  // ────────────────────────────────────────
  // 4. LISTAR / BUSCAR CLIENTES
  // ────────────────────────────────────────
  /**
   * Lista clientes con paginación y filtros.
   */
  async listar({ page = 1, limit = 20, search = "", source, isProspect, ciudad, grupoEmpresarial } = {}) {
    const skip = (page - 1) * limit;
    const query = { isActive: true };

    if (search) {
      query.$or = [
        { identificacion: { $regex: search, $options: "i" } },
        { razonSocial: { $regex: search, $options: "i" } },
        { nombrePunto: { $regex: search, $options: "i" } },
        { ciudad: { $regex: search, $options: "i" } },
      ];
    }

    if (source) query.source = source;
    if (isProspect !== undefined) query.isProspect = isProspect;
    if (ciudad) query.ciudad = { $regex: ciudad, $options: "i" };
    if (grupoEmpresarial) query.grupoEmpresarial = grupoEmpresarial;

    const [clientes, total] = await Promise.all([
      Cliente.find(query)
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 })
        .lean(),
      Cliente.countDocuments(query),
    ]);

    return {
      clientes,
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }

  /**
   * Obtiene todas las sedes de un grupo empresarial.
   */
  async sedesPorGrupo(grupoEmpresarial) {
    return Cliente.find({
      grupoEmpresarial: String(grupoEmpresarial).trim().toUpperCase(),
      isActive: true,
    }).sort({ source: 1, nombrePunto: 1 }).lean();
  }

  /**
   * Obtiene un cliente por ID.
   */
  async obtenerPorId(id) {
    return Cliente.findById(id).lean();
  }

  // ────────────────────────────────────────
  // 5. CONVERTIR PROSPECTO A CLIENTE REAL
  // ────────────────────────────────────────
  /**
   * Convierte manualmente un prospecto en cliente real
   * vinculándolo a una sede ERP existente.
   */
  async convertirProspecto(prospectoId, sedeErpId) {
    const prospecto = await Cliente.findById(prospectoId);
    if (!prospecto) throw new Error("Prospecto no encontrado");
    if (!prospecto.isProspect) throw new Error("El cliente ya no es prospecto");

    const sedeERP = await Cliente.findById(sedeErpId);
    if (!sedeERP || sedeERP.source !== "ERP") throw new Error("Sede ERP no válida");

    // Actualizar el prospecto con datos ERP
    await Cliente.findByIdAndUpdate(prospectoId, {
      $set: {
        identificacion: sedeERP.identificacion,
        razonSocial: sedeERP.razonSocial,
        nombrePunto: sedeERP.nombrePunto,
        ciudad: sedeERP.ciudad,
        direccion: sedeERP.direccion,
        telefono: sedeERP.telefono,
        grupoEmpresarial: sedeERP.grupoEmpresarial,
        uniqueKey: sedeERP.uniqueKey,
        source: "ERP",
        isProspect: false,
        erpData: sedeERP.erpData,
        lastSyncAt: new Date(),
      },
    });

    // Eliminar la sede ERP duplicada
    await Cliente.findByIdAndDelete(sedeErpId);

    return Cliente.findById(prospectoId).lean();
  }

  // ────────────────────────────────────────
  // 6. ACTUALIZAR customData
  // ────────────────────────────────────────
  async actualizarCustomData(id, customData) {
    return Cliente.findByIdAndUpdate(
      id,
      { $set: { customData } },
      { new: true }
    ).lean();
  }

  // ────────────────────────────────────────
  // 7. DESACTIVAR (soft delete)
  // ────────────────────────────────────────
  async desactivar(id) {
    return Cliente.findByIdAndUpdate(id, { isActive: false }, { new: true }).lean();
  }
}

module.exports = new ClienteService();