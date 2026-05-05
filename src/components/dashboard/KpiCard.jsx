import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { useNavigate } from 'react-router-dom'

export default function KpiCard({ label, value, sub, icon: Icon, color, path, trend }) {
  const navigate = useNavigate()
  return (
    <Card
      className={`cursor-pointer hover:shadow-lg transition-all border-l-4 ${color?.border || 'border-l-primary'}`}
      onClick={() => path && navigate(path)}
    >
      <CardContent className="p-5 flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
          <p className="text-3xl font-extrabold text-foreground leading-none">{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          {trend !== undefined && (
            <p className={`text-xs font-medium mt-1 ${trend >= 0 ? 'text-green-600' : 'text-red-500'}`}>
              {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
            </p>
          )}
        </div>
        {Icon && (
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${color?.bg || 'bg-primary/10'}`}>
            <Icon className={`w-6 h-6 ${color?.icon || 'text-primary'}`} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}