import { Request, Response } from 'express';
import httpStatus from 'http-status';
import catchAsync from '../../shared/catchAsync';
import sendResponse from '../../shared/sendResponse';
import ApiError from '../../errors/api.error';
import { resultParserService } from './resultParser.service';

interface UploadRequest extends Request {
  file?: Express.Multer.File;
}

const uploadAndParseResultPDF = catchAsync(async (req: UploadRequest, res: Response) => {
  if (!req.file) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'No file uploaded');
  }

  let fileBuffer: Buffer;

  if (req.file.buffer && req.file.buffer.length > 0) {
    fileBuffer = req.file.buffer;
  } else if (req.file.path) {
    const fs = await import('fs');
    fileBuffer = fs.readFileSync(req.file.path);
  } else {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'File buffer is empty — ensure memory storage is used',
    );
  }

  console.log(
    `[Upload] File received: ${req.file.mimetype}, size: ${fileBuffer.length} bytes | name: ${req.file.originalname}`,
  );

  // 1. Parse PDF
  const parseResult = await resultParserService.parseResultPdf(
    fileBuffer,
    req.file.originalname, // important for regulation detection
  );

  console.log(`[Parser] Total parsed: ${parseResult.totalParsed}`);

  // 2. Save to DB + cache invalidate + warm
  const saveResult = await resultParserService.saveParsedResults(parseResult);

  console.log(
    `[DB] saved=${saveResult.savedCount} | linked=${saveResult.linkedCount} | orphan=${saveResult.orphanCount}`,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: `Parsed ${parseResult.totalParsed} records, saved ${saveResult.savedCount} to database`,
    data: {
      parsedCount: parseResult.totalParsed,
      savedCount: saveResult.savedCount,
      linkedCount: saveResult.linkedCount,
      orphanCount: saveResult.orphanCount,
      orphanRolls: saveResult.orphanRolls.slice(0, 20),
      meta: parseResult.meta,
      sample: parseResult.students.slice(0, 5),
    },
  });
});

export const resultParserController = {
  uploadAndParseResultPDF,
};