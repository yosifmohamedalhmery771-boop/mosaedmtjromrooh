export interface DriveFolder {
  id: string;
  name: string;
  url?: string;
}

export interface Settings {
  folders: DriveFolder[];
  whatsappChannelUrl: string;
  whatsappOrderUrl: string;
  closingPoem: string;
  closingMessages: string[];
  appsScriptUrl: string;
  apiKey: string;
  adminPin: string;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  thumbnailLink?: string;
  webViewLink?: string;
  webContentLink?: string;
}
