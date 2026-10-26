import { Request, Response } from "express";
import catchAsync from "../../shared/catchAsync";
import { groupResultPdfService } from "./groupResultPdf.service";

const generateDiplomaReport = catchAsync(async (req: Request, res: Response) => {
  const groupId = Number(req.params.groupId);

  const { pdfBuffer, filename } = await groupResultPdfService.generateDiplomaReportPdf(groupId);

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(pdfBuffer);
});

export const groupResultPdfController = {
  generateDiplomaReport,
};