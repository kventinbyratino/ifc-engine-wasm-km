# KM runtime runbook

`/blue/km/` is served on `dev.lab-tim.ru` by nginx and proxied to the local KM Vite preview server on `127.0.0.1:5181`.

## Service

Systemd unit template lives in:

```text
deploy/systemd/ifc-engine-wasm-km.service
```

Installed unit path:

```text
/etc/systemd/system/ifc-engine-wasm-km.service
```

## Commands

```bash
sudo systemctl status ifc-engine-wasm-km --no-pager
sudo systemctl restart ifc-engine-wasm-km
sudo journalctl -u ifc-engine-wasm-km -n 100 --no-pager
```

## Verification

```bash
ss -ltnp | grep ':5173'
curl --noproxy '*' -sS -o /dev/null -w '%{http_code} %{content_type}\n' https://dev.lab-tim.ru/blue/km/
curl --noproxy '*' -sS -o /dev/null -w '%{http_code} %{content_type}\n' https://dev.lab-tim.ru/blue/km/src/main.ts
curl --noproxy '*' -sS -o /dev/null -w '%{http_code} %{content_type}\n' https://dev.lab-tim.ru/blue/km/web-ifc/web-ifc.wasm
```

Expected:

- `/blue/km/` returns `200 text/html`.
- `/blue/km/src/main.ts` returns JavaScript, not HTML.
- `/blue/km/web-ifc/web-ifc.wasm` returns `application/wasm`.
