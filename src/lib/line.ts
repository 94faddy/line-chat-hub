import axios from 'axios';
import crypto from 'crypto';

const LINE_API_BASE = 'https://api.line.me/v2';
const LINE_DATA_API_BASE = 'https://api-data.line.me/v2';

export interface LineProfile {
  userId: string;
  displayName: string;
  pictureUrl?: string;
  statusMessage?: string;
  language?: string;
}

export interface LineMessage {
  type: string;
  text?: string;
  originalContentUrl?: string;
  previewImageUrl?: string;
  packageId?: string;
  stickerId?: string;
}

export interface LineWebhookEvent {
  type: string;
  message?: {
    id: string;
    type: string;
    text?: string;
    contentProvider?: {
      type: string;
    };
    stickerId?: string;
    packageId?: string;
  };
  replyToken?: string;
  source: {
    type: string;
    userId: string;
    groupId?: string;
    roomId?: string;
  };
  timestamp: number;
}

export class LineClient {
  private channelAccessToken: string;
  private channelSecret: string;

  constructor(channelAccessToken: string, channelSecret: string) {
    this.channelAccessToken = channelAccessToken;
    this.channelSecret = channelSecret;
  }

  // ตรวจสอบ signature ของ webhook
  validateSignature(body: string, signature: string): boolean {
    const hash = crypto
      .createHmac('SHA256', this.channelSecret)
      .update(body)
      .digest('base64');
    return hash === signature;
  }

  // ดึงโปรไฟล์ผู้ใช้
  async getProfile(userId: string): Promise<LineProfile> {
    const response = await axios.get(`${LINE_API_BASE}/bot/profile/${userId}`, {
      headers: {
        Authorization: `Bearer ${this.channelAccessToken}`,
      },
    });
    return response.data;
  }

