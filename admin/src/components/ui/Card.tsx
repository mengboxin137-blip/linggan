import React from 'react'

/** 统一卡片容器 */
export function Card({ children, className = '', padding = true }: {
  children: React.ReactNode
  className?: string
  padding?: boolean
}) {
  return (
    <div className={`rounded-2xl border border-border bg-surface ${padding ? 'p-5' : ''} ${className}`}>
      {children}
    </div>
  )
}

/** 卡片标题行 */
export function CardHeader({ title, subtitle, action }: {
  title: string
  subtitle?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between mb-4">
      <div>
        <h3 className="text-base font-semibold text-on-surface">{title}</h3>
        {subtitle && <p className="text-xs text-muted mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}
