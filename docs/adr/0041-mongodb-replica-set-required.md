---
adr: 0041
title: MongoDB Replica Set Required Even for Single-Node
status: Accepted
date: 2026-05-02
deciders: Theuns Barnardt
---

## Context

MongoDB multi-document transactions and change streams both require a replica set topology. A standalone MongoDB instance supports neither.

## Decision

The platform requires MongoDB to be deployed as a replica set (even a single-member replica set `rs.initiate({ _id: 'rs0', members: [{ _id: 0, host: 'localhost:27017' }] })`). The docker-compose dev stack configures this automatically.

The `MongoConnection` creation will fail early if the connection string does not include `replicaSet=…` and the server is not part of a replica set.

## Consequences

- Transactions work (essential for UnitOfWorkPort)
- Change streams work (essential for ChangeStreamPort)
- Single-node replica set has slightly higher write latency (durability journal write)
- Customers deploying MongoDB must configure at least a single-member RS
- The docker-compose init container handles RS initialization automatically
- Operational runbook documents the initialization procedure for on-prem deployments

## Alternatives considered

- **Standalone MongoDB**: Simpler deployment, but no transactions or change streams — makes two of the platform's core features unavailable. Rejected.
- **Require 3-node RS**: Better durability for production, but adds complexity to dev setup. Dev uses single-node; production runbook recommends 3-node.
