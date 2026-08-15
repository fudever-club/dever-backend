import { Request, Response, NextFunction } from 'express';
import { Resource } from '../models/ResourceModel';
import { getFileFromStorage } from '../services/storageService';

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

const isExternalUrl = (value: unknown): value is string => {
    if (typeof value !== 'string' || !value.trim()) return false;
    try {
        const url = new URL(value);
        return url.protocol === 'https:' || url.protocol === 'http:';
    } catch {
        return false;
    }
};

const parseFileData = (value: unknown) => {
    if (typeof value !== 'string') return null;
    const match = value.match(/^data:([^;,]+);base64,([A-Za-z0-9+/=]+)$/);
    if (!match) return null;
    const bytes = Buffer.from(match[2], 'base64');
    if (!bytes.length || bytes.length > MAX_UPLOAD_BYTES) return null;
    return { mimeType: match[1], bytes, encoded: match[2] };
};

const SEED_RESOURCES = [
    {
        title: 'Slide Workshop: Tối Ưu Hóa Next.js 14 App Router & Server Components',
        type: 'Slide',
        category: 'Slide Workshop',
        author: 'Ban Chuyên Môn FU-DEVER',
        description: 'Bộ slide đào tạo chi tiết về kiến trúc Server Components, cơ chế caching 4 tầng và kỹ thuật tối ưu Core Web Vitals.',
        fileUrl: 'https://drive.google.com/file/d/sample_nextjs14_slide/view',
        size: '14.5 MB (PDF)',
    },
    {
        title: 'Mã Nguồn Mẫu: Fullstack Express + TypeScript + Clean Architecture',
        type: 'Source Code',
        category: 'Source Code Mẫu',
        author: 'Dev Team DEVER',
        description: 'Boilerplate chuẩn doanh nghiệp tích hợp sẵn JWT Auth, Mongoose, Docker-compose, Swagger và thanh toán VNPAY.',
        fileUrl: 'https://github.com/fu-dever/vnpay-nodejs-template',
        size: '2.8 MB (GitHub Repo)',
    },
    {
        title: 'Ebook / Cẩm Nang: 100 Thuật Toán Kinh Điển & Bí Kíp Giải CSD201',
        type: 'Ebook / PDF',
        category: 'Ebook / Giáo Trình',
        author: 'ICPC & Competitive Programming Team',
        description: 'Tổng hợp các dạng bài quy hoạch động, cây nhị phân, đồ thị Dijkstra và các bẫy thường gặp trong các kỳ thi FPTU.',
        fileUrl: 'https://drive.google.com/file/d/sample_csd201_algorithms/view',
        size: '8.2 MB (PDF)',
    },
    {
        title: 'Cheatsheet: Trọn Bộ Phím Tắt & Lệnh Git Thực Chiến Dành Cho Dev',
        type: 'Cheatsheet',
        category: 'Cheatsheet & Cẩm Nang',
        author: 'CLB FU-DEVER',
        description: 'Bản tóm tắt trực quan các lệnh Rebase, Cherry-pick, Stash và giải quyết Conflict trong môi trường làm việc nhóm.',
        fileUrl: 'https://drive.google.com/file/d/sample_git_cheatsheet/view',
        size: '1.5 MB (PDF Infographic)',
    },
    {
        title: 'Slide Workshop: Nhập Môn Trí Tuệ Nhân Tạo & Xây Dựng AI RAG Pipeline',
        type: 'Slide',
        category: 'Slide Workshop',
        author: 'AI Research Team DEVER',
        description: 'Hướng dẫn thực chiến tích hợp LangChain, Vector Database và OpenAI API vào ứng dụng web thực tế.',
        fileUrl: 'https://drive.google.com/file/d/sample_ai_rag_workshop/view',
        size: '22.4 MB (PDF)',
    },
];

export const getAllResources = async (req: Request, res: Response, next: NextFunction) => {
    try {
        for (const item of SEED_RESOURCES) {
            const exists = await Resource.findOne({ title: item.title });
            if (!exists) {
                await Resource.create(item);
            }
        }
        const resources = await Resource.find().select('-fileData').sort({ createdAt: -1 });
        res.status(200).json({
            status: 'success',
            results: resources.length,
            data: resources,
        });
    } catch (error) {
        next(error);
    }
};

