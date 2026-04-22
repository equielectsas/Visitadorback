require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { connect } = require("./db/mongoose");  // <-- agrega src/
const clientesRouter = require("./routes/clientes.router");
const authRouter = require("./routes/auth.router");  // <-- agrega src/

const app = express();

app.use(express.json());

app.use(
  cors({
    origin: process.env.FRONT_URL,
    credentials: true,
  })
);

app.use("/api/auth", authRouter);

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/clientes", clientesRouter);

const PORT = process.env.PORT || 4000;

connect().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
  });
});