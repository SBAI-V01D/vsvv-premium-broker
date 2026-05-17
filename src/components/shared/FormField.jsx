import React from 'react'
import { cn } from '@/lib/utils'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

/**
 * Zentrales FormField-System für alle Formulare.
 *
 * Basiskomponente <FormField> — wrapper mit Label + Error.
 * Spezialkomponenten:
 *  - <FormInput>     Text-Input
 *  - <FormTextarea>  Textarea
 *  - <FormSelect>    Select Dropdown
 *  - <FormGroup>     Zeile mit mehreren Feldern (grid)
 *
 * Props FormField:
 *  - label: string
 *  - required?: boolean
 *  - error?: string
 *  - hint?: string
 *  - className?: string
 *  - children: ReactNode
 */

export function FormField({ label, required, error, hint, className, children }) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <Label className={cn('text-sm font-medium', error && 'text-destructive')}>
          {label}
          {required && <span className="text-destructive ml-0.5">*</span>}
        </Label>
      )}
      {children}
      {hint && !error && (
        <p className="text-xs text-muted-foreground">{hint}</p>
      )}
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </div>
  )
}

// ─── Input ──────────────────────────────────────────────────────────────────
export function FormInput({ label, required, error, hint, className, fieldClassName, ...inputProps }) {
  return (
    <FormField label={label} required={required} error={error} hint={hint} className={fieldClassName}>
      <Input
        className={cn(error && 'border-destructive focus-visible:ring-destructive', className)}
        {...inputProps}
      />
    </FormField>
  )
}

// ─── Textarea ────────────────────────────────────────────────────────────────
export function FormTextarea({ label, required, error, hint, rows = 3, className, fieldClassName, ...textareaProps }) {
  return (
    <FormField label={label} required={required} error={error} hint={hint} className={fieldClassName}>
      <Textarea
        rows={rows}
        className={cn(error && 'border-destructive focus-visible:ring-destructive', className)}
        {...textareaProps}
      />
    </FormField>
  )
}

// ─── Select ──────────────────────────────────────────────────────────────────
/**
 * Props:
 *  - options: Array<{ value: string, label: string } | string>
 *  - placeholder?: string
 *  - value: string
 *  - onValueChange: (value: string) => void
 */
export function FormSelect({
  label,
  required,
  error,
  hint,
  options = [],
  placeholder = 'Auswählen...',
  value,
  onValueChange,
  disabled,
  fieldClassName,
}) {
  const normalized = options.map(o =>
    typeof o === 'string' ? { value: o, label: o } : o
  )

  return (
    <FormField label={label} required={required} error={error} hint={hint} className={fieldClassName}>
      <Select value={value || ''} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger className={cn(error && 'border-destructive')}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {normalized.map(opt => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FormField>
  )
}

// ─── Group ───────────────────────────────────────────────────────────────────
/**
 * Props:
 *  - cols?: number (default 2)
 *  - className?: string
 */
export function FormGroup({ cols = 2, className, children }) {
  return (
    <div className={cn(`grid gap-4`, `grid-cols-1 sm:grid-cols-${cols}`, className)}>
      {children}
    </div>
  )
}

// ─── Section ─────────────────────────────────────────────────────────────────
export function FormSection({ title, description, className, children }) {
  return (
    <div className={cn('space-y-4', className)}>
      {(title || description) && (
        <div>
          {title && <h3 className="text-sm font-semibold text-foreground">{title}</h3>}
          {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
        </div>
      )}
      {children}
    </div>
  )
}

export default FormField