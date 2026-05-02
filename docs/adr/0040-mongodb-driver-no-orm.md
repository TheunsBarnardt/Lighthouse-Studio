---
adr: 0040
title: MongoDB — Official Driver Only, No ORM
status: Accepted
date: 2026-05-02
deciders: Theuns Barnardt
---

## Context

Several ORM/ODM layers exist for MongoDB in Node.js (Mongoose, Typegoose, Prisma). The platform already has the ports-and-adapters abstraction as the boundary; an additional ORM layer would add complexity without benefit.

## Decision

Use the official `mongodb` Node.js driver directly. No Mongoose, no Prisma, no other ODM.

- Collections are typed via TypeScript interfaces in the adapter
- JSON Schema validators enforce document shape at the MongoDB level
- Filter translation is handled by the platform's own Filter AST → Mongo query translator
- Migrations are TypeScript files with `up()` and optional `down()` functions executed against the raw driver

## Consequences

- Less magic — the adapter code is explicit and readable
- No performance overhead from ORM query building
- Schema validation is at the MongoDB level (JSON Schema), not in the ORM
- Type safety achieved via TypeScript generics in the adapter factory functions
- Migration system is custom and simple (< 100 LOC)

## Alternatives considered

- **Mongoose**: Schema definitions would duplicate the port's type system; virtual populate doesn't fit the platform's join-free approach
- **Prisma**: Excellent DX but generates its own client; conflicts with our ports-and-adapters pattern
- **Typegoose**: Mongoose wrapper — same objections as Mongoose, plus TypeScript decorator complexity
