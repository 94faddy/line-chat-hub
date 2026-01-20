import { connectDB } from './mongodb';
import { LineChannel, AdminPermission } from '@/models';

// ใช้ global variable เพื่อไม่ให้สร้างใหม่ทุกครั้งใน Next.js dev mode
declare global {
  var sseClients: Map<string, Set<ReadableStreamDefaultController>> | undefined;
}

// Store active SSE connections (key = userId as string)
const clients = global.sseClients || new Map<string, Set<ReadableStreamDefaultController>>();

// เก็บไว้ใน global
if (process.env.NODE_ENV !== 'production') {
  global.sseClients = clients;
}

// Get the clients map
export function getClients(): Map<string, Set<ReadableStreamDefaultController>> {
  return clients;
}

// Add client connection
export function addClient(userId: string, controller: ReadableStreamDefaultController) {
  if (!clients.has(userId)) {
    clients.set(userId, new Set());
  }
  clients.get(userId)?.add(controller);
  
  const allConnectedUsers = Array.from(clients.keys());
  console.log(`🔌 SSE Client connected: userId=${userId}`);
  console.log(`   - User ${userId} connections: ${clients.get(userId)?.size}`);
  console.log(`   - All connected users: [${allConnectedUsers.join(', ')}]`);
}

// Remove client connection
export function removeClient(userId: string, controller: ReadableStreamDefaultController) {
  clients.get(userId)?.delete(controller);
  if (clients.get(userId)?.size === 0) {
    clients.delete(userId);
  }
  
  const allConnectedUsers = Array.from(clients.keys());
  console.log(`🔌 SSE Client disconnected: userId=${userId}`);
  console.log(`   - Remaining connected users: [${allConnectedUsers.join(', ')}]`);
}

// Send event to specific user
export function sendEventToUser(userId: string, eventType: string, data: any) {
  const userClients = clients.get(userId);
  
  const allConnectedUsers = Array.from(clients.keys());
  console.log(`📤 Sending ${eventType} to userId=${userId}`);
  console.log(`   - Target user clients: ${userClients?.size || 0}`);
  console.log(`   - All connected users: [${allConnectedUsers.join(', ')}]`);
  
  if (userClients && userClients.size > 0) {
    const encoder = new TextEncoder();
    const eventData = JSON.stringify({ 
      type: eventType, 
      data, 
      timestamp: new Date().toISOString() 
    });
    
    userClients.forEach((controller) => {
      try {
        // ส่งแบบไม่มี event name เพื่อให้ onmessage จับได้
        controller.enqueue(encoder.encode(`data: ${eventData}\n\n`));
        console.log(`✅ Event sent successfully to userId=${userId}: ${eventType}`);
      } catch (error) {
        console.error(`❌ Failed to send to userId=${userId}:`, error);
      }
    });
  } else {
    console.log(`⚠️ No SSE clients for userId=${userId}. Connected users: [${allConnectedUsers.join(', ')}]`);
  }
}

// Send event to all users who have access to a channel (owner + admins)
export async function sendEventToChannelOwners(channelId: string, eventType: string, data: any) {
  try {
    await connectDB();
    
    // ดึง channel และ owner
    const channel = await LineChannel.findById(channelId).select('user_id').lean();
    
    if (!channel) {
      console.log(`⚠️ Channel ${channelId} not found`);
      return;
    }
    
    const ownerId = channel.user_id.toString();
    
    // เก็บ user IDs ที่ต้องส่ง notification
    const userIdsToNotify = new Set<string>();
    userIdsToNotify.add(ownerId);
    
    // ดึง admin IDs ที่มีสิทธิ์เข้าถึง channel นี้
    const admins = await AdminPermission.find({
      status: 'active',
      $or: [
        { channel_id: channelId },
        { owner_id: channel.user_id, channel_id: null },
      ],
    }).select('admin_id').lean();
    
    admins.forEach((admin: any) => {
      if (admin.admin_id) {
        userIdsToNotify.add(admin.admin_id.toString());
      }
    });
    
    console.log(`📡 Channel ${channelId}: notifying users [${Array.from(userIdsToNotify).join(', ')}]`);
    
    // ส่ง event ไปยังทุก user ที่มีสิทธิ์
    userIdsToNotify.forEach((userId) => {
      sendEventToUser(userId, eventType, data);
    });
    
  } catch (error) {
    console.error('Error sending event to channel owners:', error);
  }
}

// Notify new message
export async function notifyNewMessage(channelId: string, conversationId: string, message: any) {
  console.log(`📨 notifyNewMessage: channel=${channelId}, conv=${conversationId}`);
  await sendEventToChannelOwners(channelId, 'new_message', {
    conversation_id: conversationId,
    message
  });
}

// Notify conversation update
export async function notifyConversationUpdate(channelId: string, conversation: any) {
  console.log(`📨 notifyConversationUpdate: channel=${channelId}, conv=${conversation.id || conversation._id}`);
  await sendEventToChannelOwners(channelId, 'conversation_update', conversation);
}

// Notify new conversation
export async function notifyNewConversation(channelId: string, conversation: any) {
  console.log(`📨 notifyNewConversation: channel=${channelId}, conv=${conversation.id || conversation._id}`);
  await sendEventToChannelOwners(channelId, 'new_conversation', conversation);
}