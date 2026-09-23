import { Server } from 'socket.io';
import { getJwtSecret } from './config/auth';
import { User } from './models/UserModel';

const jwt = require('jsonwebtoken');

interface VerifiedSocket {
    data: {
        userId?: string;
        isAdmin?: boolean;
    };
    join: (room: string) => void;
    on: (event: string, handler: (...args: any[]) => void) => void;
}

/**
 * Handshake authentication: the token is verified and the identity AND role
 * are loaded from the database on every connection. A forged payload role or
 * a deleted account can never gain a room.
 */
const authenticateHandshake = async (socket: any, next: (error?: Error) => void) => {
    try {
        const token = socket?.handshake?.auth?.token;
        if (!token || typeof token !== 'string') {
            return next(new Error('Socket authentication required'));
        }
        const payload = jwt.verify(token, getJwtSecret()) as { userId?: string };
        if (!payload?.userId) {
            return next(new Error('Socket authentication required'));
        }
        const user: any = await User.findById(payload.userId).select('_id isAdmin');
        if (!user) {
            return next(new Error('Socket authentication required'));
        }
        socket.data = socket.data || {};
        socket.data.userId = user._id.toString();
        socket.data.isAdmin = Boolean(user.isAdmin);
        return next();
    } catch {
        return next(new Error('Socket authentication required'));
    }
};

export const socketServer = (function () {
    let instance: any = {};
    return {
        init: (server: any) => {
            instance.io = new Server(server, {
                cors: {
                    origin: '*',
                    methods: ['PUT', 'GET', 'POST', 'DELETE', 'OPTIONS'],
                    allowedHeaders: ['secretHeader', 'Authorization'],
                    credentials: true,
                },
            });
            instance.io.use(authenticateHandshake);
        },
        getInstance: function () {
            if (!instance) {
                instance = {};
            }
            return instance;
        },
        onConnection: () => {
            if (!instance.io) return;
            instance.io.on('connection', (socket: VerifiedSocket) => {
                // The room always derives from the verified identity, never
                // from a client-supplied argument.
                if (socket.data?.userId) {
                    socket.join(`user_${socket.data.userId}`);
                }

                // User joins their private notification room
                socket.on('join:user', (userId: string) => {
                    if (userId && String(userId) === socket.data?.userId) {
                        socket.join(`user_${userId}`);
                    }
                });

                // Admin joins admin channel
                socket.on('join:admin', () => {
                    if (socket.data?.isAdmin === true) {
                        socket.join('admin_channel');
                    }
                });

                socket.on('disconnect', () => {
                    // socket auto leaves rooms
                });
            });
        },
        emitToUser: (userId: string, event: string, data: any) => {
            if (instance.io && userId) {
                instance.io.to(`user_${userId}`).emit(event, data);
            }
        },
        emitToAdmin: (event: string, data: any) => {
            if (instance.io) {
                instance.io.to('admin_channel').emit(event, data);
            }
        },
        emitToAll: (event: string, data: any) => {
            if (instance.io) {
                instance.io.emit(event, data);
            }
        },
    };
})();
