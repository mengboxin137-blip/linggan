import { useState, useEffect, useMemo } from 'react'
import { Activity, Users, CheckCircle2, Timer, Layers, AlertTriangle, RefreshCw, Wallet } from 'lucide-react'
import { adminFetch } from '../lib/admin-api'
import { Card, CardHeader } from '../components/ui/Card'
import { StatCard } from '../components/ui/StatCard'
import { DataTable } from '../components/ui/DataTable'
import { Badge, TaskStatusBadge } from '../components/ui/Badge'
import { LoadingSkeleton, ErrorState, PageHeader } from '../components/ui/Feedback'
import { LineChart, DonutChart, MiniBars } from '../components/charts/Charts'

interface DailyData { day: string; calls: number; success: number; users: number }
interface ModelData { name: string; value: number; color: string }
interface RecentTask {
  id: string; type: string; status: string; modelId: string
  elapsed: string; userEmail: string; error?: string; createdAt: string
}
interface StatsData {
  today_calls: number; today_users: number; total_tasks: number
  success_rate: number; avg_duration_sec: number
  daily: DailyData[]; model_usage: ModelData[]; today_by_category?: Record<string, number>
}
interface TaskDayStat { day: string; completed: number; failed: number; processing: number; cancelled: number; other: number }
interface TaskStats {
  ok: boolean
  daily: TaskDayStat[]
  today: { total: number; completed: number; failed: number; processing: number; success_rate: number }
  fail_reasons: { reason: string; count: number }[]
  active_users: { week: number; today: number }
  stuck_tasks: { id: string; type: string; created_at: string }[]
}
interface FinanceData {
  total_revenue_yuan: number; today_revenue_yuan: number
  total_consumed_yuan: number; today_consumed_yuan: number
  total_users: number; total_credits_issued: number
}
interface QueueInfo { length: number; pending: number }
interface QueueData { ok: boolean; queues: Record<string, QueueInfo> }

const MODEL_CATEGORY_LABELS: Record<string, string> = {
  llm: '文本', vision: '视觉', generate: '图片', other: '其他',
}

const formatDateTime = (value?: string | Date | null) => {
  if (!value) return '暂无记录'
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '暂无记录'
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(date)
}

const fmtMoney = (v: number | undefined) => `¥${Number(v || 0).toFixed(2)}`

