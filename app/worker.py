import os, time, asyncio, subprocess, logging
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from pysnmp.hlapi.v3arch.asyncio import SnmpEngine, CommunityData, UdpTransportTarget, ContextData, ObjectType, ObjectIdentity, get_cmd
from .db import SessionLocal
from .models import Device, Event

logging.basicConfig(level=os.getenv("LOG_LEVEL","INFO"),format="%(asctime)s %(levelname)s %(message)s")
POLL=int(os.getenv("POLL_INTERVAL_SECONDS","30"))
PING_TIMEOUT=int(os.getenv("PING_TIMEOUT_SECONDS","2"))
SNMP_TIMEOUT=int(os.getenv("SNMP_TIMEOUT_SECONDS","2"))

async def snmp_read(device):
    """Read sysDescr.0 and sysUpTime.0 using SNMPv2c."""
    engine=SnmpEngine()
    try:
        target=await UdpTransportTarget.create((device.address,device.snmp_port),timeout=SNMP_TIMEOUT,retries=0)
        result=await get_cmd(engine,CommunityData(device.snmp_community,mpModel=1),target,ContextData(),
            ObjectType(ObjectIdentity("1.3.6.1.2.1.1.1.0")),
            ObjectType(ObjectIdentity("1.3.6.1.2.1.1.3.0")))
        error_indication,error_status,error_index,var_binds=result
        if error_indication: return False,"",str(error_indication)[:250]
        if error_status: return False,"",f"{error_status.prettyPrint()} at {error_index}"
        descr=str(var_binds[0][1])[:1000] if var_binds else ""
        return True,descr,""
    except Exception as exc:
        return False,"",str(exc)[:250]
    finally:
        try: engine.close_dispatcher()
        except Exception: pass

def ping(address):
    start=time.perf_counter()
    try:
        p=subprocess.run(["ping","-n","-c","1","-W",str(PING_TIMEOUT),address],
            stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=PING_TIMEOUT+1)
        return p.returncode==0,round((time.perf_counter()-start)*1000,2)
    except Exception: return False,None

async def check_device(d):
    ping_ok=False; latency=None
    if d.ping_enabled: ping_ok,latency=await asyncio.to_thread(ping,d.address)
    snmp_ok=False; descr=""; snmp_error=""
    if d.snmp_enabled: snmp_ok,descr,snmp_error=await snmp_read(d)
    # SNMP success is proof of reachability even if ICMP is blocked.
    reachable=(ping_ok if d.ping_enabled else False) or snmp_ok
    if not d.ping_enabled and not d.snmp_enabled:
        status="unknown"; error="Chưa bật Ping hoặc SNMP"
    elif reachable:
        status="online"; error=""
    elif d.snmp_enabled and d.ping_enabled and ping_ok and not snmp_ok:
        status="warning"; error="Ping OK nhưng SNMP không phản hồi: "+snmp_error
    else:
        status="offline"; error=snmp_error if d.snmp_enabled else "Ping không phản hồi"
    return status,latency,descr,error

def run_once(db:Session):
    devices=db.query(Device).all()
    for d in devices:
        old=d.status
        status,latency,descr,error=asyncio.run(check_device(d))
        now=datetime.now(timezone.utc)
        d.status=status;d.latency_ms=latency;d.last_checked=now;d.last_error=error
        if status=="online": d.last_seen=now
        if descr: d.sys_descr=descr
        if old != status:
            level="critical" if status=="offline" else "warning" if status=="warning" else "info"
            db.add(Event(organization_id=d.organization_id,device_id=d.id,device_name=d.name,
                         level=level,message=f"{d.name} ({d.address}): {old} → {status}"))
            logging.info("%s %s -> %s",d.name,old,status)
    db.commit()

def main():
    logging.info("NetOps monitoring worker started; poll=%ss",POLL)
    while True:
        started=time.monotonic()
        db=SessionLocal()
        try: run_once(db)
        except Exception: db.rollback();logging.exception("Monitoring cycle failed")
        finally: db.close()
        time.sleep(max(1,POLL-(time.monotonic()-started)))

if __name__=="__main__": main()
