import React from 'react'

const STYLES: Record<string, string> = {
  success: 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20',
  danger: 'bg-red-400/10 text-red-400 border-red-400/20',
  warning: 'bg-amber-400/10 text-amber-400 border-amber-400/20',
  info: 'bg-sky-400/10 text-sky-400 border-sky-400/20',
  neutral: 'bg-white/5 text-muted border-border',
  primary: 'bg-primary/10 text-primary border-primary/20',
}

/** 状态徽标 */
export function Badge({ tone = 'neutral', children }: {
  tone?: keyof typeof STYLES
  children: React.ReactNode
}) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] border whitespace-nowrap ${STYLES[tone]}`}>
      {children}
    </span>
  )
}

/** 任务状态 → 徽标 */
export function TaskStatusBadge({ status }: { status: string }) {
  const map: Record<string, { tone: 'success' | 'danger' | 'warning' | 'info' | 'neutral'; label: string }> = {
    completed: { tone: 'success', label: '成功' },
    failed: { tone: 'danger', label: '失败' },
    cancelled: { tone: 'neutral', label: '已取消' },
    processing: { tone: 'info', label: '处理中' },
    pending: { tone: 'warning', label: '排队中' },
    queued: { tone: 'warning', label: '排队中' },
  }
  const v = map[status] || { tone: 'neutral' as const, label: status }
  return <Badge tone={v.tone}>{v.label}</Badge>
}
