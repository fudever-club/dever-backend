import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';

const LOCAL_STORAGE_DIR = path.join(process.cwd(), 'public', 'uploads');
if (!fs.existsSync(LOCAL_STORAGE_DIR)) {
  fs.mkdirSync(LOCAL_STORAGE_DIR, { recursive: true });
}

const getStorageConfig = () => {
  const endpoint =
    process.env.R2_ENDPOINT ||
    (process.env.R2_ACCOUNT_ID
      ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
      : 'https://0cf4dda6c36698e80db232829cf2ecce.r2.cloudflarestorage.com');

  const bucket =
    process.env.R2_BUCKET_NAME ||
    process.env.AWS_S3_BUCKET ||
    'fu-dever-storage';

  const accessKeyId =
    process.env.R2_ACCESS_KEY_ID ||
    process.env.AWS_ACCESS_KEY_ID ||
    'ac51419c5e068e6665276b814f24dfdb';

  const secretAccessKey =
    process.env.R2_SECRET_ACCESS_KEY ||
    process.env.AWS_SECRET_ACCESS_KEY ||
    '1744c1ff8af08b9a42a9566e3540dba846803612527e13a275e9a6821393b2be';

  const apiPort = process.env.PORT || process.env.APP_PORT || 5000;
  let apiServer = process.env.API_SERVER_URL;
  if (!apiServer) {
    if (process.env.RAILWAY_PUBLIC_DOMAIN) {
      apiServer = `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
    } else if (process.env.RAILWAY_STATIC_URL) {
      apiServer = `https://${process.env.RAILWAY_STATIC_URL}`;
    } else if (process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID) {
      apiServer = 'https://dever-backend-production.up.railway.app';
    } else {
      apiServer = `http://localhost:${apiPort}`;
    }
  }

  return {
    endpoint,
    bucket,
    accessKeyId,
    secretAccessKey,
    apiServer: apiServer.replace(/\/+$/, ''),
  };
};

let s3ClientInstance: S3Client | null = null;

export const getS3Client = (): S3Client => {
  if (!s3ClientInstance) {
    const config = getStorageConfig();
    s3ClientInstance = new S3Client({
      region: 'auto',
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      forcePathStyle: true,
    });
  }
  return s3ClientInstance;
};

export interface UploadResult {
  url: string;
  key: string;
  size: number;
  mimetype: string;
  originalName: string;
}

export interface FileDownloadStream {
  stream: Readable;
  contentType: string;
  contentLength?: number;
  filename: string;
}

export const uploadToStorage = async (
  file: any,
  folder: string = 'media'
): Promise<UploadResult> => {
  const config = getStorageConfig();
  const timestamp = Date.now();
  const randomHex = Math.random().toString(36).substring(2, 8);
  const cleanOriginalName = file.originalname
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9.]+/g, '-');

  const key = `${folder}/${timestamp}-${randomHex}-${cleanOriginalName}`;

  // 1. Save locally for instant redundancy and fallback
  try {
    const localFolderPath = path.join(LOCAL_STORAGE_DIR, folder);
    if (!fs.existsSync(localFolderPath)) {
      fs.mkdirSync(localFolderPath, { recursive: true });
    }
    const localFilePath = path.join(LOCAL_STORAGE_DIR, key);
    fs.writeFileSync(localFilePath, file.buffer);
  } catch (err) {
    console.warn('Local storage write warning:', err);
  }

  // 2. Upload to Cloudflare R2 / S3
  try {
    const s3 = getS3Client();
    const command = new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    });
    await s3.send(command);
  } catch (err) {
    console.warn('Cloudflare R2 upload fallback to local storage:', err);
  }

  // Generate public proxy URL served by backend
  const publicProxyUrl = `${config.apiServer}/api/v1/upload/file/${key}`;

  return {
    url: publicProxyUrl,
    key,
    size: file.size,
    mimetype: file.mimetype,
    originalName: file.originalname,
  };
};

export const getFileFromStorage = async (key: string): Promise<FileDownloadStream | null> => {
  const config = getStorageConfig();
  const normalizedKey = key.replace(/^\/+/, '');
  const filename = normalizedKey.split('/').pop() || 'document.pdf';

  // 1. Try fetching from Cloudflare R2 / S3
  try {
    const s3 = getS3Client();
    const command = new GetObjectCommand({
      Bucket: config.bucket,
      Key: normalizedKey,
    });
    const s3Response = await s3.send(command);
    if (s3Response.Body) {
      return {
        stream: s3Response.Body as Readable,
        contentType: s3Response.ContentType || 'application/octet-stream',
        contentLength: s3Response.ContentLength,
        filename,
      };
    }
  } catch (s3Err) {
    console.warn(`S3 read miss for key [${normalizedKey}], checking local filesystem:`, (s3Err as any)?.message);
  }

  // 2. Check local filesystem fallback
  try {
    const localFilePath = path.join(LOCAL_STORAGE_DIR, normalizedKey);
    if (fs.existsSync(localFilePath)) {
      const stats = fs.statSync(localFilePath);
      const readStream = fs.createReadStream(localFilePath);
      return {
        stream: readStream,
        contentType: 'application/octet-stream',
        contentLength: stats.size,
        filename,
      };
    }
  } catch (localErr) {
    console.error('Local file fallback read error:', localErr);
  }

  return null;
};

export const deleteFromStorage = async (key: string): Promise<boolean> => {
  try {
    const config = getStorageConfig();
    const normalizedKey = key.replace(/^\/+/, '');

    // 1. Delete from S3/R2
    try {
      const s3 = getS3Client();
      const command = new DeleteObjectCommand({
        Bucket: config.bucket,
        Key: normalizedKey,
      });
      await s3.send(command);
    } catch (err) {
      console.warn('S3 delete warning:', err);
    }

    // 2. Delete from local disk
    const localFilePath = path.join(LOCAL_STORAGE_DIR, normalizedKey);
    if (fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath);
    }

    return true;
  } catch (error) {
    console.error('Failed to delete file from Storage:', error);
    return false;
  }
};
