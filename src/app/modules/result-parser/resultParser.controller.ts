
import { Request, Response } from 'express';
import httpStatus from 'http-status';
import catchAsync from '../../shared/catchAsync';
import sendResponse from '../../shared/sendResponse';
import { resultParserService } from './resultParser.service';
import ApiError from '../../errors/api.error';

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

  console.log(`[Upload] File received: ${req.file.mimetype}, size: ${req.file.buffer?.length} bytes`);

  const parseResult = await resultParserService.parsePDFBuffer(fileBuffer);
  console.log(`[Parser] Total parsed: ${parseResult.totalParsed}`);

  const { savedCount } = await resultParserService.saveParsedResults(parseResult.students);
  console.log(`[DB] Total saved: ${savedCount}`);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: `Parsed ${parseResult.totalParsed} records, saved ${savedCount} to database`,
    data: {
      parsedCount: parseResult.totalParsed,
      savedCount,
      sample: parseResult.students.slice(0, 5),
    },
  });
});

export const resultParserController = {
  uploadAndParseResultPDF,
};