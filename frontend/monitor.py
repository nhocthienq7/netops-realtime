class DeviceIn(BaseModel):
    site_id: int
    name: str = Field(min_length=1, max_length=160)
    vendor: str = "Unknown"
    model: str = ""
    device_type: str = "Other"
    address: str
    ping_enabled: bool = True
    snmp_enabled: bool = False
    snmp_port: int = Field(default=161, ge=1, le=65535)
    snmp_version: str = "2c"
    snmp_community: str = "public"


# THÊM ĐOẠN NÀY
class MonitoringReportIn(BaseModel):
    device_id: int
    status: str
    latency_ms: float | None = None
    error: str | None = None


# CODE CŨ GIỮ NGUYÊN
def device_json(d):
    return {
        "id": d.id,
        "site_id": d.site_id,
        "site": d.site.name if d.site else "",
        "name": d.name,
        "vendor": d.vendor,
        "model": d.model,
        "device_type": d.device_type,
        "address": d.address,
        "ping_enabled": d.ping_enabled,
        "snmp_enabled": d.snmp_enabled,
        "snmp_port": d.snmp_port,
        "snmp_version": d.snmp_version,
        "status": d.status,
        "latency_ms": d.latency_ms,
        "sys_descr": d.sys_descr,
        "last_seen": d.last_seen,
        "last_checked": d.last_checked,
        "last_error": d.last_error,
    }


def owned_device(db, user, device_id):
    d = db.query(Device).filter(
        Device.id == device_id,
        Device.organization_id == user.organization_id
    ).first()

    if not d:
        raise HTTPException(404, "Không tìm thấy thiết bị")

    return d
