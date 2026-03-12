// src/helpers/pagination.helper.ts

/**
 * Input options coming from query params (usually strings)
 */
export interface PaginationOptions {
  page?: string | number;
  limit?: string | number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc' | string;
  // You can easily extend later with:
  // cursor?: string;
  // sort?: string[]; // for multi-sort support
}

/**
 * Clean, validated and normalized pagination result
 */
export interface PaginationResult {
  page: number;
  limit: number;
  skip: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

export const paginationHelper = {
  calculatePagination,
};

/**
 * Sanitizes and calculates pagination parameters with safe defaults
 * @param options - Raw query params (usually req.query)
 * @returns Normalized pagination object ready for Prisma
 */
function calculatePagination(options: PaginationOptions = {}): PaginationResult {
  // ── Page ───────────────────────────────────────────────
  let page = Number(options.page);
  if (Number.isNaN(page) || page < 1) {
    page = 1;
  }

  // ── Limit ──────────────────────────────────────────────
  let limit = Number(options.limit);
  if (Number.isNaN(limit) || limit < 1) {
    limit = 10;
  }
  // Optional: add reasonable upper bound (anti-DDoS / performance)
  if (limit > 100) {
    limit = 100;
  }

  // ── Skip / Offset ──────────────────────────────────────
  const skip = (page - 1) * limit;

  // ── Sorting ────────────────────────────────────────────
  let sortBy = 'createdAt';
  if (options.sortBy && typeof options.sortBy === 'string' && options.sortBy.trim()) {
    sortBy = options.sortBy.trim();
  }

  let sortOrder: 'asc' | 'desc' = 'desc';
  if (options.sortOrder === 'asc' || options.sortOrder === 'ASC') {
    sortOrder = 'asc';
  } else if (options.sortOrder === 'desc' || options.sortOrder === 'DESC') {
    sortOrder = 'desc';
  }
  // ignore invalid sortOrder values → fallback to 'desc'

  return {
    page,
    limit,
    skip,
    sortBy,
    sortOrder,
  };
}