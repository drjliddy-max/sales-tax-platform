import mongoose from 'mongoose';
// Just import to execute the server startup
import './simple-app';

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/sales_tax_tracker');

mongoose.connection.on('connected', () => {
  console.log('Connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
});