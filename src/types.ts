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
  appsScriptUrl: string;
  apiKey: string;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  thumbnailLink?: string;
  webViewLink?: string;
  webContentLink?: string;
}
