import React from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'

/** 指标卡：标题 + 大数字 + 环比/副标题 */
export function StatCard({ label, value, sub, trend, icon, accent = '#ddb7ff' }: {
  label: string
  value: string | number
  sub?: string
  trend?: { value: string; up: boolean }
  icon?: React.ReactNode
  accent?: string
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5 relative overflow-hidden">
      <div
        className="absolute top-0 left-0 right-0 h-[2px]"
        style={{ background: `linear-gradient(90deg, ${accent}, transparent)` }}
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted">{label}</span>
        {icon && <span style={{ color: accent }}>{icon}</span>}
      </div>
      <div className="mt-2 font-display text-3xl font-bold text-on-surface">{value}</div>
      <div className="mt-1.5 flex items-center gap-2 text-xs">
        {trend && (
          <span className={`inline-flex items-center gap-1 ${trend.up ? 'text-emerald-400' : 'text-red-400'}`}>
            {trend.up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {trend.value}
          </span>
        )}
        {sub && <span className="text-muted">{sub}</span>}
      </div>
    </div>
  )
}
