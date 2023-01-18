import { Server } from 'socket.io';

export const socketServer = (function () {
    let instance: any = {};
    return {
        init: (server: any) => {
            instance.io = new Server(server, {
                cors: {
                    origin: '*',
                    methods: ['PUT', 'GET', 'POST', 'DELETE', 'OPTIONS'],
                    allowedHeaders: ['secretHeader'],
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
            instance.io.on('connection', (socket: any) => {
                socket.on('follow', (socket: any) => {
                    instance.io.emit('follow', 'ulatroi');
                });
                socket.on('watchlist', (socket: any) => {
                    instance.io.emit('watchlist', 'my watchlist');
                    console.log('abcfdfs');
                });
            });
        },
    };
})();
