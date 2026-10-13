"""
统一 API 报错口径。

成功响应约定：{"ok": True, ...}
失败响应约定：
    {
        "ok": False,
        "error": {"code": "USER_NOT_FOUND", "message": "用户不存在"},
        "detail": "用户不存在",          # 向后兼容：老前端只读 detail 字符串
    }

- 业务代码优先抛 AppError(code, message, status_code)，code 即机器可读的错误码；
- 存量 HTTPException(detail="...") 会被全局 handler 归一化为上述形状（code 按状态码映射）；
- Pydantic 校验错误 / 未捕获异常同样归一化，不再出现 {"detail": [...]} 数组或英文 "Internal Server Error"。
"""
from __future__ import annotations

import logging
from typing import Any, Optional

from fastapi import Request
from fastapi.exceptions import HTTPException as FastAPIHTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger(__name__)


# ─── 错误码 ──────────────────────────────────────────────────────────────────

class ErrorCode:
    BAD_REQUEST = "BAD_REQUEST"
    UNAUTHORIZED = "UNAUTHORIZED"
    FORBIDDEN = "FORBIDDEN"
    NOT_FOUND = "NOT_FOUND"
    CONFLICT = "CONFLICT"
    RATE_LIMITED = "RATE_LIMITED"
    VALIDATION_ERROR = "VALIDATION_ERROR"
    SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE"
    INTERNAL_ERROR = "INTERNAL_ERROR"


_STATUS_TO_CODE = {
    400: ErrorCode.BAD_REQUEST,
    401: ErrorCode.UNAUTHORIZED,
    403: ErrorCode.FORBIDDEN,
    404: ErrorCode.NOT_FOUND,
    409: ErrorCode.CONFLICT,
    422: ErrorCode.VALIDATION_ERROR,
    429: ErrorCode.RATE_LIMITED,
    503: ErrorCode.SERVICE_UNAVAILABLE,
}


class AppError(Exception):
    """业务异常：携带机器可读错误码 + 面向用户的中文消息。"""

    def __init__(
        self,
        code: str,
        message: str,
        status_code: int = 400,
        details: Optional[dict[str, Any]] = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details or {}


def fail_body(code: str, message: str, details: Optional[dict[str, Any]] = None) -> dict[str, Any]:
    body: dict[str, Any] = {
        "ok": False,
        "error": {"code": code, "message": message},
        "detail": message,  # 向后兼容老前端
    }
    if details:
        body["error"]["details"] = details
    return body


def _message_from_detail(detail: Any) -> str:
    if isinstance(detail, str):
        return detail
    if isinstance(detail, (list, tuple)) and detail:
        first = detail[0]
        if isinstance(first, dict):
            loc = ".".join(str(p) for p in first.get("loc", []) if p != "body")
            msg = str(first.get("msg", ""))
            return f"{loc}: {msg}".strip(": ") if loc else msg
        return str(first)
    return "请求处理失败，请稍后重试。"


# ─── 全局 handler ────────────────────────────────────────────────────────────

async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content=fail_body(exc.code, exc.message, exc.details or None),
    )


async def http_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """归一化所有 HTTPException（含 FastAPI/Starlette 两种）。"""
    status_code = getattr(exc, "status_code", 500)
    detail = getattr(exc, "detail", None)
    headers = getattr(exc, "headers", None)
    message = _message_from_detail(detail)
    code = _STATUS_TO_CODE.get(status_code, ErrorCode.INTERNAL_ERROR)
    if status_code >= 500:
        logger.error("HTTP %s %s -> %s", status_code, request.url.path, message)
        message = "服务暂不可用，请稍后重试。"
        code = ErrorCode.INTERNAL_ERROR
    return JSONResponse(
        status_code=status_code,
        content=fail_body(code, message),
        headers=headers,
    )


async def validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    try:
        raw = exc.errors()
    except Exception:
        raw = []
    message = _message_from_detail(raw)
    logger.warning("请求参数校验失败 %s: %s", request.url.path, message)
    return JSONResponse(
        status_code=422,
        content=fail_body(ErrorCode.VALIDATION_ERROR, message or "请求参数有误，请检查后重试。"),
    )


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("未捕获异常 %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content=fail_body(ErrorCode.INTERNAL_ERROR, "服务暂不可用，请稍后重试。"),
    )
