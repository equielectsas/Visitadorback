require("dotenv").config();

const dns = require("dns");
const express = require("express");
const cors = require("cors");
const { connect } = require("./db/mongoose");
const clientesRouter = require("./routes/clientes.router");
const authRouter = require("./routes/auth.router");
const visitasRouter = require("./routes/visitas.router");
const usuariosRouter = require("./routes/usuarios.router");
const notificacionesRouter = require("./routes/notificaciones.router");
const alertasTareasRouter = require("./routes/alertasTareas.router");
const { iniciarCronSync } = require("./jobs/syncERP.job");

// Node usa su propio resolver para mongodb+srv; en algunas redes el DNS local rechaza SRV.
dns.setServers(
  String(process.env.DNS_SERVERS || "8.8.8.8,1.1.1.1")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
);

const app = express();

app.use(express.json());

const corsOrigins = [process.env.FRONT_URL, process.env.CORS_FRONT].filter(Boolean);
app.use(
  cors({
    origin: corsOrigins.length ? corsOrigins : true,
    credentials: true,
  })
);

// ── Rutas ──
app.use("/api/auth", authRouter);
app.use("/api/clientes", clientesRouter);
app.use("/api/visitas", visitasRouter);
app.use("/api/usuarios", usuariosRouter);
app.use("/api/notificaciones", notificacionesRouter);
app.use("/api/alertas-tareas", alertasTareasRouter);

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 4000;

connect().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
    // Iniciar cron de sincronización (solo en producción o si está habilitado)
    if (process.env.ENABLE_CRON === "true") {
      iniciarCronSync();
    }
  });
});