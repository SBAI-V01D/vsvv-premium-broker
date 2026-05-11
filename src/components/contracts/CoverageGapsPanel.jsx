import React, { useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { AlertCircle, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

const COMMON_GAPS = [
  {
    sparte: 'rechtsschutz_privat',
    label: '⚖️ Rechtsschutz',
    description: 'Schützt vor Rechtskosten bei Konflikten'
  },
  {
    sparte: 'unfall_privat',
    label: '🚨 Unfallversicherung',
    description: 'Invalidität und Todesfall durch Unfall'
  },
  {
    sparte: 'bvg',
    label: '🎯 BVG/Pensionskasse',
    description: 'Altersvorsorge und Invaliditätsschutz'
  },
  {
    sparte: 'leben_3a',
    label: '💰 Säule 3a',
    description: 'Todesfallabsicherung und Altersvorsorge'
  },
  {
    sparte: 'ktg',
    label: '💼 Krankentaggeld',
    description: 'Einkommenssicherung bei Krankheit'
  }
]

export default function CoverageGapsPanel({ contracts, onAddCoverage }) {
  const gaps = useMemo(() => {
    const existingSpartes = new Set(contracts.map(c => c.sparte || c.insurance_type).filter(Boolean))
    return COMMON_GAPS.filter(gap => !existingSpartes.has(gap.sparte))
  }, [contracts])

  if (gaps.length === 0) return null

  return (
    <Card className="border-amber-200 bg-amber-50">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-sm text-amber-900 mb-2">💡 Beratungs-Potential</h4>
            <p className="text-xs text-amber-800 mb-3">
              Diese Versicherungen gehören nicht zur aktuellen Abdeckung:
            </p>
            <div className="space-y-2">
              {gaps.map(gap => (
                <div key={gap.sparte} className="flex items-start justify-between gap-3 p-2 bg-white/50 rounded border border-amber-100">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-amber-900">{gap.label}</p>
                    <p className="text-[11px] text-amber-700 mt-0.5">{gap.description}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-amber-700 hover:bg-amber-100 text-xs flex-shrink-0 h-7 px-2"
                    onClick={() => onAddCoverage(gap.sparte)}
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Chance
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}