export const createResource = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { title, type, category, author, description, fileUrl, size, fileName, fileData } = req.body || {};
        if (typeof title !== 'string' || !title.trim()) {
            return res.status(400).json({ status: 'error', message: 'A resource title is required' });
        }

        const uploadedFile = parseFileData(fileData);
        if (fileData && !uploadedFile) {
            return res.status(400).json({
                status: 'error',
                message: 'The uploaded file is invalid or exceeds the 8 MB limit',
            });
        }
        if (!uploadedFile && !isExternalUrl(fileUrl)) {
            return res.status(400).json({
                status: 'error',
                message: 'Provide a valid http(s) document link or choose a local file',
            });
        }

        const resource = await Resource.create({
            title: title.trim(),
            type,
            category,
            author: typeof author === 'string' && author.trim() ? author.trim() : 'Ban Chuyên Môn FU-DEVER',
            description: typeof description === 'string' ? description.trim() : '',
            fileUrl: uploadedFile ? 'uploaded-file' : fileUrl.trim(),
            size: typeof size === 'string' && size.trim() ? size.trim() : uploadedFile ? `${(uploadedFile.bytes.length / (1024 * 1024)).toFixed(2)} MB` : 'External link',
            fileName: uploadedFile ? (typeof fileName === 'string' ? fileName.slice(0, 255) : 'download') : null,
            mimeType: uploadedFile?.mimeType || null,
            fileData: uploadedFile?.encoded || null,
        });

        if (uploadedFile) {
            resource.fileUrl = `${req.protocol}://${req.get('host')}/api/v1/resources/${resource._id}/download`;
            await resource.save();
        }
        res.status(201).json({
            status: 'success',
            data: resource.toObject({ versionKey: false }),
        });
    } catch (error) {
        next(error);
    }
};

export const downloadResource = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const resource = await Resource.findById(req.params.id).select('+fileData');
        if (!resource) {
            return res.status(404).json({ status: 'error', message: 'Tài liệu không tồn tại' });
        }

        // 1. If base64 fileData exists in document
        if (resource.fileData) {
            const content = Buffer.from(resource.fileData, 'base64');
            const filename = resource.fileName || `${resource.title.replace(/[^a-zA-Z0-9_-]+/g, '_')}.pdf`;
            res.setHeader('Content-Type', resource.mimeType || 'application/octet-stream');
            res.setHeader('Content-Length', content.length);
            res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
            return res.status(200).send(content);
        }

        // 2. If fileUrl is a Cloudflare R2 or Upload Proxy URL
        if (resource.fileUrl) {
            const matchKey = resource.fileUrl.match(/fu-dever-storage\/(.+)$/) || resource.fileUrl.match(/\/api\/v1\/upload\/file\/(.+)$/);
            if (matchKey && matchKey[1]) {
                const fileObj = await getFileFromStorage(matchKey[1]);
                if (fileObj) {
                    const filename = resource.fileName || matchKey[1].split('/').pop() || 'resource.pdf';
                    res.setHeader('Content-Type', fileObj.contentType || resource.mimeType || 'application/octet-stream');
                    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
                    if (fileObj.contentLength) {
                        res.setHeader('Content-Length', fileObj.contentLength);
                    }
                    return fileObj.stream.pipe(res);
                }
            }

            // 3. Fallback: redirect to external URL
            return res.redirect(resource.fileUrl);
        }

        return res.status(404).json({ status: 'error', message: 'Tài liệu không có tệp đính kèm' });
    } catch (error) {
        return next(error);
    }
};

export const deleteResource = async (req: Request, res: Response, next: NextFunction) => {
    try {
        await Resource.findByIdAndDelete(req.params.id);
        res.status(200).json({
            status: 'success',
            message: 'Resource deleted successfully',
        });
    } catch (error) {
        next(error);
    }
};
