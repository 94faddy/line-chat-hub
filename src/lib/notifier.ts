import { query } from './db';

// ใช้ global variable เพื่อไม่ให้สร้างใหม่ทุกครั้งใน Next.js dev mode
declare global {
  var sseClients: Map<number, Set<ReadableStreamDefaultController>> | undefined;
}

// Store active SSE connections
const clients = global.sseClients || new Map<number, Set<ReadableStreamDefaultController>>();

// เก็บไว้ใน global
if (process.env.NODE_ENV !== 'production') {
  global.sseClients = clients;
}

// Get the clients map
export function getClients(): Map<number, Set<ReadableStreamDefaultController>> {
  return clients;
}

// Add client connection
export function addClient(userId: number, controller: ReadableStreamDefaultController) {
  if (!clients.has(userId)) {
    clients.set(userId, new Set());
  }
  clients.get(userId)?.add(controller);
  console.log(`🔌 SSE Client connected: userId=${userId}, total=${clients.get(userId)?.size}, allUsers=${clients.size}`);
}

// Remove client connection
export function removeClient(userId: number, controller: ReadableStreamDefaultController) {
  clients.get(userId)?.delete(controller);
  if (clients.get(userId)?.size === 0) {
    clients.delete(userId);
  }
  console.log(`🔌 SSE Client disconnected: userId=${userId}`);
}

// Send event to specific user
export function sendEventToUser(userId: number, eventType: string, data: any) {
  const userClients = clients.get(userId);
  console.log(`📤 Sending ${eventType} to userId=${userId}, clients=${userClients?.size || 0}`);
  
  if (userClients && userClients.size > 0) {
    const encoder = new TextEncoder();
    const eventData = JSON.stringify({ 
      type: eventType, 
      data, 
      timestamp: new Date().toISOString() 
    });
    
    userClients.forEach((controller) => {
      try {
        controller.enqueue(encoder.encode(`data: ${eventData}\n\n`));
      } catch (error) {
        console.error('Failed to send to client:', error);
      }
    });
    console.log(`✅ Event sent to userId=${userId}: ${eventType}`);
  } else {
    console.log(`⚠️ No SSE clients for userId=${userId}`);
  }
}

// Send event to all users who have access to a channel (owner + admins)
export async function sendEventToChannelOwners(channelId: number, eventType: string, data: any) {
  try {
    // ดึง owner ของ channel
    const channels = await query(
      'SELECT user_id FROM line_channels WHERE id = ?',
      [channelId]
    );
    
    if (!Array.isArray(channels) || channels.length === 0) {
      console.log(`⚠️ Channel ${channelId} not found`);
      return;
    }
    
    const channel = channels[0] as any;
    const ownerId = channel.user_id;
    
    // เก็บ user IDs ที่ต้องส่ง notification
    const userIdsToNotify = new Set<number>();
    userIdsToNotify.add(ownerId);
    
    // ดึง admin IDs ที่มีสิทธิ์เข้าถึง channel นี้
    // 1. Admin ที่ได้รับสิทธิ์เฉพาะ channel นี้
    // 2. Admin ที่ได้รับสิทธิ์ทุก channel ของ owner (channel_id IS NULL)
    const admins = await query(
      `SELECT DISTINCT admin_id FROM admin_permissions 
       WHERE status = 'active' 
       AND (
         channel_id = ?
         OR (owner_id = ? AND channel_id IS NULL)
       )`,
      [channelId, ownerId]
    );
    
    if (Array.isArray(admins)) {
      admins.forEach((admin: any) => {
        if (admin.admin_id && admin.admin_id !== ownerId) {
          userIdsToNotify.add(admin.admin_id);
        }
      });
    }
    
    console.log(`📡 Channel ${channelId}: notifying ${userIdsToNotify.size} users (owner + ${userIdsToNotify.size - 1} admins)`);
    
    // ส่ง event ไปยังทุก user ที่มีสิทธิ์
    userIdsToNotify.forEach((userId) => {
      sendEventToUser(userId, eventType, data);
    });
    
  } catch (error) {
    console.error('Error sending event to channel owners:', error);
  }
}

// Notify new message
export async function notifyNewMessage(channelId: number, conversationId: number, message: any) {
  console.log(`📨 notifyNewMessage: channel=${channelId}, conv=${conversationId}`);
  await sendEventToChannelOwners(channelId, 'new_message', {
    conversation_id: conversationId,
    message
  });
}

// Notify conversation update
export async function notifyConversationUpdate(channelId: number, conversation: any) {
  console.log(`📨 notifyConversationUpdate: channel=${channelId}, conv=${conversation.id}`);
  await sendEventToChannelOwners(channelId, 'conversation_update', conversation);
}

// Notify new conversation
export async function notifyNewConversation(channelId: number, conversation: any) {
  console.log(`📨 notifyNewConversation: channel=${channelId}, conv=${conversation.id}`);
  await sendEventToChannelOwners(channelId, 'new_conversation', conversation);
}