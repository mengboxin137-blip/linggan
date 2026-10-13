# 灵感（image.foxapi.cn）后端/前端优化表

> 2026-10-13 整理，含第三方审计 26 条。P0=已造成线上故障或数据风险，P1=健壮性/性能，P2=标准化/可维护性，P3=架构演进。
> 状态：✅已完成 / 🔄进行中 / ⬜待办

## P0 —— 线上 bug（✅ 已全部修复）

| # | 问题 | 位置 | 状态 |
|---|------|------|------|
| 1 | 移动端任务卡死"生产中"：异常重试刷新 `updatedAt`，导致 30 分钟兜底永不触发 | `frontend/src/components/Mobile/useMobileTextToImage.ts` | ✅ |
| 2 | 报错口径不统一：`{"detail": "msg"}` / `{"detail": [...]}` / 英文 500 并存 | `backend/core/api_errors.py`（新建）+ `main.py` 全局 handler | ✅ |
| 3 | reclaim 僵尸任务：`generate` 类消息 PEL 卡死永不认领，DB 永久 processing | `backend/core/queue.py` + `repositories/task_repo.py::mark_failed_in_db` | ✅ |
| 4 | Go 控制平面入队单点故障，无回退 | `backend/core/queue.py`：`_GoControlPlaneUnavailable` → 回退原生入队 | ✅ |
| 5 | 管理员密码无盐 SHA256 | `backend/routers/admin.py`：bcrypt + 旧 hash 自动升级 | ✅ |
| 6 | 管理员登录无任何限流 | `backend/routers/admin.py` + `core/rate_limit.py`：`admin-login` 5次/10分钟 | ✅ |
| 7 | 状态接口 Redis key 过期后直接 404 | `backend/routers/generate.py` + `task_repo.get_from_db`：Go→Redis→PG 三级回退 | ✅ |

## P1 —— 健壮性与性能

| # | 问题 | 方案 | 状态 |
|---|------|------|------|
| 8 | 上游 4xx（如 xAI 400）被重试 4 次 | 4xx → `NonRetryableTaskError`，直接失败不重试 | ⬜ |
| 9 | DLQ 只增不减、无告警 | DLQ 入队/增长接入 `error_alert` | ⬜ |
| 10 | 重试无退避、无延迟，poison 消息瞬间打满 | 延迟重试（Redis ZSET）+ 指数退避 | ⬜ |
| 11 | 单并发瓶颈：`WORKER_CONCURRENCY=1` + uvicorn `--workers 1` | worker 并发 2~4；uvicorn workers 按 CPU | ⬜（配置） |
| 12 | `retry-dlq` 对 generate 24h 内是空操作（执行锁未清） | 重试前删除 `generate_started` 锁 | ⬜ |
| 13 | supervisord `stopwaitsecs` 10s vs worker drain 900s | ini 加 `stopwaitsecs=960` | ⬜（配置） |
| 14 | CORS 全开 `allow_origins=["*"]` | 收敛到明确域名 | ⬜ |
| 15 | 500 响应拼原始异常（信息泄漏） | 已修 admin 登录处；全仓库排查同类 | 🔄（已修 1 处） |
| 16 | `get_queue_stats` 吞异常返回全 0（假健康） | 异常向上传，health 置 false | ⬜ |
| 17 | admin `list_users` 无分页 | limit/offset 分页 | ⬜ |
| 18 | SSE token 走 Query 参数（进日志） | 一次性 ticket 机制 | ⬜ |

## P2 —— 标准化

| # | 问题 | 方案 | 状态 |
|---|------|------|------|
| 19 | `print` 代替 logging，无结构化日志 | 全换 logger；加 task_id 上下文 | ⬜ |
| 20 | `logger.error(f"...{e}")` 无堆栈 | `logger.exception` / `exc_info=True` | ⬜ |
| 21 | `MAX_RETRIES=3` 实际 4 次（off-by-one） | 改条件或改名 `MAX_ATTEMPTS` | ⬜ |
| 22 | 健康检查不覆盖队列与 worker 心跳 | 加队列深度 + worker 心跳 | ⬜ |
| 23 | 配置无类型校验 | 迁 `pydantic-settings` | ⬜ |
| 24 | 核心链路缺集成测试 | transition/nack/reclaim 集成测试 | ⬜ |

## P3 —— 架构演进（RabbitMQ 评估）

**结论：不迁。** 当前 Redis Streams 自研队列已有消费者组/PEL/认领/DLQ/幂等，与业务紧耦合。迁移 = 重写 ~1500 行核心语义 + Go 同步改 + 双跑验证，风险高、当前流量下收益≈0。真实瓶颈是单并发和无告警，不是中间件。未来若单 Redis 吞吐成瓶颈（>1k msg/s）再考虑，渐进方案是先抽象 `QueueBackend` 接口。

## Admin 后台重构

- ✅ 设计系统：`src/components/ui/`（Card/StatCard/DataTable/Badge/EmptyState/Skeleton/PageHeader）
- ✅ 图表库：`src/components/charts/`（LineChart/DonutChart/MiniBars）
- ✅ `admin-api.ts`：`ApiError` 结构化错误，解析新统一格式
- ✅ 后端：`/admin/task-stats`（任务维度统计）+ `recent-tasks` 补 error 字段
- ✅ Dashboard 重写（任务统计/失败原因/卡住任务/队列状态）
- ⬜ 其余页面渐进套用新套件（Users/UsageStats/Finance 等）
