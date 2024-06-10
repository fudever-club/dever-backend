import { Request, Response, NextFunction } from 'express';
const jwt = require('jsonwebtoken');
import _ from 'lodash';
import { Leaderboard } from '../models/LeaderboardModel';
const axios = require('axios');

export const getLeaderBoard = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const users = await Leaderboard.find({})?.populate({
            path: 'userId',
            select: 'id firstname lastname avatar',
        });

        users.sort((a: any, b: any) => b.acSubmissionList.length - a.acSubmissionList.length);

        res.status(200).json({
            status: 'success',
            data: users,
        });
    } catch (error) {
        next(error);
    }
};

export const subcribeLeetcode = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const Authorization = req.header('authorization');
        if (!Authorization) {
            return res.status(400).json({
                error: {
                    statusCode: 400,
                    status: 'error',
                    message: 'Token is invalid',
                },
            });
        }
        const token = Authorization.replace('Bearer ', '');
        const { userId } = jwt.verify(token, process.env.APP_SECRET);

        const { leetcodeUsername } = req.body;

        let user = await Leaderboard.findOne({ userId });

        if (user) {
            user.leetcodeUsername = leetcodeUsername;
            user.acSubmissionList = [];
            await user.save(); // Lưu lại thông tin cập nhật
        } else {
            // Nếu user không tồn tại, tạo mới user
            user = await Leaderboard.create({
                userId,
                leetcodeUsername,
            });
        }

        res.status(200).json({
            status: 'success',
            data: user,
        });
    } catch (error) {
        next(error);
    }
};

export const getUserAcProblems = async (username: string) => {
    try {
        let data = JSON.stringify({
            query: `query recentAcSubmissions($username: String!, $limit: Int!) { recentAcSubmissionList(username: $username, limit: $limit) { id title titleSlug timestamp } }`,
            variables: { username: username, limit: 20 },
        });
        let config = {
            method: 'get',
            maxBodyLength: Infinity,
            url: 'https://leetcode.com/graphql/',
            headers: {
                'Content-Type': 'application/json',
            },
            data: data,
        };

        const response = await axios.request(config);

        const formatData = response?.data?.data?.recentAcSubmissionList.map((item: any) => {
            return {
                ...item,
                date: new Date(item.timestamp * 1000).toLocaleString(),
            };
        });

        return formatData;
    } catch (error) {
        return error;
    }
};

export const updateLeaderboard = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const users = await Leaderboard.find({});

        const updatePromises = users.map(async (user: any) => {
            const { leetcodeUsername, acSubmissionList } = user;

            const data = await getUserAcProblems(leetcodeUsername);

            const specificDate = new Date('2024-05-01');
            const specificDateTimestamp = specificDate.getTime() / 1000;

            const userCreationTimestamp = new Date(user?.createdAt).getTime() / 1000;

            const filteredData = data.filter(
                (submission: any) => parseInt(submission.timestamp) > specificDateTimestamp,
            );

            const existingSubmissions = new Map(acSubmissionList.map((submission: any) => [submission.id, submission]));
            filteredData.forEach((submission: any) => {
                if (!existingSubmissions.has(submission.id)) {
                    existingSubmissions.set(submission.id, submission);
                }
            });

            const mergedSubmissionList = Array.from(existingSubmissions.values());

            const query = { leetcodeUsername };

            const updateDocument = {
                $set: { acSubmissionList: mergedSubmissionList },
            };

            await Leaderboard.updateOne(query, updateDocument);

            return { leetcodeUsername, status: 'success', data: updateDocument };
        });

        await Promise.all(updatePromises);

        res.status(200).json({
            status: 'update complete',
        });
    } catch (error) {
        next(error);
    }
};
