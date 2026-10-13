import React from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'

/** 加载骨架 */
export function LoadingSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-10 rounded-xl bg-white/5" />
      ))}
    </div>
  )
}

/** 错误状态 + 重试 */
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="py-10 flex flex-col items-center gap-3 text-center">
      <AlertCircle size={28} className="text-red-400" />
      <p className="text-sm text-muted max-w-md">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-primary/10 text-primary text-sm border border-primary/20 hover:bg-primary/20"
        >
          <RefreshCw size={14} /> 重试
        </button>
      )}
    </div>
  )
}

/** 页面标题 */
export function PageHeader({ title, subtitle, action }: {
  title: string
  subtitle?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between mb-5">
      <div>
        <h2 className="font-display text-xl font-bold text-on-surface">{title}</h2>
        {subtitle && <p className="text-xs text-muted mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}
