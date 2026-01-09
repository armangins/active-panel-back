const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');

let io;

const init = (server) => {
    // Determine the allowed origins (e.g., frontend URL)
    let allowedOrigins = [process.env.FRONTEND_URL || 'http://localhost:5173'];
    // Handle trailing slash issues or comma-separated lists if needed
    
    // Create Socket.io server
    io = socketIo(server, {
        cors: {
            origin: (origin, callback) => {
                // Allow requests with no origin (like mobile apps or curl requests)
                if (!origin) return callback(null, true);
                
                // Allow any origin in development
                if (process.env.NODE_ENV === 'development') {
                    return callback(null, true);
                }

                // Production strict check could be added here
                callback(null, true); 
            },
            methods: ["GET", "POST"],
            credentials: true
        }
    });

const { verifyAccessToken } = require('../utils/jwt');

// ...

    // Middleware for Authentication
    io.use((socket, next) => {
        const token = socket.handshake.auth.token;
        
        if (!token) {
            console.log('❌ [SOCKET] Auth failed: No token provided');
            return next(new Error('Authentication error: No token provided'));
        }

        try {
            // Verify JWT Token using the utility
            const decoded = verifyAccessToken(token);
            socket.user = decoded;
            // console.log(`✅ [SOCKET] Auth success for user: ${decoded.userId}`);
            next();
        } catch (err) {
            console.error(`❌ [SOCKET] Auth failed for token: ${token.substring(0, 10)}...`);
            console.error(`❌ [SOCKET] Verification error: ${err.message}`);
            next(new Error('Authentication error: Invalid token'));
        }
    });

    io.on('connection', (socket) => {
        const userId = socket.user.userId || socket.user.id; // Fallback just in case
        console.log(`🔌 [SOCKET] New client connected: ${socket.id} (User: ${userId})`);

        // Join a room specific to this user so we can send private updates
        socket.join(`user_${userId}`);
        console.log(`🔌 [SOCKET] Joined room: user_${userId}`);

        socket.on('disconnect', () => {
            console.log(`🔌 [SOCKET] Client disconnected: ${socket.id}`);
        });
    });

    return io;
};

const getIo = () => {
    if (!io) {
        throw new Error('Socket.io not initialized!');
    }
    return io;
};

module.exports = {
    init,
    getIo
};
