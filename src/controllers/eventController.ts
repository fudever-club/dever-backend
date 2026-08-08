import { Request, Response, NextFunction } from 'express';
import { Event } from '../models/EventModel';

export const getAllEvents = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const events = await Event.find().sort({ createdAt: -1 });
        res.status(200).json({
            status: 'success',
            results: events.length,
            data: events,
        });
    } catch (error) {
        next(error);
    }
};

export const createEvent = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const event = await Event.create(req.body);
        res.status(201).json({
            status: 'success',
            data: event,
        });
    } catch (error) {
        next(error);
    }
};

export const deleteEvent = async (req: Request, res: Response, next: NextFunction) => {
    try {
        await Event.findByIdAndDelete(req.params.id);
        res.status(200).json({
            status: 'success',
            message: 'Event deleted successfully',
        });
    } catch (error) {
        next(error);
    }
};
