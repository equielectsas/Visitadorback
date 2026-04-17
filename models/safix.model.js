const mongoose = require("mongoose");

const safixSchema = new mongoose.Schema(
  {
    token: { type: String, required: true },
  },
  {
    timestamps: true,
    // Ajusta este nombre si en tu BD la colección tiene otro nombre
    collection: "safix",
  }
);

module.exports = mongoose.model("Safix", safixSchema);