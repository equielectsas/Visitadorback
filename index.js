require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { connect } = require("./db/mongoose");
const clientesRouter = require("./routes/clientes.router");
const authRouter = require("./routes/auth.router");
const visitasRouter = require("./routes/visitas.router");
const { iniciarCronSync } = require("./jobs/syncERP.job");

const app = express();

app.use(express.json());

app.use(
  cors({
    origin: process.env.FRONT_URL,
    credentials: true,
  })
);

// ── Rutas ──
app.use("/api/auth", authRouter);
app.use("/api/clientes", clientesRouter);
app.use("/api/visitas", visitasRouter);

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