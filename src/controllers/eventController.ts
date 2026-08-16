import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import crypto from 'crypto';
import { Event } from '../models/EventModel';
import { EventRegistration } from '../models/EventRegistrationModel';
import { User } from '../models/UserModel';
import { createNotification } from '../services/notificationService';
import { sendTelegramMessage } from '../services/telegramService';

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

export const getEventById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const event = await Event.findById(req.params.id);
        if (!event) {
            return res.status(404).json({ status: 'error', message: 'Event not found' });
        }
        res.status(200).json({ status: 'success', data: event });
    } catch (error) {
        next(error);
    }
};

export const createEvent = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (req.body.isFeatured) {
            await Event.updateMany({}, { isFeatured: false });
        }
        const event = await Event.create(req.body);
        res.status(201).json({
            status: 'success',
            data: event,
        });
    } catch (error) {
        next(error);
    }
};

export const updateEvent = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (req.body.isFeatured) {
            await Event.updateMany({ _id: { $ne: req.params.id } }, { isFeatured: false });
        }
        const event = await Event.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true,
        });
        if (!event) {
            return res.status(404).json({ status: 'error', message: 'Không tìm thấy sự kiện' });
        }
        res.status(200).json({
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
        await EventRegistration.deleteMany({ eventId: req.params.id });
        res.status(200).json({
            status: 'success',
            message: 'Event and related registrations deleted successfully',
        });
    } catch (error) {
        next(error);
    }
};

/**
 * 1. Register for an Event (1-Click for Logged-in member or Guest form)
 */
