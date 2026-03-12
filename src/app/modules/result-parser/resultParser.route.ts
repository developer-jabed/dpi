import express from 'express';
import { resultParserController } from './resultParser.controller';
import { fileUploader } from '../../helper/fileUploader';

const router = express.Router();

router.post(
  '/upload',
  (req, res, next) => {
    fileUploader.uploadToMemory.single('file')(req, res, (err) => {
      console.log('multer done — file:', JSON.stringify({
        fieldname: req.file?.fieldname,
        mimetype: req.file?.mimetype,
        size: req.file?.size,
        bufferLength: req.file?.buffer?.length,
        hasBuffer: !!req.file?.buffer,
      }));
      if (err) return next(err);
      next();
    });
  },
  resultParserController.uploadAndParseResultPDF,
);

export const resultParserRoutes = router;