import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

async function globalTeardown() {
  // Close database connection
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  console.log('Playwright global teardown completed');
}

export default globalTeardown;