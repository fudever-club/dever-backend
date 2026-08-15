import express from 'express';
import {
  uploadImage,
  uploadDocument,
  serveFile,
  uploadImageMiddleware,
  uploadDocumentMiddleware,
} from '../controllers/uploadController';
import { requireAuth } from '../middlewares/auth';

const Router = express.Router();

Router.post('/image', requireAuth, uploadImageMiddleware, uploadImage);
Router.post('/document', requireAuth, uploadDocumentMiddleware, uploadDocument);
Router.get('/file/*', serveFile);

module.exports = Router;
