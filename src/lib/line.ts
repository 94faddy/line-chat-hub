/**
 * LINE Messaging API Helper
 */

interface LineMessage {
  type: string;
  text?: string;
  originalContentUrl?: string;
  previewImageUrl?: string;
  packageId?: string;
  stickerId?: string;
  duration?: number;
  [key: string]: any;
}

/**
 * ส่งข้อความไปยัง LINE user
 */
export async function pushMessage(
  channelAccessToken: string,
  userId: string,
  message: LineMessage | LineMessage[]
): Promise<any> {
  const messages = Array.isArray(message) ? message : [message];
  
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000); // 30 seconds timeout
  
  try {
    console.log('📤 [LINE API] Calling push message...');
    console.log('📤 [LINE API] User ID:', userId);
    
    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${channelAccessToken}`,
      },
      body: JSON.stringify({
        to: userId,
        messages: messages,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    
    console.log('📤 [LINE API] Response status:', response.status);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('📤 [LINE API] Error data:', errorData);
      const error: any = new Error(errorData.message || 'LINE API Error');
      error.response = { data: errorData };
      throw error;
    }

    return response.json().catch(() => ({}));
  } catch (err: any) {
    clearTimeout(timeout);
    
    if (err.name === 'AbortError') {
      console.error('📤 [LINE API] Request timeout');
      const error: any = new Error('Request timeout');
      error.response = { data: { message: 'Request timeout after 30 seconds' } };
      throw error;
    }
    
    console.error('📤 [LINE API] Fetch error:', err.message);
    console.error('📤 [LINE API] Error cause:', err.cause);
    throw err;
  }
}

/**
 * ตอบกลับข้อความ (Reply)
 */
export async function replyMessage(
  channelAccessToken: string,
  replyToken: string,
  message: LineMessage | LineMessage[]
): Promise<any> {
  const messages = Array.isArray(message) ? message : [message];
  
  const response = await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${channelAccessToken}`,
    },
    body: JSON.stringify({
      replyToken,
      messages: messages,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const error: any = new Error(errorData.message || 'LINE API Error');
    error.response = { data: errorData };
    throw error;
  }

  return response.json().catch(() => ({}));
}

/**
 * ดึงข้อมูล Profile ของ user
 */
export async function getProfile(
  channelAccessToken: string,
  userId: string
): Promise<{
  userId: string;
  displayName: string;
  pictureUrl?: string;
  statusMessage?: string;
  language?: string;
}> {
  const response = await fetch(`https://api.line.me/v2/bot/profile/${userId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${channelAccessToken}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const error: any = new Error(errorData.message || 'LINE API Error');
    error.response = { data: errorData };
    throw error;
  }

  return response.json();
}

/**
 * ดาวน์โหลด content (รูป, วิดีโอ, เสียง, ไฟล์)
 */
export async function getContent(
  channelAccessToken: string,
  messageId: string
): Promise<ArrayBuffer> {
  const response = await fetch(`https://api-data.line.me/v2/bot/message/${messageId}/content`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${channelAccessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to get content');
  }

  return response.arrayBuffer();
}

/**
 * ดึงข้อมูล Channel
 */
export async function getChannelInfo(
  channelAccessToken: string
): Promise<{
  userId: string;
  basicId: string;
  displayName: string;
  pictureUrl?: string;
  chatMode: string;
  markAsReadMode: string;
}> {
  const response = await fetch('https://api.line.me/v2/bot/info', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${channelAccessToken}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const error: any = new Error(errorData.message || 'LINE API Error');
    error.response = { data: errorData };
    throw error;
  }

  return response.json();
}

/**
 * Broadcast ข้อความไปทุกคน
 */
