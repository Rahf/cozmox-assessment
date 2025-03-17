const dotenv = require("dotenv");
dotenv.config();

const express = require("express");
const bodyParser = require("body-parser");
const nodemailer = require("nodemailer");
const Queue = require("bull");
const cors = require("cors");

const { AppDataSource, initializeDatabase } = require("./db/db");

const authRoutes = require("./routes/auth.routes");
const emailRoutes = require("./routes/email.routes");

const app = express();
app.use(bodyParser.json());
app.use(cors());

const { PORT } = process.env;

initializeDatabase().then(() => {
    app.use("/auth", authRoutes);
    app.use("/email", emailRoutes);
});

app.listen(PORT, () => console.log(`server running on ${PORT}`));
