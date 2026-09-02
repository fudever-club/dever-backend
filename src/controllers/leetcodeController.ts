import { Request, Response, NextFunction } from 'express';
const jwt = require('jsonwebtoken');
import _ from 'lodash';
import { Leaderboard } from '../models/LeaderboardModel';
import { User } from '../models/UserModel';
import { toPublicProfileKey } from '../Utils/userDto';
import { getJwtSecret } from '../config/auth';
const axios = require('axios');

export const getUserAcProblems = async (username: string) => {
    try {
        const data = JSON.stringify({
            query: `query recentAcSubmissions($username: String!, $limit: Int!) { recentAcSubmissionList(username: $username, limit: $limit) { id title titleSlug timestamp } }`,
            variables: { username, limit: 20 },
        });
        const config = {
            method: 'post',
            maxBodyLength: Infinity,
            url: 'https://leetcode.com/graphql/',
            headers: {
                'Content-Type': 'application/json',
            },
            data,
        };

        const response = await axios.request(config);

        const formatData =
            response?.data?.data?.recentAcSubmissionList?.map((item: any) => {
                return {
                    ...item,
                    date: new Date(Number(item.timestamp) * 1000).toISOString(),
                };
            }) || [];

        return formatData;
    } catch (error) {
        console.error('Leetcode GraphQL query failed:', error);
        return [];
    }
};

export const getLeaderBoard = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const users = await Leaderboard.find({}).populate({
            path: 'userId',
            select: 'id firstname lastname avatar',
        });

        users.sort((a: any, b: any) => (b.acSubmissionList?.length || 0) - (a.acSubmissionList?.length || 0));

        const leaderboard = users.map((entry: any) => ({
            leetcodeUsername: entry.leetcodeUsername,
            acSubmissionList: entry.acSubmissionList || [],
            user: entry.userId
                ? {
                      firstname: entry.userId.firstname || null,
                      lastname: entry.userId.lastname || null,
                      avatar: entry.userId.avatar || null,
                      profileKey: toPublicProfileKey(entry.userId),
                  }
                : null,
        }));

        res.status(200).json({
            status: 'success',
            data: leaderboard,
        });
    } catch (error) {
        next(error);
    }
};

export const subcribeLeetcode = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const Authorization = req.header('authorization');
        if (!Authorization) {
            return res.status(401).json({
                error: {
                    statusCode: 401,
                    status: 'error',
                    message: 'Token is required',
                },
            });
        }
        const token = Authorization.replace('Bearer ', '');
        const { userId } = jwt.verify(token, getJwtSecret());

        const { leetcodeUsername } = req.body;
        const cleanUsername = typeof leetcodeUsername === 'string' ? leetcodeUsername.trim() : '';

        if (!cleanUsername) {
            return res.status(400).json({
                status: 'error',
                message: 'Vui lòng nhập LeetCode username hợp lệ',
            });
        }

        // Fetch recent problems immediately from LeetCode
        let acSubmissions: any[] = [];
        try {
            const fetched = await getUserAcProblems(cleanUsername);
            if (Array.isArray(fetched)) {
                acSubmissions = fetched;
            }
        } catch (e) {
            console.error('LeetCode sync error:', e);
        }

        let entry = await Leaderboard.findOne({ userId });

        if (entry) {
            entry.leetcodeUsername = cleanUsername;
            if (acSubmissions.length > 0) {
                entry.acSubmissionList = acSubmissions;
            }
            await entry.save();
        } else {
            entry = await Leaderboard.create({
                userId,
                leetcodeUsername: cleanUsername,
                acSubmissionList: acSubmissions,
            });
        }

        // Also update User document
        await User.findByIdAndUpdate(userId, { leetcodeUsername: cleanUsername });

        res.status(200).json({
            status: 'success',
            data: {
                userId,
                leetcodeUsername: cleanUsername,
                acSubmissionList: entry.acSubmissionList || [],
            },
        });
    } catch (error) {
        next(error);
    }
};

export const updateLeaderboard = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const users = await Leaderboard.find({});

        const updatePromises = users.map(async (user: any) => {
            const { leetcodeUsername, acSubmissionList = [] } = user;
            if (!leetcodeUsername) return null;

            const data = await getUserAcProblems(leetcodeUsername);

            const specificDate = new Date('2024-05-01');
            const specificDateTimestamp = specificDate.getTime() / 1000;

            const filteredData = data.filter(
                (submission: any) => parseInt(submission.timestamp, 10) > specificDateTimestamp,
            );

            const existingSubmissions = new Map(acSubmissionList.map((submission: any) => [submission.id, submission]));
            filteredData.forEach((submission: any) => {
                if (!existingSubmissions.has(submission.id)) {
                    existingSubmissions.set(submission.id, submission);
                }
            });

            const mergedSubmissionList = Array.from(existingSubmissions.values());

            const uniqueSubmissions: any = [];
            const seenSlugs = new Set();

            mergedSubmissionList.forEach((submission: any) => {
                if (!seenSlugs.has(submission.titleSlug)) {
                    uniqueSubmissions.push(submission);
                    seenSlugs.add(submission.titleSlug);
                }
            });

            const updateDocument = {
                $set: { acSubmissionList: uniqueSubmissions },
            };

            await Leaderboard.updateOne({ leetcodeUsername }, updateDocument);

            return { leetcodeUsername, status: 'success', data: updateDocument };
        });

        await Promise.all(updatePromises.filter(Boolean));

        res.status(200).json({
            status: 'success',
            message: 'Cập nhật bảng xếp hạng LeetCode thành công',
        });
    } catch (error) {
        next(error);
    }
};
