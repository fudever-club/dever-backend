import { ErrorType } from "./../middlewares/errorHandler";
import { Request, Response, NextFunction } from "express";
import { Follow } from "../models/FollowModel";
import { User } from "../models/UserModel";

export const followOneUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId, followedId } = req.body;
    await User.findById(userId)
    await User.findById(followedId)
    const item = Follow.find({
        userId,
        followedId
    })
    console.log(item);
    
    const follow = await Follow.create({
      userId,
      followedId,
    });

    res.status(200).json({
      status: "success",
      data: { follow },
    });
  } catch (err) {
      return next(err);
  }
};
