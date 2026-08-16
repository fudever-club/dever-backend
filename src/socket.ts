import { Server } from 'socket.io';

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
        },
        getInstance: function () {
            if (!instance) {
                instance = {};
            }
            return instance;
        },
        onConnection: () => {
            if (!instance.io) return;
            instance.io.on('connection', (socket: any) => {
                // User joins their private notification room
                socket.on('join:user', (userId: string) => {
                    if (userId) {
                        socket.join(`user_${userId}`);
                    }
                });

                // Admin joins admin channel
                socket.on('join:admin', () => {
                    socket.join('admin_channel');
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