  // ส่งข้อความตอบกลับ
  async replyMessage(replyToken: string, messages: LineMessage | LineMessage[]): Promise<void> {
    // ตรวจสอบว่า messages เป็น array หรือไม่ ถ้าไม่ใช่ให้แปลงเป็น array
    const messagesArray = Array.isArray(messages) ? messages : [messages];
    
    await axios.post(
      `${LINE_API_BASE}/bot/message/reply`,
      {
        replyToken,
        messages: messagesArray,
      },
      {
        headers: {
          Authorization: `Bearer ${this.channelAccessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
  }

  // ส่งข้อความ push
  async pushMessage(to: string, messages: LineMessage | LineMessage[]): Promise<void> {
    // ตรวจสอบว่า messages เป็น array หรือไม่ ถ้าไม่ใช่ให้แปลงเป็น array
    const messagesArray = Array.isArray(messages) ? messages : [messages];
    
    await axios.post(
      `${LINE_API_BASE}/bot/message/push`,
      {
        to,
        messages: messagesArray,
      },
      {
        headers: {
          Authorization: `Bearer ${this.channelAccessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
  }

  // ส่งข้อความ multicast
  async multicastMessage(to: string[], messages: LineMessage | LineMessage[]): Promise<void> {
    const messagesArray = Array.isArray(messages) ? messages : [messages];
    
    await axios.post(
      `${LINE_API_BASE}/bot/message/multicast`,
      {
        to,
        messages: messagesArray,
      },
      {
        headers: {
          Authorization: `Bearer ${this.channelAccessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
  }

  // ส่งข้อความ broadcast
  async broadcastMessage(messages: LineMessage | LineMessage[]): Promise<void> {
    const messagesArray = Array.isArray(messages) ? messages : [messages];
    
    await axios.post(
      `${LINE_API_BASE}/bot/message/broadcast`,
      {
        messages: messagesArray,
      },
      {
        headers: {
          Authorization: `Bearer ${this.channelAccessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
  }

  // ดาวน์โหลดไฟล์
  async getMessageContent(messageId: string): Promise<Buffer> {
    const response = await axios.get(
      `${LINE_DATA_API_BASE}/bot/message/${messageId}/content`,
      {
        headers: {
          Authorization: `Bearer ${this.channelAccessToken}`,
        },
        responseType: 'arraybuffer',
      }
    );
    return Buffer.from(response.data);
  }

  // ดึงข้อมูล Channel
  async getBotInfo(): Promise<any> {
    const response = await axios.get(`${LINE_API_BASE}/bot/info`, {
      headers: {
        Authorization: `Bearer ${this.channelAccessToken}`,
      },
    });
    return response.data;
  }

  // ดึงจำนวน quota ที่เหลือ
  async getMessageQuota(): Promise<any> {
    const response = await axios.get(`${LINE_API_BASE}/bot/message/quota`, {
      headers: {
        Authorization: `Bearer ${this.channelAccessToken}`,
      },
    });
    return response.data;
  }

  // ดึงจำนวนผู้ติดตาม
  async getFollowerCount(): Promise<number> {
    try {
      const response = await axios.get(`${LINE_API_BASE}/bot/insight/followers`, {
        headers: {
          Authorization: `Bearer ${this.channelAccessToken}`,
        },
      });
      return response.data.followers || 0;
    } catch {
      return 0;
    }
  }
}

// Helper function สำหรับสร้าง LINE messages
export function createTextMessage(text: string): LineMessage {
  return {
    type: 'text',
    text,
  };
}

export function createImageMessage(originalUrl: string, previewUrl?: string): LineMessage {
  return {
    type: 'image',
    originalContentUrl: originalUrl,
    previewImageUrl: previewUrl || originalUrl,
  };
}

export function createStickerMessage(packageId: string, stickerId: string): LineMessage {
  return {
    type: 'sticker',
    packageId,
    stickerId,
  };
}

export function createFlexMessage(altText: string, contents: any): LineMessage {
  return {
    type: 'flex',
    altText,
    contents,
  } as any;
}

// Helper function สำหรับส่ง broadcast ไปยังผู้ใช้แต่ละคน
export async function sendBroadcastMessage(
  accessToken: string,
  userId: string,
  message: LineMessage | LineMessage[]
): Promise<void> {
  // ตรวจสอบว่า message เป็น array หรือไม่ ถ้าไม่ใช่ให้แปลงเป็น array
  const messagesArray = Array.isArray(message) ? message : [message];
  
  await axios.post(
    `${LINE_API_BASE}/bot/message/push`,
    {
      to: userId,
      messages: messagesArray,
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );
}

// Standalone validation function
export function validateSignature(body: string, signature: string, channelSecret: string): boolean {
  const hash = crypto
    .createHmac('SHA256', channelSecret)
    .update(body)
    .digest('base64');
  return hash === signature;
}

// Get user profile standalone
export async function getUserProfile(accessToken: string, userId: string): Promise<LineProfile> {
  const response = await axios.get(`${LINE_API_BASE}/bot/profile/${userId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return response.data;
}

// Get channel info standalone
export async function getChannelInfo(accessToken: string): Promise<any> {
  const response = await axios.get(`${LINE_API_BASE}/bot/info`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return response.data;
}

// Push message standalone - รองรับทั้ง single message และ array
export async function pushMessage(
  accessToken: string,
  to: string,
  message: LineMessage | LineMessage[]
): Promise<void> {
  // ตรวจสอบว่า message เป็น array หรือไม่ ถ้าไม่ใช่ให้แปลงเป็น array
  const messagesArray = Array.isArray(message) ? message : [message];
  
  await axios.post(
    `${LINE_API_BASE}/bot/message/push`,
    {
      to,
      messages: messagesArray,
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );
}

// Get message content standalone
export async function getMessageContent(accessToken: string, messageId: string): Promise<Buffer> {
  const response = await axios.get(
    `${LINE_DATA_API_BASE}/bot/message/${messageId}/content`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      responseType: 'arraybuffer',
    }
  );
  return Buffer.from(response.data);
}

// Reply message standalone - รองรับทั้ง single message และ array
export async function replyMessage(
  accessToken: string,
  replyToken: string,
  messages: LineMessage | LineMessage[]
): Promise<void> {
  // ตรวจสอบว่า messages เป็น array หรือไม่ ถ้าไม่ใช่ให้แปลงเป็น array
  const messagesArray = Array.isArray(messages) ? messages : [messages];
  
  await axios.post(
    `${LINE_API_BASE}/bot/message/reply`,
    {
      replyToken,
      messages: messagesArray,
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );
}