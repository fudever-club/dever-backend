import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { uploadToStorage, getFileFromStorage } from '../services/storageService';

const storage = multer.memoryStorage();

export const uploadImageMiddleware = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB max
  fileFilter: (_req: any, file: any, cb: any) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Chỉ chấp nhận file định dạng hình ảnh (JPEG, PNG, WebP, GIF, SVG)!'));
    }
  },
}).single('file');

export const uploadDocumentMiddleware = multer({
  storage,
  limits: { fileSize: 30 * 1024 * 1024 }, // 30 MB max
  fileFilter: (_req: any, file: any, cb: any) => {
    const allowed = [
      'application/pdf',
      'application/zip',
      'application/x-zip-compressed',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/msword',
      'application/vnd.ms-powerpoint',
      'application/vnd.ms-excel',
      'text/plain',
      'text/markdown',
    ];
    if (allowed.includes(file.mimetype) || file.originalname.match(/\.(pdf|zip|pptx|docx|xlsx|txt|md)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Chỉ chấp nhận file tài liệu (PDF, ZIP, PPTX, DOCX, XLSX, TXT)!'));
    }
  },
}).single('file');

export const uploadAudioMiddleware = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB max
  fileFilter: (_req: any, file: any, cb: any) => {
    const isAudio =
      file.mimetype.startsWith('audio/') ||
      file.originalname.match(/\.(mp3|wav|ogg|m4a|aac|flac|webm|opus)$/i);
    if (isAudio) {
      cb(null, true);
    } else {
      cb(new Error('Chỉ chấp nhận file định dạng âm thanh (MP3, M4A, WAV, OGG, AAC, FLAC)!'));
    }
  },
}).single('file');

export const uploadAudio = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const file = (req as any).file;
    if (!file) {
      return res.status(400).json({
        status: 'error',
        message: 'Không tìm thấy file âm thanh trong request!',
      });
    }

    const folder = req.body.folder || 'audio';
    const result = await uploadToStorage(file, folder);

    res.status(200).json({
      status: 'success',
      message: 'Tải lên file âm thanh thành công',
      data: result,
    });
  } catch (error: any) {
    next(error);
  }
};

export const uploadImage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const file = (req as any).file;
    if (!file) {
      return res.status(400).json({
        status: 'error',
        message: 'Không tìm thấy file hình ảnh trong request!',
      });
    }

    const folder = req.body.folder || 'blog-images';
    const result = await uploadToStorage(file, folder);

    res.status(200).json({
      status: 'success',
      message: 'Tải lên hình ảnh thành công',
      data: result,
    });
  } catch (error: any) {
    next(error);
  }
};

export const uploadDocument = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const file = (req as any).file;
    if (!file) {
      return res.status(400).json({
        status: 'error',
        message: 'Không tìm thấy file tài liệu trong request!',
      });
    }

    const folder = req.body.folder || 'resources';
    const result = await uploadToStorage(file, folder);

    res.status(200).json({
      status: 'success',
      message: 'Tải lên tài liệu thành công',
      data: result,
    });
  } catch (error: any) {
    next(error);
  }
};

export const serveFile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawKey = req.params[0] || req.params.key;
    if (!rawKey) {
      return res.status(400).json({ status: 'error', message: 'Thiếu key định danh file' });
    }

    const fileObj = await getFileFromStorage(rawKey);
    if (!fileObj) {
      return res.status(404).json({ status: 'error', message: 'Không tìm thấy file tài liệu trên hệ thống lưu trữ' });
    }

    res.setHeader('Content-Type', fileObj.contentType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileObj.filename)}"`);
    if (fileObj.contentLength) {
      res.setHeader('Content-Length', fileObj.contentLength);
    }

    fileObj.stream.pipe(res);
  } catch (error) {
    next(error);
  }
};
