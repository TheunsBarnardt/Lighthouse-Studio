# Runbook: MongoDB Setup for Platform

## Prerequisites

- MongoDB 6.0 or 7.0
- Replica set topology (required for transactions and change streams)
- Network access from platform application servers to MongoDB port 27017

## Initial Setup

### 1. Initialize replica set

For a new single-node development replica set:

```javascript
// Connect to mongosh as admin
mongosh mongodb://localhost:27017 -u admin -p <admin-password>

rs.initiate({
  _id: 'rs0',
  members: [{ _id: 0, host: 'localhost:27017' }]
});
```

For a 3-node production replica set:

```javascript
rs.initiate({
  _id: 'rs0',
  members: [
    { _id: 0, host: 'mongo1:27017', priority: 2 },
    { _id: 1, host: 'mongo2:27017' },
    { _id: 2, host: 'mongo3:27017', arbiterOnly: true },
  ],
});
```

### 2. Create application user

```javascript
use platform
db.createUser({
  user: 'platform_app',
  pwd: '<strong-password>',
  roles: [{ role: 'readWrite', db: 'platform' }]
});
```

### 3. Enable pre/post images (MongoDB 6.0+ for before-images in change streams)

```javascript
use platform
db.runCommand({ collMod: 'projects', changeStreamPreAndPostImages: { enabled: true } });
```

### 4. Run migrations

```bash
MONGO_URI="mongodb://platform_app:<password>@mongo1:27017/?replicaSet=rs0" \
MONGO_DATABASE=platform \
pnpm --filter @platform/adapter-persistence-mongo db:migrate apply
```

## Health Checks

```javascript
// Replica set status
rs.status();

// Current primary
db.isMaster();

// Check change stream support
db.runCommand({ buildInfo: 1 }).version; // must be >= 6.0
```

## Troubleshooting

| Symptom                 | Cause             | Fix                                   |
| ----------------------- | ----------------- | ------------------------------------- |
| Transaction fails       | Not a replica set | `rs.initiate()`                       |
| Change stream fails     | Not a replica set | Same as above                         |
| Duplicate key on insert | ID collision      | Check UUID v7 generation              |
| Slow queries            | Missing indexes   | Check `explain()` output; add indexes |

## Backup and Restore

```bash
# Backup
mongodump --uri="mongodb://backup_user:<pw>@mongo1:27017/?replicaSet=rs0" \
  --db=platform --out=/backup/$(date +%Y%m%d)

# Restore
mongorestore --uri="mongodb://admin:<pw>@mongo1:27017/?replicaSet=rs0" \
  --db=platform /backup/20260101/platform
```

## Monitoring

Key metrics to watch:

- `rs.status().members[*].optimeDate` — replication lag
- `db.serverStatus().connections.current` — connection count
- `db.serverStatus().wiredTiger.cache` — cache hit rate
- Change stream cursor open count in `db.currentOp()`
