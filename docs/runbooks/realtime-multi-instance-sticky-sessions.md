# Runbook: Multi-Instance Real-Time Deployment (Sticky Sessions)

## Overview

The platform's real-time subscription layer uses **in-process fan-out** (ADR-0118). Each platform instance maintains its own connection registry and change stream consumers. Resume-after-disconnect requires the client to reconnect to the same instance.

In multi-instance deployments, configure **sticky sessions** at the load balancer to ensure clients reconnect to the same instance.

## Nginx Configuration

```nginx
upstream platform_api {
  ip_hash;
  server instance1:3000;
  server instance2:3000;
  server instance3:3000;
}

server {
  location /api/v1/data/ {
    proxy_pass http://platform_api;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_read_timeout 3600s;
  }
}
```

`ip_hash` routes requests from the same client IP to the same upstream server. This works for most deployments. If clients are behind CGNAT (many users sharing one IP), use cookie-based stickiness instead:

```nginx
upstream platform_api {
  sticky cookie platform_srv_id expires=1h path=/api/v1/data/;
  server instance1:3000;
  server instance2:3000;
}
```

## AWS ALB Configuration

Enable sticky sessions on the target group:

```json
{
  "StickinessType": "app_cookie",
  "AppCookieName": "PLATFORM_SRV",
  "DurationSeconds": 3600
}
```

The platform must set the `PLATFORM_SRV` cookie on the first response. Add this to the `SseHandler.handle` and the WebSocket connection init handler.

## Verifying Sticky Sessions Work

```bash
# Make 10 sequential SSE connections and check which instance served each
for i in $(seq 1 10); do
  curl -s -I https://platform.example.com/api/v1/data/myws/main/realtime \
    -H "Authorization: Bearer $TOKEN" | grep X-Served-By
done
```

All requests should return the same `X-Served-By` header (if instances add this header).

## Behaviour Without Sticky Sessions

Without sticky sessions:

- **Connect + subscribe:** Works. Any instance serves any new connection.
- **SSE heartbeats:** Work. Each event is a new request; no state needed.
- **Resume after disconnect:** **Fails** if the client lands on a different instance. The client SDK falls back to re-subscribe + snapshot automatically. No data loss; one extra round-trip.
- **GraphQL WebSocket multiplexing:** Works. WebSocket connections are inherently sticky (a single TCP connection stays on one instance).

For most workloads, resume failure is acceptable (the client recovers transparently). Only configure sticky sessions if seamless resume is required by the use case.

## Health Checks

Each instance should expose a health check endpoint that load balancers can use to drain connections before shutdown:

```
GET /health/realtime
Response: {"connections": 42, "subscriptions": 156, "status": "healthy"}
```

When shutting down an instance, set its health check to return `503` first. The load balancer will stop routing new connections to it. Existing WebSocket/SSE connections will drain naturally as clients disconnect. Force-close remaining connections after a 30-second drain period.
