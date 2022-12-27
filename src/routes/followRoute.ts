import express from "express";
import { followOneUser } from "../controllers/followController";

const Router = express.Router();
Router.route("/").post(followOneUser);

module.exports = Router;
