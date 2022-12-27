import {ErrorType} from "./middlewares/errorHandler"
//dotenv
require('dotenv').config();

//connect BD
const {connectDB} = require('./config/db');
connectDB()

const authRoute = require("./routes/authRoute")
const followRoute = require("./routes/followRoute")
const { errorHandler } = require("./middlewares/errorHandler");


import express from "express";
import cors from "cors";

const app = express();
const port = process.env.APP_PORT || 5000;

//cors
app.use(cors());

//bodyParser
app.use(express.json());

app.use("/api/v1/auth", authRoute)
app.use("/api/v1/follow", followRoute)

app.all("*", (req, res, next) => {
  const err: ErrorType = new Error("Unhandled Route");
  err.statusCode = 404;
  next(err);
});
app.use("/api/v1/auth", errorHandler)

app.listen(port, () => {
  console.log(`connected to port successfully http://localhost:${port}/ `);
});
