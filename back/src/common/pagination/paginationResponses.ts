export type PageResponse<T> = {
  items: T[];
  page: number;
  hasNext: boolean;
};
