from __future__ import annotations

from datetime import datetime
from typing import Any, Mapping

import httpx

from app.core.config import settings


class VapiConfigurationError(RuntimeError):
    """Raised when required Vapi settings are missing."""


def _require_setting(value: str, field_name: str) -> str:
    if value:
        return value
    raise VapiConfigurationError(f"Missing required Vapi setting: {field_name}")


def _headers() -> dict[str, str]:
    api_key = _require_setting(settings.vapi_api_key, "VAPI_API_KEY")
    return {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }


def _base_url() -> str:
    return settings.vapi_base_url.rstrip("/")


def _client_value(client: Mapping[str, Any] | Any, key: str, default: Any = None) -> Any:
    if isinstance(client, Mapping):
        return client.get(key, default)
    return getattr(client, key, default)


def build_assistant_overrides(client: Mapping[str, Any] | Any) -> dict[str, Any]:
    custom_fields = _client_value(client, "custom_fields") or {}

    return {
        "variableValues": {
            "client_id": str(_client_value(client, "id")),
            "client_name": _client_value(client, "full_name"),
            "client_phone_number": _client_value(client, "phone_number"),
            "client_timezone": _client_value(client, "timezone"),
            "follow_up_context": _client_value(client, "follow_up_context") or "",
            "previous_interaction": _client_value(client, "previous_interaction") or "",
            "notes": _client_value(client, "notes") or "",
            "custom_fields": custom_fields,
        }
    }


def build_outbound_call_payload(
    client: Mapping[str, Any] | Any,
    *,
    assistant_id: str | None = None,
    phone_number_id: str | None = None,
    schedule_for: datetime | None = None,
    assistant_overrides: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    resolved_assistant_id = assistant_id or _require_setting(
        settings.vapi_assistant_id,
        "VAPI_ASSISTANT_ID",
    )
    resolved_phone_number_id = phone_number_id or _require_setting(
        settings.vapi_phone_number_id,
        "VAPI_PHONE_NUMBER_ID",
    )

    payload: dict[str, Any] = {
        "assistantId": resolved_assistant_id,
        "phoneNumberId": resolved_phone_number_id,
        "customer": {
            "number": _client_value(client, "phone_number"),
            "name": _client_value(client, "full_name"),
        },
        "assistantOverrides": dict(
            assistant_overrides or build_assistant_overrides(client)
        ),
    }

    if schedule_for is not None:
        payload["schedulePlan"] = {
            "earliestAt": schedule_for.isoformat(),
        }

    return payload


async def start_outbound_call(
    client: Mapping[str, Any] | Any,
    *,
    assistant_id: str | None = None,
    phone_number_id: str | None = None,
    schedule_for: datetime | None = None,
    timeout_seconds: float = 30.0,
) -> dict[str, Any]:
    payload = build_outbound_call_payload(
        client,
        assistant_id=assistant_id,
        phone_number_id=phone_number_id,
        schedule_for=schedule_for,
    )

    async with httpx.AsyncClient(timeout=timeout_seconds) as http_client:
        response = await http_client.post(
            f"{_base_url()}/call",
            headers=_headers(),
            json=payload,
        )
        try:
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            raise RuntimeError(f"Vapi API Error: {exc.response.text}") from exc
        return response.json()


async def get_call(call_id: str, *, timeout_seconds: float = 30.0) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=timeout_seconds) as http_client:
        response = await http_client.get(
            f"{_base_url()}/call/{call_id}",
            headers=_headers(),
        )
        response.raise_for_status()
        return response.json()


async def list_phone_numbers(*, timeout_seconds: float = 30.0) -> list[dict[str, Any]]:
    async with httpx.AsyncClient(timeout=timeout_seconds) as http_client:
        response = await http_client.get(
            f"{_base_url()}/phone-number",
            headers=_headers(),
        )
        response.raise_for_status()
        data = response.json()
        if isinstance(data, list):
            return data
        return data.get("results", [])
