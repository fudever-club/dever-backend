import express from 'express';
import {
  uploadImage,
  uploadDocument,
  uploadAudio,
  serveFile,
  uploadImageMiddleware,
  uploadDocumentMiddleware,
  uploadAudioMiddleware,
} from '../controllers/uploadController';
import { requireAuth } from '../middlewares/auth';

const Router = express.Router();

Router.post('/image', requireAuth, uploadImageMiddleware, uploadImage);
Router.post('/document', requireAuth, uploadDocumentMiddleware, uploadDocument);
Router.post('/audio', requireAuth, uploadAudioMiddleware, uploadAudio);
Router.get('/file/*', serveFile);

module.exports = Router;