export async function broadcastMessage(
  channelAccessToken: string,
  message: LineMessage | LineMessage[]
): Promise<any> {
  const messages = Array.isArray(message) ? message : [message];
  
  const response = await fetch('https://api.line.me/v2/bot/message/broadcast', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${channelAccessToken}`,
    },
    body: JSON.stringify({
      messages: messages,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const error: any = new Error(errorData.message || 'LINE API Error');
    error.response = { data: errorData };
    throw error;
  }

  return response.json().catch(() => ({}));
}

/**
 * Multicast ส่งข้อความไปหลายคน
 */
export async function multicastMessage(
  channelAccessToken: string,
  userIds: string[],
  message: LineMessage | LineMessage[]
): Promise<any> {
  const messages = Array.isArray(message) ? message : [message];
  
  const response = await fetch('https://api.line.me/v2/bot/message/multicast', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${channelAccessToken}`,
    },
    body: JSON.stringify({
      to: userIds,
      messages: messages,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const error: any = new Error(errorData.message || 'LINE API Error');
    error.response = { data: errorData };
    throw error;
  }

  return response.json().catch(() => ({}));
}

/**
 * Validate LINE Signature
 */
export function validateSignature(
  body: string,
  signature: string,
  channelSecret: string
): boolean {
  const crypto = require('crypto');
  const hash = crypto
    .createHmac('SHA256', channelSecret)
    .update(body)
    .digest('base64');
  return hash === signature;
}

/**
 * Alias for getProfile - ดึงข้อมูล Profile ของ user
 */
export async function getUserProfile(
  channelAccessToken: string,
  userId: string
): Promise<{
  userId: string;
  displayName: string;
  pictureUrl?: string;
  statusMessage?: string;
  language?: string;
}> {
  const response = await fetch(`https://api.line.me/v2/bot/profile/${userId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${channelAccessToken}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const error: any = new Error(errorData.message || 'LINE API Error');
    error.response = { data: errorData };
    throw error;
  }

  return response.json();
}

/**
 * Alias for getContent - ดาวน์โหลด content (รูป, วิดีโอ, เสียง, ไฟล์)
 */
export async function getMessageContent(
  channelAccessToken: string,
  messageId: string
): Promise<Buffer> {
  const response = await fetch(`https://api-data.line.me/v2/bot/message/${messageId}/content`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${channelAccessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to get content');
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * ✅ ดึงข้อมูล Profile ของสมาชิกในกลุ่ม
 */
export async function getGroupMemberProfile(
  channelAccessToken: string,
  groupId: string,
  userId: string
): Promise<{
  userId: string;
  displayName: string;
  pictureUrl?: string;
}> {
  const response = await fetch(
    `https://api.line.me/v2/bot/group/${groupId}/member/${userId}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${channelAccessToken}`,
      },
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const error: any = new Error(errorData.message || 'LINE API Error');
    error.response = { data: errorData };
    throw error;
  }

  return response.json();
}

/**
 * ✅ ดึงข้อมูล Profile ของสมาชิกใน Room
 */
export async function getRoomMemberProfile(
  channelAccessToken: string,
  roomId: string,
  userId: string
): Promise<{
  userId: string;
  displayName: string;
  pictureUrl?: string;
}> {
  const response = await fetch(
    `https://api.line.me/v2/bot/room/${roomId}/member/${userId}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${channelAccessToken}`,
      },
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const error: any = new Error(errorData.message || 'LINE API Error');
    error.response = { data: errorData };
    throw error;
  }

  return response.json();
}

/**
 * ✅ ดึงข้อมูลสรุปของกลุ่ม
 */
export async function getGroupSummary(
  channelAccessToken: string,
  groupId: string
): Promise<{
  groupId: string;
  groupName: string;
  pictureUrl?: string;
}> {
  const response = await fetch(
    `https://api.line.me/v2/bot/group/${groupId}/summary`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${channelAccessToken}`,
      },
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const error: any = new Error(errorData.message || 'LINE API Error');
    error.response = { data: errorData };
    throw error;
  }

  return response.json();
}

/**
 * ✅ นับจำนวนสมาชิกในกลุ่ม
 */
export async function getGroupMemberCount(
  channelAccessToken: string,
  groupId: string
): Promise<number> {
  const response = await fetch(
    `https://api.line.me/v2/bot/group/${groupId}/members/count`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${channelAccessToken}`,
      },
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const error: any = new Error(errorData.message || 'LINE API Error');
    error.response = { data: errorData };
    throw error;
  }

  const data = await response.json();
  return data.count;
}

/**
 * Alias for pushMessage - ส่งข้อความไปยัง LINE user (ใช้ใน API routes)
 */
export const sendLinePush = pushMessage;