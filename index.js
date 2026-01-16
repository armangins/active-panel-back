/**
 * Entry point for deployment
 * This file starts the Express server
 */

const { app, server } = require('./src/app');
const connectDB = require('./src/config/database');
const PORT = process.env.PORT || 3000;

// Connect to Database then start server
connectDB()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Failed to connect to database:', error);
    process.exit(1);
  });
