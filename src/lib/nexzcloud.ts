/**
 * ============================================================
 * 📁 NexzCloud Storage Integration
 * 📝 Upload files to NexzCloud with CDN URL (Direct Access)
 * ============================================================
 */

import FormData from 'form-data';
import axios from 'axios';

const NEXZCLOUD_API_URL = 'https://apiv1.nexzcloud.lol';
const NEXZCLOUD_API_KEY = process.env.NEXZCLOUD_API_KEY || '';

// ✅ Path สำหรับเก็บไฟล์
const NEXZCLOUD_PATHFILE = process.env.NEXZCLOUD_PATHFILE || 'bevchat/media';

// Cache folder ID
let cachedFolderId: number | null = null;

interface UploadResult {
  success: boolean;
  url?: string;
  cdnUrl?: string;
  id?: number;
  filename?: string;
  error?: string;
}

interface ShareResult {
  success: boolean;
  cdnUrl?: string;
  shareUrl?: string;
  error?: string;
}

interface FolderInfo {
  id: number;
  name: string;
  parentId?: number;
}

/**
 * ดึงรายการ folders จาก parent folder
 */
async function listFolders(parentId?: number): Promise<FolderInfo[]> {
  try {
    const url = parentId 
      ? `${NEXZCLOUD_API_URL}/api/public/folders?parentId=${parentId}`
      : `${NEXZCLOUD_API_URL}/api/public/folders`;
    
    const response = await axios.get(url, {
      headers: {
        'X-API-Key': NEXZCLOUD_API_KEY,
      },
    });

    const data = response.data;
    
    if (data.success && Array.isArray(data.data)) {
      return data.data.map((f: any) => ({
        id: f.id,
        name: f.name,
        parentId: f.parentId,
      }));
    }
    
    return [];
  } catch (error: any) {
    return [];
  }
}

/**
 * หา folder ID จากชื่อ
 */
async function findFolderByName(name: string, parentId?: number): Promise<number | null> {
  const folders = await listFolders(parentId);
  const folder = folders.find(f => f.name.toLowerCase() === name.toLowerCase());
  return folder?.id || null;
}

/**
 * สร้างโฟลเดอร์บน NexzCloud
 */
async function createFolder(name: string, parentId?: number): Promise<{ success: boolean; id?: number; error?: string }> {
  try {
    const response = await axios.post(
      `${NEXZCLOUD_API_URL}/api/public/folders/create`,
      {
        name,
        parentId: parentId || null,
      },
      {
        headers: {
          'X-API-Key': NEXZCLOUD_API_KEY,
          'Content-Type': 'application/json',
        },
      }
    );

    const data = response.data;
    
    if (data.success && data.data?.id) {
      return { success: true, id: data.data.id };
    } else {
      return { success: false, error: data.message };
    }
  } catch (error: any) {
    // Folder อาจมีอยู่แล้ว → ลองหา ID
    const existingId = await findFolderByName(name, parentId);
    if (existingId) {
      return { success: true, id: existingId };
    }
    return { success: false, error: error.message };
  }
}

/**
 * หา/สร้าง folder structure จาก path
 */
async function ensureFolderPath(pathString: string): Promise<number | null> {
  if (cachedFolderId) {
    return cachedFolderId;
  }

  const parts = pathString.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
  
  if (parts.length === 0) {
    return null;
  }

  let parentId: number | undefined = undefined;
  let lastFolderId: number | null = null;

  for (const folderName of parts) {
    let folderId = await findFolderByName(folderName, parentId);
    
    if (!folderId) {
      const result = await createFolder(folderName, parentId);
      if (result.success && result.id) {
        folderId = result.id;
      }
    }
    
    if (folderId) {
      lastFolderId = folderId;
      parentId = folderId;
    } else {
      break;
    }
  }

  if (lastFolderId) {
    cachedFolderId = lastFolderId;
  }

  return lastFolderId;
}

/**
 * 🔗 Share ไฟล์เพื่อรับ CDN URL
 */
async function shareFile(fileId: number): Promise<ShareResult> {
  try {
    const response = await axios.post(
      `${NEXZCLOUD_API_URL}/api/public/share`,
      {
        type: 'file',
        id: fileId,
        isPublic: true,
      },
      {
        headers: {
          'X-API-Key': NEXZCLOUD_API_KEY,
          'Content-Type': 'application/json',
        },
      }
    );

    const data = response.data;

    if (data.success && data.data?.cdnUrl) {
      return {
        success: true,
        cdnUrl: data.data.cdnUrl,
        shareUrl: data.data.shareUrl,
      };
    } else {
      return { success: false, error: data.message || 'Share failed' };
    }
  } catch (error: any) {
    console.error(`❌ [NexzCloud] Share error:`, error.response?.data || error.message);
    return { success: false, error: error.message };
  }
}

/**
 * 📦 ย้ายไฟล์ไปยัง folder
 */
