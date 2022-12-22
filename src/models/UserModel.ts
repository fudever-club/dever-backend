const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
import { Request, Response, NextFunction } from "express";

const userSchema = mongoose.Schema(
  {
    fullname: {
      type: String,
      required: [true, "Name must be required"],
      trim: true,
    },
    email: {
      type: String,
      unique: true,
      required: [true, "Email must be required"],
      trim: true,
    },
    password: {
      type: String,
      required: [true, "Password must be required"],
      minLength: [6, "Password must be at least 6 characters"],
      trim: true,
    },
  },
  { timestamps: true }
);

userSchema.pre("save", function (this: any, next: NextFunction) {
  let user = this
  bcrypt.hash(user.password, 10, function (err: Error, hash: string){
    if(err) {
      return next(err);
    }else{
      user.password = hash;
      next();
    }
  })
});

export const User = mongoose.model("User", userSchema);
