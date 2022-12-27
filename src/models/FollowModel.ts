const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
import { Request, Response, NextFunction } from "express";

const followSchema = mongoose.Schema(
  {
    userId: {
      type: String,
    //   unique: true
    },
    followedId: {
      type: String,
    //   unique: true
    },
  },
  { timestamps: true }
);

export const Follow = mongoose.model("Follow", followSchema);
