import { useState } from 'react'

export interface ChartPoint {
  day: string
  [key: string]: string | number | undefined
}

/** 折线/面积图（通用） */
export function LineChart({ data, valueKey, color, gradientId, height = 120 }: {
  data: Array<{ day: string } & Record<string, unknown>>
  valueKey: string
  color: string
  gradientId: string
  height?: number
}) {
  const [hovered, setHovered] = useState<number | null>(null)
  const values = data.map(d => Number(d[valueKey]) || 0)
  const max = Math.max(...values, 1) * 1.15
  const W = 400, H = height, pad = { l: 8, r: 8, t: 12, b: 4 }
  const iW = W - pad.l - pad.r, iH = H - pad.t - pad.b
  const pts = values.map((v, i) => ({
    x: pad.l + (i / Math.max(values.length - 1, 1)) * iW,
    y: pad.t + (1 - v / max) * iH,
  }))
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const area = pts.length > 0 ? `${line} L${pts[pts.length - 1].x},${H - pad.b} L${pts[0].x},${H - pad.b} Z` : ''

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75, 1].map(t => (
          <line key={t} x1={pad.l} y1={pad.t + t * iH} x2={W - pad.r} y2={pad.t + t * iH} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
        ))}
        {area && <path d={area} fill={`url(#${gradientId})`} />}
        {line && <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
        {pts.map((p, i) => (
          <g key={i}>
            <rect x={p.x - iW / Math.max(values.length, 1) / 2} y={pad.t} width={iW / Math.max(values.length, 1)} height={iH}
              fill="transparent" style={{ cursor: 'crosshair' }}
              onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)} />
            <circle cx={p.x} cy={p.y} r={hovered === i ? 5 : 3}
              fill={hovered === i ? color : '#1e2740'} stroke={color} strokeWidth="2" />
            {hovered === i && (
              <g>
                <rect x={p.x - 28} y={p.y - 26} width={56} height={20} rx="4" fill="#1e2740" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                <text x={p.x} y={p.y - 12} textAnchor="middle" fill={color} fontSize="11" fontFamily="Space Grotesk" fontWeight="600">{values[i]}</text>
              </g>
            )}
          </g>
        ))}
      </svg>
      <div className="flex justify-between px-2 mt-1">
        {data.map((d, i) => <span key={i} className="text-[10px] text-muted">{d.day}</span>)}
      </div>
    </div>
  )
}

export interface DonutSlice {
  name: string
  value: number
  color: string
}

/** 环形图 */
export function DonutChart({ data, centerLabel }: { data: DonutSlice[]; centerLabel?: string }) {
  const [hovered, setHovered] = useState<number | null>(null)
  const total = data.reduce((s, d) => s + d.value, 0)
  const cx = 80, cy = 80, r = 58, inner = 36
  let angle = -Math.PI / 2
  const slices = data.map((d, i) => {
    const sweep = total > 0 ? (d.value / total) * 2 * Math.PI : 0
    const a1 = angle, a2 = angle + sweep; angle = a2
    const ex = hovered === i ? 4 : 0, mid = (a1 + a2) / 2
    const ox = Math.cos(mid) * ex, oy = Math.sin(mid) * ex
    const x1 = cx + ox + Math.cos(a1) * r, y1 = cy + oy + Math.sin(a1) * r
    const x2 = cx + ox + Math.cos(a2) * r, y2 = cy + oy + Math.sin(a2) * r
    const ix1 = cx + ox + Math.cos(a1) * inner, iy1 = cy + oy + Math.sin(a1) * inner
    const ix2 = cx + ox + Math.cos(a2) * inner, iy2 = cy + oy + Math.sin(a2) * inner
    const lg = sweep > Math.PI ? 1 : 0
    return {
      ...d, i, pct: total > 0 ? Math.round(d.value / total * 100) : 0,
      path: `M${ix1.toFixed(2)},${iy1.toFixed(2)} L${x1.toFixed(2)},${y1.toFixed(2)} A${r},${r} 0 ${lg},1 ${x2.toFixed(2)},${y2.toFixed(2)} L${ix2.toFixed(2)},${iy2.toFixed(2)} A${inner},${inner} 0 ${lg},0 ${ix1.toFixed(2)},${iy1.toFixed(2)} Z`,
    }
  })
  const active = hovered !== null ? slices[hovered] : null
  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-center">
        <svg viewBox="0 0 160 160" className="w-36 h-36">
          {slices.map(s => (
            <path key={s.i} d={s.path} fill={s.color}
              opacity={hovered === null || hovered === s.i ? 1 : 0.4}
              style={{ cursor: 'pointer', transition: 'opacity 0.2s' }}
              onMouseEnter={() => setHovered(s.i)} onMouseLeave={() => setHovered(null)} />
          ))}
          <text x={cx} y={cy - 6} textAnchor="middle" fill="#dae2fd" fontSize="18" fontFamily="Space Grotesk" fontWeight="700">
            {active ? active.pct + '%' : total}
          </text>
          <text x={cx} y={cy + 12} textAnchor="middle" fill="#64748b" fontSize="9" fontFamily="Inter">
            {active ? '占比' : (centerLabel || '总调用')}
          </text>
        </svg>
      </div>
      <div className="flex flex-col gap-1.5">
        {slices.map(s => (
          <div key={s.i} className="flex items-center gap-2 text-xs"
            onMouseEnter={() => setHovered(s.i)} onMouseLeave={() => setHovered(null)}
            style={{ cursor: 'pointer', opacity: hovered === null || hovered === s.i ? 1 : 0.5 }}>
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: s.color }} />
            <span className="text-on-surface truncate flex-1">{s.name}</span>
            <span className="font-mono text-muted shrink-0">{s.value}</span>
            <span className="text-xs font-mono text-muted shrink-0 ml-1 w-10 text-right">{s.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** 迷你柱状图（7 天趋势） */
export function MiniBars({ data, valueKey, color }: {
  data: Array<{ day: string } & Record<string, unknown>>
  valueKey: string
  color: string
}) {
  const values = data.map(d => Number(d[valueKey]) || 0)
  const max = Math.max(...values, 1)
  return (
    <div className="flex items-end gap-1" style={{ height: '48px' }}>
      {values.map((v, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
          <div
            className="w-full rounded-sm transition-all"
            style={{ height: `${Math.max(8, (v / max) * 40)}px`, background: color, opacity: 0.35 + 0.65 * (v / max) }}
          />
          <span className="text-[9px] text-muted">{data[i].day.slice(-2)}</span>
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-surface-high border border-border rounded-lg px-2 py-1 text-[10px] text-on-surface whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
            {data[i].day}: {v}
          </div>
        </div>
      ))}
    </div>
  )
}
