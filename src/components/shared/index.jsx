/**
 * Shared Component Library — Central Export
 *
 * Usage:
 *   import { PageHeader, FilterBar, StandardTable, StatusBadge, ConfirmDialog } from '@/components/shared'
 */

export { default as PageHeader }    from './PageHeader'
export { default as FilterBar }     from './FilterBar'
export { default as EmptyState, LoadingState, LoadingTable, LoadingCard, LoadingKPI } from './EmptyState'
export { default as KpiCard }       from './KpiCard'
export { default as ActionMenu }    from './ActionMenu'
export { default as StandardTable } from './StandardTable'
export { default as ConfirmDialog } from './ConfirmDialog'
export { default as StatusBadge }   from './StatusBadge'

// Skeleton
export {
  default as SkeletonLoader,
  SkeletonTable,
  SkeletonCard,
  SkeletonKpiRow,
  SkeletonText,
} from './SkeletonLoader'

// Form System
export {
  default as FormField,
  FormInput,
  FormTextarea,
  FormSelect,
  FormDateInput,
  FormCheckbox,
  FormGroup,
  FormSection,
} from './FormField'

// Modal + Detail
export { default as StandardModal }  from './StandardModal'
export { default as DetailLayout }   from './DetailLayout'
export { default as DetailCard, DetailField, DetailFieldGrid } from './DetailCard'