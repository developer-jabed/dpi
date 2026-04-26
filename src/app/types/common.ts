// src/types/express/index.d.ts

import { Role } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: Role;

      };
    }
  }
}