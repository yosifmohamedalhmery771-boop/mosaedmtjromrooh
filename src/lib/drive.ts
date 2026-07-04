import { DriveFile } from '../types';

/**
 * Extracts the folder ID from a Google Drive URL or returns the input if it's already an ID.
 */
export function extractFolderId(input: string): string {
  if (!input) return '';
  const trimmed = input.trim();
  // Match folder url patterns like:
  // https://drive.google.com/drive/folders/1A2B3C4D5E...
  // https://drive.google.com/drive/u/0/folders/1A2B3C4D5E...
  const urlMatch = trimmed.match(/folders\/([a-zA-Z0-9-_]+)/);
  if (urlMatch && urlMatch[1]) {
    return urlMatch[1];
  }
  
  // Match alternative query parameters like open?id=...
  const queryMatch = trimmed.match(/[?&]id=([a-zA-Z0-9-_]+)/);
  if (queryMatch && queryMatch[1]) {
    return queryMatch[1];
  }
  
  return trimmed;
}

/**
 * Generates the standard direct download/viewing link for a Google Drive file,
 * which is highly useful for e-commerce dashboards (e.g. Salla, Zid).
 */
export function getDirectLink(fileId: string): string {
  return `https://drive.google.com/uc?export=download&id=${fileId}`;
}

/**
 * Generates a high-quality thumbnail/preview URL for a Google Drive file.
 */
export function getThumbnailUrl(fileId: string): string {
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w600`;
}

/**
 * Converts a File object to base64 string
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
}

/**
 * Lists image files inside a specific Google Drive folder using Google Apps Script Web App.
 */
export async function listFolderImages(folderId: string, appsScriptUrl: string, apiKey: string): Promise<DriveFile[]> {
  if (!appsScriptUrl) {
    throw new Error('الرجاء إعداد رابط Google Apps Script Web App في تبويب الإعدادات أولاً.');
  }

  const url = `${appsScriptUrl}?action=list&folderId=${encodeURIComponent(folderId)}&apiKey=${encodeURIComponent(apiKey)}`;

  const response = await fetch(url, {
    method: 'GET',
    mode: 'cors',
  });

  if (!response.ok) {
    throw new Error(`فشل الاتصال بـ Apps Script (رمز الاستجابة: ${response.status})`);
  }

  const data = await response.json();
  if (data && data.success === false) {
    throw new Error(data.error || 'فشل جلب الصور من Google Drive عبر Apps Script');
  }

  return data.files || [];
}

/**
 * Renames a Google Drive file using Google Apps Script Web App.
 */
export async function renameDriveFile(fileId: string, newName: string, appsScriptUrl: string, apiKey: string): Promise<void> {
  if (!appsScriptUrl) {
    throw new Error('الرجاء إعداد رابط Google Apps Script Web App في تبويب الإعدادات أولاً.');
  }

  const response = await fetch(appsScriptUrl, {
    method: 'POST',
    mode: 'cors',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8', // Plain text prevents CORS preflight issues in some GAS setups
    },
    body: JSON.stringify({
      action: 'rename',
      fileId,
      newName,
      apiKey,
    }),
  });

  if (!response.ok) {
    throw new Error('فشل إرسال طلب تعديل الاسم إلى Google Apps Script');
  }

  const data = await response.json();
  if (data && data.success === false) {
    throw new Error(data.error || 'فشل تعديل الاسم في Google Drive');
  }
}

/**
 * Deletes a Google Drive file using Google Apps Script Web App.
 */
export async function deleteDriveFile(fileId: string, appsScriptUrl: string, apiKey: string): Promise<void> {
  if (!appsScriptUrl) {
    throw new Error('الرجاء إعداد رابط Google Apps Script Web App في تبويب الإعدادات أولاً.');
  }

  const response = await fetch(appsScriptUrl, {
    method: 'POST',
    mode: 'cors',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify({
      action: 'delete',
      fileId,
      apiKey,
    }),
  });

  if (!response.ok) {
    throw new Error('فشل إرسال طلب الحذف إلى Google Apps Script');
  }

  const data = await response.json();
  if (data && data.success === false) {
    throw new Error(data.error || 'فشل حذف الملف من Google Drive');
  }
}

/**
 * Uploads an image file to a Google Drive folder using Google Apps Script Web App.
 */
export async function uploadImageToDrive(
  folderId: string,
  file: File,
  customName: string,
  appsScriptUrl: string,
  apiKey: string
): Promise<DriveFile> {
  if (!appsScriptUrl) {
    throw new Error('الرجاء إعداد رابط Google Apps Script Web App في تبويب الإعدادات أولاً.');
  }

  const fileBase64 = await fileToBase64(file);
  const fileName = customName.trim() ? customName.trim() : file.name;

  const response = await fetch(appsScriptUrl, {
    method: 'POST',
    mode: 'cors',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify({
      action: 'upload',
      folderId,
      fileName,
      fileBase64,
      mimeType: file.type || 'image/jpeg',
      apiKey,
    }),
  });

  if (!response.ok) {
    throw new Error('فشل إرسال ملف الصورة لـ Google Apps Script');
  }

  const data = await response.json();
  if (data && data.success === false) {
    throw new Error(data.error || 'فشل رفع وحفظ الصورة في Google Drive');
  }

  return data.file;
}
