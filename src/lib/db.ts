import mysql, { Pool, PoolConnection } from 'mysql2/promise';

// ใช้ global variable เพื่อไม่ให้สร้าง pool ใหม่ทุกครั้งใน Next.js dev mode
declare global {
  var mysqlPool: Pool | undefined;
}

const createPool = () => mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'line_chat_hub',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4',
  connectTimeout: 30000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
});

let pool = global.mysqlPool || createPool();

// เก็บไว้ใน global เพื่อ reuse ใน dev mode
if (process.env.NODE_ENV !== 'production') {
  global.mysqlPool = pool;
}

// Retry function
async function withRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      const isRetryable = ['ETIMEDOUT', 'ECONNRESET', 'PROTOCOL_CONNECTION_LOST', 'ECONNREFUSED'].includes(error.code);
      
      if (i === retries - 1 || !isRetryable) {
        throw error;
      }
      
      console.log(`DB retry ${i + 1}/${retries} after error: ${error.code}`);
      
      // Recreate pool if connection lost
      if (error.code === 'PROTOCOL_CONNECTION_LOST' || error.code === 'ECONNREFUSED') {
        pool = createPool();
        if (process.env.NODE_ENV !== 'production') {
          global.mysqlPool = pool;
        }
      }
      
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw new Error('Max retries reached');
}

export async function query<T>(sql: string, params?: any[]): Promise<T> {
  return withRetry(async () => {
    const connection = await pool.getConnection();
    try {
      const [results] = await connection.execute(sql, params);
      return results as T;
    } finally {
      connection.release();
    }
  });
}

export async function getConnection(): Promise<PoolConnection> {
  return withRetry(() => pool.getConnection());
}

export default pool;