/**
 * Query optimization utilities for performance
 * Use for dashboard and large data fetches
 */

export const queryConfig = {
  // Use for large entity lists
  listWithPagination: (pageSize = 100) => ({
    staleTime: 1000 * 60 * 5, // 5 minutes
    cacheTime: 1000 * 60 * 10, // 10 minutes
    keepPreviousData: true,
  }),

  // Use for KPI metrics (cache longer)
  kpiMetrics: () => ({
    staleTime: 1000 * 60 * 15, // 15 minutes
    cacheTime: 1000 * 60 * 30, // 30 minutes
  }),

  // Use for filter dropdowns (cache very long)
  staticLists: () => ({
    staleTime: 1000 * 60 * 60, // 1 hour
    cacheTime: 1000 * 60 * 120, // 2 hours
  }),

  // Use for real-time updates
  liveData: () => ({
    staleTime: 0,
    cacheTime: 1000 * 30, // 30 seconds
    refetchInterval: 5000, // 5 seconds
  }),
};

/**
 * Memoization helper for derived data
 * Use useMemo directly in components
 */
export const memoHelper = (deps) => {
  // Use useMemo hook directly in components instead of this helper
  return deps;
};

/**
 * Filter optimization: use Set for O(1) lookups
 */
export const createIdSet = (items, idField = 'id') => {
  return new Set(items.map(item => item[idField]).filter(Boolean));
};

/**
 * Batch filter: check multiple conditions efficiently
 */
export const batchFilter = (items, conditions) => {
  return items.filter(item =>
    Object.entries(conditions).every(([key, value]) => item[key] === value)
  );
};