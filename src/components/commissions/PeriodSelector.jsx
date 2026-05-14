import React, { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'

const PRESET_PERIODS = [
  { id: 'today', label: 'Heute', key: 'today' },
  { id: 'this_month', label: 'Dieser Monat', key: 'this_month' },
  { id: 'last_month', label: 'Letzter Monat', key: 'last_month' },
  { id: 'this_quarter', label: 'Dieses Quartal', key: 'this_quarter' },
  { id: 'last_quarter', label: 'Letztes Quartal', key: 'last_quarter' },
  { id: 'this_year', label: 'Dieses Jahr', key: 'this_year' },
  { id: 'last_year', label: 'Letztes Jahr', key: 'last_year' },
  { id: 'last_30', label: 'Letzte 30 Tage', key: 'last_30' },
  { id: 'last_90', label: 'Letzte 90 Tage', key: 'last_90' },
  { id: 'last_12m', label: 'Letzte 12 Monate', key: 'last_12m' },
  { id: 'custom', label: 'Benutzerdefiniert', key: 'custom' },
]

const calculatePeriod = (presetId, startDate = null, endDate = null) => {
  const today = new Date()
  let start, end

  switch (presetId) {
    case 'today':
      start = new Date(today)
      end = new Date(today)
      break
    case 'this_month':
      start = new Date(today.getFullYear(), today.getMonth(), 1)
      end = new Date(today.getFullYear(), today.getMonth() + 1, 0)
      break
    case 'last_month':
      start = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      end = new Date(today.getFullYear(), today.getMonth(), 0)
      break
    case 'this_quarter':
      const q = Math.floor(today.getMonth() / 3)
      start = new Date(today.getFullYear(), q * 3, 1)
      end = new Date(today.getFullYear(), q * 3 + 3, 0)
      break
    case 'last_quarter':
      const lq = Math.floor(today.getMonth() / 3) - 1
      start = new Date(today.getFullYear(), lq * 3, 1)
      end = new Date(today.getFullYear(), lq * 3 + 3, 0)
      break
    case 'this_year':
      start = new Date(today.getFullYear(), 0, 1)
      end = new Date(today.getFullYear(), 11, 31)
      break
    case 'last_year':
      start = new Date(today.getFullYear() - 1, 0, 1)
      end = new Date(today.getFullYear() - 1, 11, 31)
      break
    case 'last_30':
      end = new Date(today)
      start = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
      break
    case 'last_90':
      end = new Date(today)
      start = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000)
      break
    case 'last_12m':
      end = new Date(today)
      start = new Date(today.getTime() - 365 * 24 * 60 * 60 * 1000)
      break
    case 'custom':
      start = startDate ? new Date(startDate) : new Date(today)
      end = endDate ? new Date(endDate) : new Date(today)
      break
    default:
      start = new Date(today.getFullYear(), today.getMonth(), 1)
      end = new Date(today.getFullYear(), today.getMonth() + 1, 0)
  }

  return { start, end }
}

const formatDateForInput = (date) => date.toISOString().split('T')[0]
const formatDateDisplay = (date) => date.toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' })

export default function PeriodSelector({ onPeriodChange, initialPeriod = 'this_month' }) {
  const [selectedPreset, setSelectedPreset] = useState(initialPeriod)
  const [customStart, setCustomStart] = useState(formatDateForInput(new Date()))
  const [customEnd, setCustomEnd] = useState(formatDateForInput(new Date()))

  const period = useMemo(() => {
    if (selectedPreset === 'custom') {
      return calculatePeriod('custom', customStart, customEnd)
    }
    return calculatePeriod(selectedPreset)
  }, [selectedPreset, customStart, customEnd])

  const handlePresetChange = (presetId) => {
    setSelectedPreset(presetId)
    const newPeriod = presetId === 'custom' 
      ? calculatePeriod('custom', customStart, customEnd)
      : calculatePeriod(presetId)
    onPeriodChange(newPeriod)
  }

  const handleCustomChange = (field, value) => {
    if (field === 'start') setCustomStart(value)
    if (field === 'end') setCustomEnd(value)
    
    if (selectedPreset === 'custom') {
      const newPeriod = calculatePeriod('custom', 
        field === 'start' ? value : customStart,
        field === 'end' ? value : customEnd
      )
      onPeriodChange(newPeriod)
    }
  }

  const displayLabel = useMemo(() => {
    const start = formatDateDisplay(period.start)
    const end = formatDateDisplay(period.end)
    return `${start} – ${end}`
  }, [period])

  const isCustom = selectedPreset === 'custom'

  return (
    <div className="space-y-3">
      {/* Preset Buttons */}
      <div className="flex flex-wrap gap-2">
        {PRESET_PERIODS.map(preset => (
          <Button
            key={preset.id}
            variant={selectedPreset === preset.id ? 'default' : 'outline'}
            size="sm"
            onClick={() => handlePresetChange(preset.id)}
            className="text-xs"
          >
            {preset.label}
          </Button>
        ))}
      </div>

      {/* Custom Date Range Input */}
      {isCustom && (
        <div className="flex gap-2 items-end flex-wrap">
          <div className="flex-1 min-w-40 space-y-1">
            <label className="text-xs font-semibold text-muted-foreground">Von</label>
            <Input
              type="date"
              value={customStart}
              onChange={(e) => handleCustomChange('start', e.target.value)}
              className="h-9 text-sm"
            />
          </div>
          <div className="flex-1 min-w-40 space-y-1">
            <label className="text-xs font-semibold text-muted-foreground">Bis</label>
            <Input
              type="date"
              value={customEnd}
              onChange={(e) => handleCustomChange('end', e.target.value)}
              className="h-9 text-sm"
            />
          </div>
        </div>
      )}

      {/* Period Display */}
      <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg border border-border">
        <Calendar className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-semibold text-foreground">{displayLabel}</span>
      </div>
    </div>
  )
}