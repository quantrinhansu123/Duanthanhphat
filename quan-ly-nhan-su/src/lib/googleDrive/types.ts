export type DriveDocumentItem = {
  id: string;
  name: string;
  description: string;
  size: number;
  mimeType: string;
  createdTime: string;
  modifiedTime?: string;
  webViewLink?: string;
  webContentLink?: string;
  thumbnailLink?: string;
  appProperties?: Record<string, string>;
  md5Checksum?: string;
};

export type ResumableUploadInitRequest = {
  name: string;
  mimeType: string;
  description?: string;
  fileSize: number;
};

export type ResumableUploadInitResponse = {
  uploadUrl: string;
  fileId?: string;
};
