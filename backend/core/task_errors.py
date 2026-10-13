class NonRetryableTaskError(RuntimeError):
    """A task failed in a way that retrying the same payload cannot fix."""


_ERROR_RULES: tuple[tuple[str, tuple[str, ...], str], ...] = (
    (
        "external_billing",
        (
            "insufficient balance",
            "billing_error",
            "insufficient_quota",
            "quota_exceeded",
            "account balance",
            "payment required",
            "算力 api 余额不足",
        ),
        "算力 API 余额不足，请先充值后重试，或切换为平台积分算力。",
    ),
    (
        "external_auth",
        (
            "invalid api key",
            "invalid_api_key",
            "api key is invalid",
            "unauthorized api key",
            "authentication failed",
            "401 unauthorized",
            "permission denied by upstream",
            "无效的 api key",
            "算力令牌无效",
        ),
        "算力 API 令牌无效或权限不足，请检查后台算力配置后重试。",
    ),
    (
        "platform_credits",
        ("积分不足", "余额不足", "402"),
        "积分不足，请充值后再继续生成。",
    ),
    (
        "safety",
        (
            "安全系统拦截",
            "内容安全",
            "content_policy",
            "content policy",
            "content_filter",
            "policy_violation",
            "moderation",
            "unsafe",
            "blocked by the safety",
        ),
        "提示词被图像安全系统拦截。请弱化敏感、危险、真实人物或 IP 复刻等描述后重试。",
    ),
    (
        "rate_limited",
        ("429", "rate limit", "too many requests", "发送太频繁", "任务过多", "请求太频繁"),
        "当前请求太频繁，请稍等一会儿再试。",
    ),
    (
        "upstream_unavailable",
        (
            "502",
            "503",
            "504",
            "524",
            "bad gateway",
            "service temporarily unavailable",
            "gateway",
            "html error page",
            "llm 服务不可用",
            "responses proxy failed",
        ),
        "AI 服务暂时繁忙或网关不可用，请稍后重试。",
    ),
    (
        "network",
        (
            "failed to fetch",
            "fetch failed",
            "networkerror",
            "network error",
            "connection reset",
            "connection refused",
            "econnreset",
            "econnrefused",
            "socket hang up",
            "dns lookup failed",
            "getaddrinfo",
            "remote protocol error",
        ),
        "网络连接暂时中断，可能是本地网络或上游连接波动，请稍后重试。",
    ),
    (
        "timeout",
        ("timeout", "timed out", "任务超时", "长时间未更新", "transport failed"),
        "生成耗时超过预期，可能是上游排队或网络波动。请稍后查看历史记录，必要时再重试。",
    ),
    (
        "model_unavailable",
        (
            "missing or disabled",
            "不存在或已禁用",
            "不存在或不可用",
            "未配置",
            "missing responses model name",
            "missing responses endpoint",
            "category=generate",
            "category=llm",
            "category=vision",
        ),
        "当前模型不可用，请切换模型，或联系管理员检查模型配置。",
    ),
    (
        "storage",
        (
            "存储未配置",
            "asset storage",
            "图片资产存储",
            "上传失败",
        ),
        "素材存储服务暂不可用，请稍后再试。",
    ),
    (
        "image_result_empty",
        ("did not return image data", "未返回结果", "没有返回图片", "返回空结果", "empty content"),
        "AI 已响应但没有返回可用图片，请调整提示词或换个模型重试。",
    ),
    (
        "payload_too_large",
        (
            "payload too large",
            "request entity too large",
            "413",
            "file too large",
            "attachment too large",
            "超过 25mb",
            "文件过大",
            "附件过大",
            "图片过大",
        ),
        "上传的图片或附件太大，请压缩后再提交。",
    ),
    (
        "invalid_input",
        (
            "unprocessable entity",
            "invalid request",
            "invalid parameter",
            "invalid payload",
            "bad request",
            "参数错误",
            "参数不完整",
            "请求格式不正确",
        ),
        "生成参数不完整或格式不正确，请检查提示词、尺寸、参考图后重试。",
    ),
)


def _stringify_error(error: object) -> str:
    if isinstance(error, dict):
        for key in ("message", "detail", "error"):
            value = error.get(key)
            if value:
                return _stringify_error(value)
        return str(error)
    return str(error or "").strip()


def _strip_technical_noise(message: str) -> str:
    cleaned = (message or "").strip()
    for prefix in ("RuntimeError:", "ValueError:", "Exception:", "_ResponsesGatewayError:"):
        if cleaned.startswith(prefix):
            cleaned = cleaned[len(prefix):].strip()
    if "Traceback (most recent call last)" in cleaned:
        cleaned = cleaned.split("Traceback (most recent call last)", 1)[0].strip()
    if "<!DOCTYPE html" in cleaned or "<html" in cleaned.lower():
        return "AI 服务暂时繁忙或网关不可用，请稍后重试。"
    return " ".join(cleaned.split())


def to_user_error_message(error: object, fallback: str = "生成失败，请稍后重试。") -> str:
    """Convert raw backend/upstream errors into a short user-facing Chinese message."""

    raw = _strip_technical_noise(_stringify_error(error))
    if not raw:
        return fallback
    lowered = raw.lower()
    for _code, markers, message in _ERROR_RULES:
        if any(marker.lower() in lowered for marker in markers):
            return message
    if len(raw) > 180:
        return f"{raw[:180].rstrip()}..."
    return raw


# 不可重试的上游状态码：请求本身有问题，重试无意义
_NON_RETRYABLE_STATUS_CODES = frozenset({400, 401, 403, 404, 422})

_STATUS_CODE_PATTERN = None


def _get_status_code_pattern():
    global _STATUS_CODE_PATTERN
    if _STATUS_CODE_PATTERN is None:
        import re
        _STATUS_CODE_PATTERN = re.compile(r"\((\d{3})\)")
    return _STATUS_CODE_PATTERN


def is_client_error(error: object) -> bool:
    """判断是否为上游 4xx 客户端错误（重试无法解决）。"""
    text = _stringify_error(error)
    if not text:
        return False
    pattern = _get_status_code_pattern()
    for match in pattern.finditer(text):
        try:
            if int(match.group(1)) in _NON_RETRYABLE_STATUS_CODES:
                return True
        except ValueError:
            continue
    return False


def as_non_retryable(error: BaseException) -> NonRetryableTaskError:
    """将上游 4xx 错误转为 NonRetryableTaskError，避免无意义重试。"""
    return NonRetryableTaskError(str(error) or repr(error))
