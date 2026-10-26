import { z } from "zod";

const promoteBatch = z.object({
  body: z.object({
    fromGroupId: z.number().int().positive(),
    fromSemesterId: z.number().int().positive(),
    toGroupId: z.number().int().positive(),
    toSemesterId: z.number().int().positive(),
  }),
});

const promoteSingleStudent = z.object({
  body: z.object({
    studentId: z.number().int().positive(),
    toSemesterId: z.number().int().positive(),
    toGroupId: z.number().int().positive().optional(),
  }),
});

const applyResult = z.object({
  body: z.object({
    diplomaResultId: z.number().int().positive(),
  }),
});

export const enrollmentValidation = {
  promoteBatch,
  promoteSingleStudent,
  applyResult,
};