export const registerEvent = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const eventId = req.params.id;
        const userId = res.locals.auth?.userId;

        const event = await Event.findById(eventId);
        if (!event) {
            return res.status(404).json({ status: 'error', message: 'Không tìm thấy sự kiện' });
        }

        let userName = (req.body.name || '').trim();
        let userEmail = (req.body.email || '').trim().toLowerCase();
        let userPhone = (req.body.phone || '').trim();
        let userMSSV = (req.body.mssv || '').trim();

        if (userId) {
            const user = await User.findById(userId);
            if (user) {
                userName = [user.firstname, user.lastname].filter(Boolean).join(' ') || user.nickname || userName;
                userEmail = user.email || userEmail;
                userPhone = user.phone || userPhone;
                userMSSV = user.MSSV || userMSSV;
            }
        }

        if (!userName || !userEmail) {
            return res.status(400).json({
                status: 'error',
                message: 'Vui lòng cung cấp đầy đủ Họ tên và Email để nhận vé tham dự',
            });
        }

        // Check if already registered
        const existing = await EventRegistration.findOne({ eventId, userEmail });
        if (existing) {
            return res.status(200).json({
                status: 'success',
                message: 'Bạn đã đăng ký tham gia sự kiện này trước đó!',
                data: existing,
            });
        }

        // Generate unique Ticket Code & QR payload
        const randomCode = crypto.randomBytes(3).toString('hex').toUpperCase();
        const ticketCode = `DEVER-EVT-${randomCode}`;
        const qrData = JSON.stringify({
            eventId: event._id.toString(),
            ticketCode,
            userEmail,
            eventTitle: event.title,
        });

        const registration = await EventRegistration.create({
            eventId: event._id,
            userId: userId ? new mongoose.Types.ObjectId(userId) : null,
            userName,
            userEmail,
            userPhone,
            userMSSV,
            ticketCode,
            qrData,
            status: 'registered',
        });

        // In-App Notification if user is logged in
        if (userId) {
            createNotification({
                recipientId: userId,
                type: 'event_created',
                title: `Đăng ký vé thành công: ${event.title} 🎟️`,
                message: `Bạn đã nhận vé tham gia "${event.title}". Mã vé: ${ticketCode}. Hãy xuất trình mã QR khi đến bàn check-in!`,
                link: '/vi/dashboard',
                meta: { eventId: event._id, ticketCode },
            }).catch((e) => console.warn('Event notification error:', e));
        }

        // Alert Admin on Telegram
        const telegramMsg = `
🎟️ <b>[FU-DEVER EVENT] CÓ NGƯỜI ĐĂNG KÝ SỰ KIỆN!</b>

📌 <b>Sự kiện:</b> ${event.title}
👤 <b>Họ tên:</b> ${userName}
📧 <b>Email:</b> ${userEmail}
🎫 <b>Mã vé:</b> <code>${ticketCode}</code>
📅 <b>Thời gian đăng ký:</b> ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}
`.trim();
        sendTelegramMessage(undefined, telegramMsg).catch(() => {});

        return res.status(201).json({
            status: 'success',
            message: 'Đăng ký sự kiện thành công! Vé điện tử và mã QR đã được tạo.',
            data: registration,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * 2. Get current user's registered event tickets
 */
export const getMyEventTickets = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = res.locals.auth?.userId;
        if (!userId) {
            return res.status(401).json({ status: 'error', message: 'Yêu cầu đăng nhập' });
        }

        const tickets = await EventRegistration.find({ userId })
            .populate('eventId', 'title date time location coverImage status')
            .sort({ createdAt: -1 });

        return res.status(200).json({
            status: 'success',
            results: tickets.length,
            data: tickets,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * 3. Get Attendees for an Event (Admin only)
 */
export const getEventAttendees = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const eventId = req.params.id;
        const attendees = await EventRegistration.find({ eventId })
            .populate('userId', 'avatar firstname lastname nickname')
            .sort({ createdAt: -1 });

        const totalRegistered = attendees.length;
        const totalCheckedIn = attendees.filter((a) => a.status === 'checked_in').length;

        return res.status(200).json({
            status: 'success',
            results: attendees.length,
            stats: {
                totalRegistered,
                totalCheckedIn,
                checkInRate: totalRegistered > 0 ? Math.round((totalCheckedIn / totalRegistered) * 100) : 0,
            },
            data: attendees,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * 4. Check-in Attendee via QR Code or TicketCode (Admin only)
 */
export const checkInAttendee = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const adminId = res.locals.auth?.userId;
        const { ticketCode, registrationId } = req.body;

        if (!ticketCode && !registrationId) {
            return res.status(400).json({
                status: 'error',
                message: 'Vui lòng cung cấp mã vé (ticketCode) hoặc ID đăng ký',
            });
        }

        const query = ticketCode ? { ticketCode: ticketCode.trim().toUpperCase() } : { _id: registrationId };
        const registration = await EventRegistration.findOne(query).populate('eventId', 'title');

        if (!registration) {
            return res.status(404).json({
                status: 'error',
                message: 'Không tìm thấy vé tham dự hợp lệ trong hệ thống',
            });
        }

        if (registration.status === 'checked_in') {
            return res.status(400).json({
                status: 'error',
                message: `Vé này đã được điểm danh trước đó vào lúc ${new Date(registration.checkedInAt!).toLocaleTimeString('vi-VN')}!`,
                data: registration,
            });
        }

        registration.status = 'checked_in';
        registration.checkedInAt = new Date();
        registration.checkedInBy = adminId ? new mongoose.Types.ObjectId(adminId) : null;
        await registration.save();

        // If registered member, award +50 EXP and in-app notification
        if (registration.userId) {
            await User.findByIdAndUpdate(registration.userId, {
                $inc: { exp: 50 },
            });

            createNotification({
                recipientId: registration.userId.toString(),
                type: 'event_created',
                title: 'Check-in Sự kiện thành công! 🎉',
                message: `Bạn đã hoàn tất điểm danh tại sự kiện "${(registration.eventId as any)?.title || 'FU-DEVER Event'}". Nhận ngay +50 EXP!`,
                link: '/vi/dashboard',
                meta: { ticketCode: registration.ticketCode, expEarned: 50 },
            }).catch((e) => console.warn('Check-in notification error:', e));
        }

        return res.status(200).json({
            status: 'success',
            message: `Điểm danh thành công cho ${registration.userName}! (+50 EXP)`,
            data: registration,
        });
    } catch (error) {
        next(error);
    }
};
