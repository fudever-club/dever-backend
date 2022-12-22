import { ErrorType } from "./../middlewares/errorHandler";
import { Request, Response, NextFunction } from "express";
import { User } from "../models/UserModel";
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = await User.create(req.body);
    const token = jwt.sign(user._id.toJSON(), "efwef");
    res.status(200).json({
      status: "success",
      data: {
        token,
        user,
      },
    });
    res.json("User registered");
  } catch (err) {
    next(err)
  }
};
export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    if (!user) {
      //Error: Email is not correct
      const err: ErrorType = new Error("Email is not valid");
      err.status = 400;
      return next(err);
    }
    if (bcrypt.compareSync(req.body.password, user.password)) {
      const token = jwt.sign({ userId: user._id }, process.env.APP_SECRET);
      const { fullname, email } = user;

      res.status(200).json({
        status: "success",
        data: {
          // userName: name,
          user: {
            fullname,
            email,
          },
          token,
        },
      });
    } else {
      const err: ErrorType = new Error("Password is not correct");
      err.status = 400;
      return next(err);
    }
  } catch (error) {}
};
