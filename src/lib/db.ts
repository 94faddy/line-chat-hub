// MongoDB Database Helper
// ไฟล์นี้เป็น wrapper สำหรับ backward compatibility
// ในอนาคตควรใช้ models โดยตรง

import { connectDB } from './mongodb';
import mongoose from 'mongoose';

// Re-export connect function
export { connectDB };

// Get mongoose instance
export function getMongoose() {
  return mongoose;
}

// Check if connected
export function isConnected(): boolean {
  return mongoose.connection.readyState === 1;
}

// Get database instance
export function getDB() {
  if (!isConnected()) {
    throw new Error('Database not connected. Call connectDB() first.');
  }
  return mongoose.connection.db;
}

// Helper function to convert MySQL-style query to MongoDB (for migration period)
// ไม่แนะนำให้ใช้ - ใช้ models โดยตรงแทน
export async function query<T = any>(sql: string, params?: any[]): Promise<T> {
  console.warn('⚠️ query() is deprecated. Please use MongoDB models directly.');
  throw new Error('MySQL query() is no longer supported. Use MongoDB models.');
}

// Export default mongoose connection
export default mongoose;
