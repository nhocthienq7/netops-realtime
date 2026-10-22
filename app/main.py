import os
from datetime import datetime, timezone
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import desc
from .db import Base, engine, get_db
from .models import User, Organization, Site, Device, Event
from .security import hash_password, verify_password, make_token, current_user

Base.metadata.create_all(bind=engine)
app = FastAPI(title="NetOps Realtime", version="1.0.0", description="Multi-tenant network monitoring API")


app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_origins=[
        "https://netops-realtime.vercel.app",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.mount("/static", StaticFiles(directory="app/static"), name="static")

class RegisterIn(BaseModel):
    organization: str = Field(min_length=2, max_length=160)
    email: str = Field(min_length=5, max_length=255)
    password: str = Field(min_length=12, max_length=128)
class LoginIn(BaseModel):
    email: str
    password: str
class SiteIn(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    address: str = Field(default="", max_length=255)
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
class MonitoringReportIn(BaseModel):
    device_id: int
    status: str
    latency_ms: float | None = None
    error: str | None = None

def device_json(d):
    return {"id":d.id,"site_id":d.site_id,"site":d.site.name if d.site else "",
            "name":d.name,"vendor":d.vendor,"model":d.model,"device_type":d.device_type,
            "address":d.address,"ping_enabled":d.ping_enabled,"snmp_enabled":d.snmp_enabled,
            "snmp_port":d.snmp_port,"snmp_version":d.snmp_version,"status":d.status,
            "latency_ms":d.latency_ms,"sys_descr":d.sys_descr,"last_seen":d.last_seen,
            "last_checked":d.last_checked,"last_error":d.last_error}
def owned_device(db, user, device_id):
    d=db.query(Device).filter(Device.id==device_id,Device.organization_id==user.organization_id).first()
    if not d: raise HTTPException(404,"Không tìm thấy thiết bị")
    return d

@app.get("/", response_class=HTMLResponse)
def home():
    with open("app/static/index.html",encoding="utf-8") as f: return f.read()

@app.get("/health")
def health(): return {"status":"ok","service":"netops-api"}

@app.post("/api/auth/register")
def register(body:RegisterIn, db:Session=Depends(get_db)):
    email=body.email.strip().lower()
    if db.query(User).filter(User.email==email).first(): raise HTTPException(409,"Email đã được sử dụng")
    org=Organization(name=body.organization.strip()); db.add(org); db.flush()
    user=User(organization_id=org.id,email=email,password_hash=hash_password(body.password),role="admin")
    db.add(user); db.flush()
    site=Site(organization_id=org.id,name="Site mặc định",address="");db.add(site);db.commit();db.refresh(user)
    return {"access_token":make_token(user),"token_type":"bearer","email":user.email,"organization":org.name,"role":user.role}

@app.post("/api/auth/login")
def login(body:LoginIn, db:Session=Depends(get_db)):
    user=db.query(User).filter(User.email==body.email.strip().lower()).first()
    if not user or not verify_password(body.password,user.password_hash): raise HTTPException(401,"Email hoặc mật khẩu không đúng")
    return {"access_token":make_token(user),"token_type":"bearer","email":user.email,"organization":user.organization.name,"role":user.role}

@app.get("/api/me")
def me(user:User=Depends(current_user)):
    return {"id":user.id,"email":user.email,"organization":user.organization.name,"role":user.role}

@app.get("/api/sites")
def list_sites(db:Session=Depends(get_db), user:User=Depends(current_user)):
    return [{"id":s.id,"name":s.name,"address":s.address,"device_count":len(s.devices)} for s in db.query(Site).filter_by(organization_id=user.organization_id).order_by(Site.id).all()]

@app.post("/api/sites")
def create_site(body:SiteIn, db:Session=Depends(get_db), user:User=Depends(current_user)):
    s=Site(organization_id=user.organization_id,name=body.name.strip(),address=body.address.strip());db.add(s);db.commit();db.refresh(s)
    return {"id":s.id,"name":s.name,"address":s.address,"device_count":0}

@app.put("/api/sites/{site_id}")
def update_site(
    site_id: int,
    body: SiteIn,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    site = db.query(Site).filter_by(
        id=site_id,
        organization_id=user.organization_id
    ).first()

    if not site:
        raise HTTPException(status_code=404, detail="Không tìm thấy Site")

    site.name = body.name.strip()
    site.address = body.address.strip()

    db.commit()
    db.refresh(site)

    return {
        "id": site.id,
        "name": site.name,
        "address": site.address,
        "device_count": len(site.devices),
    }


@app.delete("/api/sites/{site_id}")
def delete_site(
    site_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    site = db.query(Site).filter_by(
        id=site_id,
        organization_id=user.organization_id
    ).first()

    if not site:
        raise HTTPException(status_code=404, detail="Không tìm thấy Site")

    device_count = db.query(Device).filter_by(
        site_id=site_id,
        organization_id=user.organization_id
    ).count()

    if device_count > 0:
        raise HTTPException(
            status_code=409,
            detail=f"Site vẫn còn {device_count} thiết bị. Hãy chuyển hoặc xóa thiết bị trước."
        )

    db.delete(site)
    db.commit()

    return {"ok": True, "message": "Đã xóa Site"}

@app.get("/api/devices")
def list_devices(db:Session=Depends(get_db), user:User=Depends(current_user)):
    ds=db.query(Device).filter_by(organization_id=user.organization_id).order_by(Device.id.desc()).all()
    return [device_json(d) for d in ds]

@app.post("/api/devices")
def create_device(body:DeviceIn, db:Session=Depends(get_db), user:User=Depends(current_user)):
    site=db.query(Site).filter_by(id=body.site_id,organization_id=user.organization_id).first()
    if not site: raise HTTPException(400,"Site không thuộc tổ chức của tài khoản")
    if body.snmp_version not in ("2c",): raise HTTPException(400,"MVP hiện hỗ trợ SNMPv2c; SNMPv3 cần cấu hình thêm")
    d=Device(organization_id=user.organization_id,**body.model_dump())
    db.add(d);db.commit();db.refresh(d);return device_json(d)

@app.put("/api/devices/{device_id}")
def update_device(device_id:int, body:DeviceIn, db:Session=Depends(get_db), user:User=Depends(current_user)):
    d=owned_device(db,user,device_id)
    site=db.query(Site).filter_by(id=body.site_id,organization_id=user.organization_id).first()
    if not site: raise HTTPException(400,"Site không thuộc tổ chức của tài khoản")
    if body.snmp_version not in ("2c",): raise HTTPException(400,"MVP hiện hỗ trợ SNMPv2c; SNMPv3 cần cấu hình thêm")
    for k,v in body.model_dump().items(): setattr(d,k,v)
    db.commit();db.refresh(d);return device_json(d)

@app.delete("/api/devices/{device_id}")
def delete_device(device_id:int, db:Session=Depends(get_db), user:User=Depends(current_user)):
    d=owned_device(db,user,device_id);db.delete(d);db.commit();return {"ok":True}

@app.get("/api/events")
def list_events(limit:int=50, db:Session=Depends(get_db), user:User=Depends(current_user)):
    limit=max(1,min(limit,200))
    return [{"id":e.id,"device_id":e.device_id,"device_name":e.device_name,"level":e.level,"message":e.message,"created_at":e.created_at} for e in db.query(Event).filter_by(organization_id=user.organization_id).order_by(desc(Event.id)).limit(limit).all()]

@app.get("/api/dashboard")
def dashboard(db:Session=Depends(get_db), user:User=Depends(current_user)):
    ds=db.query(Device).filter_by(organization_id=user.organization_id).all()
    return {"total":len(ds),"online":sum(d.status=="online" for d in ds),"offline":sum(d.status=="offline" for d in ds),
            "unknown":sum(d.status=="unknown" for d in ds),"warning":sum(d.status=="warning" for d in ds),
            "sites":db.query(Site).filter_by(organization_id=user.organization_id).count(),
            "checked_at":datetime.now(timezone.utc)}
@app.post("/api/monitoring/report")
def report_monitoring(
    body: MonitoringReportIn,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    if body.status not in ("online", "offline"):
        raise HTTPException(
            status_code=400,
            detail="Trạng thái chỉ được là online hoặc offline",
        )

    device = owned_device(db, user, body.device_id)

    if not device.ping_enabled:
        raise HTTPException(
            status_code=400,
            detail="Thiết bị đang tắt Ping monitoring",
        )

    now = datetime.now(timezone.utc)
    old_status = device.status or "unknown"

    device.status = body.status
    device.latency_ms = (
        max(0, body.latency_ms)
        if body.status == "online" and body.latency_ms is not None
        else None
    )
    device.last_checked = now
    device.last_error = (
        (body.error or "Không nhận được phản hồi ping")[:500]
        if body.status == "offline"
        else None
    )

    if body.status == "online":
        device.last_seen = now

    if old_status != body.status:
        event = Event(
            organization_id=user.organization_id,
            device_id=device.id,
            device_name=device.name,
            level="info" if body.status == "online" else "warning",
            message=(
                f"Thiết bị chuyển trạng thái: {old_status} → {body.status}"
            ),
        )
        db.add(event)

    db.commit()
    db.refresh(device)

    return {
        "ok": True,
        "device_id": device.id,
        "status": device.status,
        "latency_ms": device.latency_ms,
        "last_checked": device.last_checked,
    }