async function moveFile(fileId: number, targetFolderId: number): Promise<boolean> {
  try {
    const response = await axios.post(
      `${NEXZCLOUD_API_URL}/api/public/move`,
      {
        fileId: fileId,
        targetFolderId: targetFolderId,
      },
      {
        headers: {
          'X-API-Key': NEXZCLOUD_API_KEY,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data.success === true;
  } catch (error: any) {
    console.error(`❌ [NexzCloud] Move error:`, error.response?.data || error.message);
    return false;
  }
}

/**
 * Upload ไฟล์ไป NexzCloud และ Share เพื่อรับ CDN URL
 */
export async function uploadToCloud(
  fileBuffer: Buffer,
  filename: string,
  mimeType: string,
  subfolder?: string
): Promise<UploadResult> {
  try {
    if (!NEXZCLOUD_API_KEY) {
      console.error('❌ [NexzCloud] API Key not configured');
      return { success: false, error: 'API Key not configured' };
    }

    // ✅ Target folder ID
    let targetFolderId: number | null = process.env.NEXZCLOUD_FOLDER_ID 
      ? parseInt(process.env.NEXZCLOUD_FOLDER_ID) 
      : null;

    if (!targetFolderId && NEXZCLOUD_PATHFILE) {
      targetFolderId = await ensureFolderPath(NEXZCLOUD_PATHFILE);
    }

    // Upload ไฟล์
    const form = new FormData();
    form.append('files', fileBuffer, {
      filename: filename,
      contentType: mimeType,
    });

    console.log(`📤 [NexzCloud] Uploading: ${filename}`);

    const uploadResponse = await axios.post(
      `${NEXZCLOUD_API_URL}/api/public/upload`,
      form,
      {
        headers: {
          'X-API-Key': NEXZCLOUD_API_KEY,
          ...form.getHeaders(),
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      }
    );

    const uploadData = uploadResponse.data;

    if (!uploadData.success || !uploadData.data?.uploaded?.length) {
      console.error(`❌ [NexzCloud] Upload failed:`, uploadData);
      return { success: false, error: uploadData.message || 'Upload failed' };
    }

    const uploaded = uploadData.data.uploaded[0];
    const fileId = uploaded.id;
    
    console.log(`✅ [NexzCloud] Uploaded: ${filename} (ID: ${fileId})`);

    // ย้ายไฟล์ไป target folder
    if (targetFolderId) {
      await moveFile(fileId, targetFolderId);
    }

    // Share เพื่อรับ CDN URL
    const shareResult = await shareFile(fileId);

    if (shareResult.success && shareResult.cdnUrl) {
      console.log(`🌐 [NexzCloud] CDN URL: ${shareResult.cdnUrl}`);
      
      return {
        success: true,
        url: shareResult.cdnUrl,
        cdnUrl: shareResult.cdnUrl,
        id: fileId,
        filename: uploaded.filename,
      };
    }

    // Fallback: proxy URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const proxyUrl = `${baseUrl}/api/cloud/download/${fileId}`;
    
    console.log(`⚠️ [NexzCloud] Share failed, using proxy: ${proxyUrl}`);
    
    return {
      success: true,
      url: proxyUrl,
      id: fileId,
      filename: uploaded.filename,
    };
  } catch (error: any) {
    console.error(`❌ [NexzCloud] Upload error:`, error.response?.data || error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Upload ไฟล์จาก Buffer (สำหรับ webhook)
 */
export async function uploadMediaFromBuffer(
  buffer: Buffer,
  mediaType: string,
  messageId: string
): Promise<string | null> {
  try {
    let ext = '.bin';
    let mimeType = 'application/octet-stream';
    
    switch (mediaType) {
      case 'image':
        ext = '.jpg';
        mimeType = 'image/jpeg';
        break;
      case 'video':
        ext = '.mp4';
        mimeType = 'video/mp4';
        break;
      case 'audio':
        ext = '.m4a';
        mimeType = 'audio/mp4';
        break;
      case 'file':
        ext = '.bin';
        mimeType = 'application/octet-stream';
        break;
    }

    const today = new Date();
    const dateFolder = `${today.getFullYear()}/${(today.getMonth() + 1).toString().padStart(2, '0')}`;
    const filename = `${messageId}${ext}`;

    const result = await uploadToCloud(buffer, filename, mimeType, dateFolder);

    if (result.success && result.url) {
      return result.url;
    }

    return null;
  } catch (error) {
    console.error('❌ [NexzCloud] Upload media error:', error);
    return null;
  }
}

/**
 * Upload ไฟล์จาก File object (สำหรับ API upload)
 */
export async function uploadFileToCloud(
  file: File,
  type: string = 'image'
): Promise<UploadResult> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    const crypto = await import('crypto');
    const uniqueId = crypto.randomBytes(16).toString('hex');
    const ext = getExtensionFromMime(file.type) || '.bin';
    const filename = `${uniqueId}${ext}`;

    const result = await uploadToCloud(buffer, filename, file.type, type + 's');

    return result;
  } catch (error: any) {
    console.error('❌ [NexzCloud] Upload file error:', error);
    return { success: false, error: error.message };
  }
}

function getExtensionFromMime(mime: string): string {
  const mimeToExt: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'video/mp4': '.mp4',
    'video/webm': '.webm',
    'video/quicktime': '.mov',
    'audio/mpeg': '.mp3',
    'audio/wav': '.wav',
    'audio/ogg': '.ogg',
    'audio/mp4': '.m4a',
    'application/pdf': '.pdf',
  };
  return mimeToExt[mime] || '';
}

/**
 * ตรวจสอบว่า NexzCloud พร้อมใช้งานหรือไม่
 */
export function isCloudStorageEnabled(): boolean {
  return !!NEXZCLOUD_API_KEY;
}