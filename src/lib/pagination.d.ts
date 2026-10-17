export interface PaginationState {
  page: number;
  totalPages: number;
  offset: number;
  start: number;
  end: number;
  pages: Array<number | 'ellipsis'>;
  hasPrevious: boolean;
  hasNext: boolean;
}

export function getPagination(totalItems: number, pageSize: number, currentPage: number): PaginationState;
