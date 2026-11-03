import { BadRequestException } from '@nestjs/common';
import type { PageResponse } from './paginationResponses.js';

export function getPageWindow(page: number, pageSize: number) {
  return { offset: (page - 1) * pageSize, limit: pageSize + 1 };
}

export function parsePage(rawPage: unknown, pageSize: number): number {
  const page = rawPage === undefined
    ? 1
    : typeof rawPage === 'string' && /^[1-9][0-9]*$/.test(rawPage) ? Number(rawPage) : NaN;
  const { offset, limit } = getPageWindow(page, pageSize);
  if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(offset + limit)) {
    throw new BadRequestException('Invalid page');
  }
  return page;
}

export function createPageResponse<T>(rows: T[], page: number, pageSize: number): PageResponse<T> {
  return {
    items: rows.slice(0, pageSize),
    page,
    hasNext: rows.length > pageSize,
  };
}
