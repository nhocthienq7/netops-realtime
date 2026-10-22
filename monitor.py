
import getpass
import subprocess
import time
from time import perf_counter

import requests

API = "https://netops-realtime-api.onrender.com"
INTERVAL = 30
session = requests.Session()


def login():
    email = input("Email ChiThien: ").strip()
    password = getpass.getpass("Mat khau: ")

    response = session.post(
        f"{API}/api/auth/login",
        json={"email": email, "password": password},
        timeout=30,
    )
    response.raise_for_status()

    token = response.json().get("access_token")
    if not token:
        raise RuntimeError("API khong tra ve access_token")

    session.headers.update({"Authorization": f"Bearer {token}"})


def ping_device(address):
    start = perf_counter()

    try:
        result = subprocess.run(
            ["ping", "-n", "1", "-w", "2000", address],
            capture_output=True,
            text=True,
            timeout=5,
        )

        elapsed_ms = round((perf_counter() - start) * 1000, 1)

        if result.returncode == 0:
            return "online", elapsed_ms, None

        return "offline", None, "Ping khong nhan duoc phan hoi"

    except (subprocess.TimeoutExpired, OSError) as exc:
        return "offline", None, str(exc)[:500]


def main():
    login()
    print("Da dang nhap. Bat dau giam sat...")

    while True:
        try:
            response = session.get(
                f"{API}/api/devices", timeout=30
            )
            response.raise_for_status()
            devices = response.json()

            for device in devices:
                if not device.get("ping_enabled", True):
                    continue

                address = device.get("address")
                device_id = device.get("id")

                if not address or not device_id:
                    continue

                status, latency, error = ping_device(address)

                payload = {
                    "device_id": device_id,
                    "status": status,
                    "latency_ms": latency,
                    "error": error,
                }

                try:
                    report = session.post(
                        f"{API}/api/monitoring/report",
                        json=payload,
                        timeout=30,
                    )
                    report.raise_for_status()

                    print(
                        f"{device.get('name')} ({address}): "
                        f"{status}, latency={latency} ms"
                    )

                except requests.RequestException as exc:
                    print(f"Loi gui ket qua device {device_id}: {exc}")
                    if getattr(exc.response, "status_code", None) == 401:
                        print("Token het han. Hay dang nhap lai.")
                        return

        except requests.RequestException as exc:
            print(f"Loi ket noi API: {exc}")

        time.sleep(INTERVAL)


if __name__ == "__main__":
    try:
        main()
    except (requests.RequestException, RuntimeError) as exc:
        print(f"Khong the khoi dong monitor: {exc}")
    except KeyboardInterrupt:
        print("\nDa dung giam sat.")
