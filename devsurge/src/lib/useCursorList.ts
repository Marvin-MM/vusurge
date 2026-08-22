import { useInfiniteQuery } from "@tanstack/react-query";
import { apiGet, CursorPage } from "@/api/client/axiosClient";

/**
 * The backend never returns a total/page count — every list endpoint is
 * `{ items, hasMore, nextCursor }` (see backend/docs/openapi.json). This
 * wraps TanStack Query's `useInfiniteQuery` around that exact shape so
 * every "load more" list in the app shares one implementation instead of
 * faking page numbers the backend can't provide.
 */
export function useCursorList<T>(
  queryKey: readonly unknown[],
  url: string,
  params?: Record<string, string | number | undefined>,
  options?: { enabled?: boolean }
) {
  const query = useInfiniteQuery({
    queryKey: [...queryKey, params],
    queryFn: ({ pageParam }) =>
      apiGet<CursorPage<T>>(url, { params: { ...params, cursor: pageParam, limit: params?.limit ?? 20 } }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextCursor ?? undefined : undefined),
    enabled: options?.enabled,
  });

  const items = query.data?.pages.flatMap((page) => page.items) ?? [];

  return {
    items,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    hasMore: Boolean(query.hasNextPage),
    loadMore: () => query.fetchNextPage(),
    isLoadingMore: query.isFetchingNextPage,
  };
}
