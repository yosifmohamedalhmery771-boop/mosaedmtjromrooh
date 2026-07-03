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
 * Helper to get authorization headers.
 */
function getHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Lists image files inside a specific Google Drive folder.
 */
export async function listFolderImages(folderId: string, token: string): Promise<DriveFile[]> {
  const q = `'${folderId}' in parents and mimeType contains 'image/' and trashed = false`;
  const fields = 'files(id, name, mimeType, thumbnailLink, webViewLink, webContentLink)';
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=${encodeURIComponent(fields)}&pageSize=100`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData?.error?.message || 'Failed to fetch files from Google Drive');
  }

  const data = await response.json();
  return data.files || [];
}

/**
 * Renames a Google Drive file.
 */
export async function renameDriveFile(fileId: string, newName: string, token: string): Promise<void> {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}`;
  
  const response = await fetch(url, {
    method: 'PATCH',
    headers: getHeaders(token),
    body: JSON.stringify({
      name: newName,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData?.error?.message || 'Failed to rename file');
  }
}

/**
 * Deletes a Google Drive file.
 */
export async function deleteDriveFile(fileId: string, token: string): Promise<void> {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}`;
  
  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData?.error?.message || 'Failed to delete file');
  }
}

/**
 * Uploads an image file to a Google Drive folder.
 */
export async function uploadImageToDrive(
  folderId: string,
  file: File,
  customName: string,
  token: string
): Promise<DriveFile> {
  const metadata = {
    name: customName || file.name,
    parents: [folderId],
  };

  const form = new FormData();
  form.append(
    'metadata',
    new Blob([JSON.stringify(metadata)], { type: 'application/json' })
  );
  form.append('file', file);

  const url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,thumbnailLink,webViewLink,webContentLink';

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: form,
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData?.error?.message || 'Failed to upload image to Google Drive');
  }

  return response.json();
}
