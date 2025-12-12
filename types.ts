
export enum FileType {
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO',
  AUDIO = 'AUDIO',
  DOCUMENT = 'DOCUMENT',
  ARCHIVE = 'ARCHIVE',
  UNKNOWN = 'UNKNOWN'
}

export interface CloudFile {
  id: string;
  name: string;
  size: number;
  type: FileType;
  parentId: string;
  createdAt: string;
  mimeType: string;
  ownerId: string; // Link to user
  storageKey?: string; // Physical path (e.g., public/content/file.jpg)
  data?: Blob; // Stored in IndexedDB (optional in memory to save RAM)
  // Sharing fields
  isShared?: boolean;
  shareToken?: string;
  shareCreatedAt?: string;
  // Trash fields
  isTrashed?: boolean;
  trashedAt?: string;
}

export interface CloudFolder {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: string;
  ownerId: string;
  // Trash fields
  isTrashed?: boolean;
  trashedAt?: string;
}

export interface User {
  id: string;
  username: string;
  password?: string; // Stored for auth simulation
  email: string;
  role: 'admin' | 'user';
  plan: 'free' | 'pro' | 'enterprise'; // New field
  avatar: string;
  storageUsed: number;
  storageLimit: number;
  createdAt: string;
  isActive: boolean; // New field for blocking
}

export interface CDNConfig {
  provider: 'local' | 'aws' | 'wasabi' | 'google_drive';
  rootPath?: string; // Base path e.g., 'public/content'
  // S3 Fields
  endpoint?: string;
  region?: string;
  bucket?: string;
  accessKey?: string;
  secretKey?: string;
  // Google Drive Fields
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
}

export interface SystemStats {
  totalUsers: number;
  totalFiles: number;
  totalStorage: number;
  recentUploads: { name: string; count: number }[];
}