export default function Dashboard() {
  const [stats, setStats] = useState<StatsData | null>(null)
  const [taskStats, setTaskStats] = useState<TaskStats | null>(null)
  const [finance, setFinance] = useState<FinanceData | null>(null)
  const [tasks, setTasks] = useState<RecentTask[]>([])
  const [health, setHealth] = useState<{ ok: boolean; redis: boolean; database?: boolean } | null>(null)
  const [queue, setQueue] = useState<QueueData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null)

  const load = async () => {
    setRefreshing(true)
    setError('')
    try {
      const [s, ts, t, h, f, q] = await Promise.all([
        adminFetch('/api/admin/stats').then(r => r.json()),
        adminFetch('/api/admin/task-stats').then(r => r.json()).catch(() => null),
        adminFetch('/api/admin/recent-tasks?limit=8').then(r => r.json()),
        fetch('/api/health').then(r => r.json()),
        adminFetch('/api/admin/finance/stats').then(r => r.json()).catch(() => null),
        adminFetch('/api/queue/stats').then(r => r.ok ? r.json() : null).catch(() => null),
      ])
      setStats(s)
      setTaskStats(ts)
      setTasks(Array.isArray(t) ? t : [])
      setHealth(h)
      setFinance(f)
      setQueue(q)
      setLastSyncedAt(new Date())
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    const el = document.getElementById('page-title')
    if (el) el.textContent = '仪表盘'
    load()
    const iv = setInterval(load, 30000)
    return () => clearInterval(iv)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const queueSummary = useMemo(() => {
    const queues = queue?.queues || {}
    const names = ['high', 'normal', 'low']
    return {
      length: names.reduce((sum, name) => sum + Number(queues[name]?.length || 0), 0),
      pending: names.reduce((sum, name) => sum + Number(queues[name]?.pending || 0), 0),
      dlq: Number(queues.dlq?.length || 0),
    }
  }, [queue])

  const daily = stats?.daily ?? []
  const totalCalls = daily.reduce((s, d) => s + d.calls, 0)
  const totalSuccess = daily.reduce((s, d) => s + d.success, 0)
  const avgRate = totalCalls > 0 ? Math.round(totalSuccess / totalCalls * 100) : 0
  const categorySummary = useMemo(() => {
    const categories = stats?.today_by_category || {}
    const entries = Object.entries(categories)
      .filter(([, count]) => count > 0)
      .map(([category, count]) => `${MODEL_CATEGORY_LABELS[category] || category} ${count}`)
    return entries.length > 0 ? `全部类型 · ${entries.join(' / ')}` : '全部模型类型'
  }, [stats])

  if (loading) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title="仪表盘" subtitle="运营核心指标一览" />
        <LoadingSkeleton rows={6} />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="仪表盘"
        subtitle={lastSyncedAt ? `同步于 ${formatDateTime(lastSyncedAt)} · 每 30 秒自动刷新` : '每 30 秒自动刷新'}
        action={
          <button
            onClick={() => void load()}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border text-xs text-muted hover:text-on-surface hover:bg-white/5 disabled:opacity-50"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} /> 刷新
          </button>
        }
      />

      {error && <ErrorState message={error} onRetry={() => void load()} />}

      {/* 服务状态 */}
      <div className={`flex items-center gap-4 px-5 py-3.5 rounded-2xl border ${health?.ok ? 'bg-emerald-400/5 border-emerald-400/20' : 'bg-red-400/5 border-red-400/20'}`}>
        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${health?.ok ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
        <span className={`text-sm font-semibold ${health?.ok ? 'text-emerald-400' : 'text-red-400'}`}>
          {health === null ? '检测中...' : health.ok ? '所有服务运行正常' : '后端服务异常'}
        </span>
        {health && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
            {[['Redis', health.redis], ['数据库', health.database !== false]].map(([label, ok]) => (
              <span key={String(label)} className={`flex items-center gap-1 ${ok ? 'text-emerald-400' : 'text-red-400'}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${ok ? 'bg-emerald-400' : 'bg-red-400'}`} />{label}
              </span>
            ))}
          </div>
        )}
        {(queueSummary.pending > 0 || queueSummary.dlq > 0) && (
          <div className="ml-auto flex items-center gap-2 text-xs">
            {queueSummary.pending > 0 && <Badge tone="warning">队列积压 {queueSummary.pending}</Badge>}
            {queueSummary.dlq > 0 && <Badge tone="danger">死信 {queueSummary.dlq}</Badge>}
          </div>
        )}
      </div>

      {/* KPI 卡片 */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="今日模型调用"
          value={stats?.today_calls ?? 0}
          sub={categorySummary}
          icon={<Activity size={18} />}
          accent="#a78bfa"
        />
        <StatCard
          label="今日活跃用户"
          value={taskStats?.active_users.today ?? stats?.today_users ?? 0}
          sub={`近 7 天活跃 ${taskStats?.active_users.week ?? '—'} 人`}
          icon={<Users size={18} />}
          accent="#22d3ee"
        />
        <StatCard
          label="今日任务成功率"
          value={`${Math.round((taskStats?.today.success_rate ?? 0) * 100)}%`}
          sub={`成功 ${taskStats?.today.completed ?? 0} / 失败 ${taskStats?.today.failed ?? 0}`}
          icon={<CheckCircle2 size={18} />}
          accent="#34d399"
        />
        <StatCard
          label="平均任务耗时"
          value={`${stats?.avg_duration_sec ?? 0}s`}
          sub={`7 日调用成功率 ${avgRate}%`}
          icon={<Timer size={18} />}
          accent="#fbbf24"
        />
      </div>

      {/* 任务统计 + 队列 */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="任务趋势（近 7 天）" subtitle="按任务状态统计，含失败任务" />
          {taskStats ? (
            <LineChart
              data={taskStats.daily.map(d => ({ day: d.day, value: d.completed + d.failed }))}
              valueKey="value"
              color="#34d399"
              gradientId="task-trend"
            />
          ) : (
            <div className="text-xs text-muted py-8 text-center">任务统计接口暂不可用</div>
          )}
          {taskStats && taskStats.stuck_tasks.length > 0 && (
            <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/5 px-4 py-3">
              <div className="flex items-center gap-2 text-xs text-amber-400 font-medium mb-2">
                <AlertTriangle size={13} /> 卡住的任务（处理中超过 30 分钟）：{taskStats.stuck_tasks.length}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {taskStats.stuck_tasks.slice(0, 8).map(t => (
                  <code key={t.id} className="text-[10px] font-mono text-muted bg-white/5 px-1.5 py-0.5 rounded" title={`${t.type} · ${t.created_at}`}>
                    {t.id.slice(0, 8)}
                  </code>
                ))}
              </div>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="队列状态" subtitle="Redis Streams 实时" />
          <div className="space-y-3 text-sm">
            {(
              [
                ['待处理消息', queueSummary.length, '#22d3ee'],
                ['未确认（PEL）', queueSummary.pending, '#fbbf24'],
                ['死信队列', queueSummary.dlq, queueSummary.dlq > 0 ? '#f87171' : '#34d399'],
              ] as [string, number, string][]
            ).map(([label, value, color]) => (
              <div key={String(label)} className="flex items-center justify-between">
                <span className="text-muted text-xs">{label}</span>
                <span className="font-display text-lg font-bold" style={{ color }}>{value}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-border">
            <div className="text-xs text-muted mb-2">失败原因 Top（近 7 天）</div>
            {taskStats && taskStats.fail_reasons.length > 0 ? (
              <div className="space-y-1.5">
                {taskStats.fail_reasons.slice(0, 5).map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="text-muted shrink-0 w-4">{i + 1}</span>
                    <span className="truncate flex-1 text-on-surface" title={f.reason}>{f.reason}</span>
                    <Badge tone="danger">{f.count}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-muted">近 7 天无失败任务 🎉</div>
            )}
          </div>
        </Card>
      </div>

      {/* 图表行 */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Card>
          <CardHeader title="调用量趋势" subtitle="近 7 天模型调用" />
          <LineChart data={daily.map(d => ({ day: d.day, calls: d.calls }))} valueKey="calls" color="#a78bfa" gradientId="calls-trend" />
        </Card>
        <Card>
          <CardHeader title="模型使用占比" subtitle="近 7 天" />
          <DonutChart data={stats?.model_usage ?? []} centerLabel="总调用" />
        </Card>
        <Card>
          <CardHeader title="活跃用户趋势" subtitle="近 7 天调用用户数" />
          <MiniBars data={daily.map(d => ({ day: d.day, users: d.users }))} valueKey="users" color="#22d3ee" />
        </Card>
      </div>

      {/* 最近任务 */}
      <Card padding={false} className="p-5">
        <CardHeader title="最近任务" subtitle="实时任务状态，含失败原因" />
        <DataTable<RecentTask>
          columns={[
            { key: 'id', title: '任务', render: r => <code className="text-[11px] font-mono text-muted">{r.id.slice(0, 8)}</code> },
            { key: 'type', title: '类型', render: r => <Badge tone="info">{r.type}</Badge> },
            { key: 'status', title: '状态', render: r => <TaskStatusBadge status={r.status} /> },
            { key: 'modelId', title: '模型', render: r => <span className="text-xs truncate max-w-[180px] block" title={r.modelId}>{r.modelId || '—'}</span> },
            { key: 'elapsed', title: '耗时', render: r => <span className="text-xs font-mono">{r.elapsed}</span> },
            {
              key: 'error', title: '失败原因',
              render: r => r.status === 'failed' && r.error
                ? <span className="text-[11px] text-red-400/80 truncate max-w-[220px] block" title={r.error}>{r.error}</span>
                : <span className="text-muted text-xs">—</span>,
            },
            { key: 'userEmail', title: '用户', render: r => <span className="text-xs text-muted">{r.userEmail}</span> },
          ]}
          rows={tasks}
          keyOf={r => r.id}
          emptyText="暂无任务"
        />
      </Card>

      {/* 财务概览 */}
      {finance && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="累计收入" value={fmtMoney(finance.total_revenue_yuan)} icon={<Wallet size={18} />} accent="#34d399" />
          <StatCard label="今日收入" value={fmtMoney(finance.today_revenue_yuan)} sub={`今日消耗 ${fmtMoney(finance.today_consumed_yuan)}`} icon={<Wallet size={18} />} accent="#a78bfa" />
          <StatCard label="累计消耗" value={fmtMoney(finance.total_consumed_yuan)} icon={<Layers size={18} />} accent="#fbbf24" />
          <StatCard label="累计用户" value={finance.total_users} sub={`已发行积分 ${finance.total_credits_issued}`} icon={<Users size={18} />} accent="#22d3ee" />
        </div>
      )}
    </div>
  )
}
