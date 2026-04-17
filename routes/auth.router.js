const express = require("express");
const AuthController = require("../controllers/auth.controller");
const authSafixHandler = require("../middlewares/authSafix.handler");

const router = express.Router();
const authController = new AuthController();

// POST /api/auth/login
router.post("/login", authSafixHandler(), authController.loginPassword);

module.exports = router;