# NestJS Locking Example

This project demonstrates optimistic and pessimistic locking strategies in a NestJS application using TypeORM and PostgreSQL. It includes a `Product` domain with CRUD operations (optimistic lock on updates) and a `purchase` flow that uses a pessimistic write lock to safely decrement stock under concurrent load.

## Overview
- Framework: `NestJS` 11, `TypeORM` 0.3.x, `PostgreSQL`
- Locking:
  - Optimistic locking: `VersionColumn` on `Product`, enforced on `PUT /products/:id`
  - Pessimistic locking: `setLock('pessimistic_write')` within a transaction on `POST /products/:id/purchase`

## Data Model
`Product` entity fields:
- `id` (number)
- `name` (string)
- `price` (numeric)
- `stock` (number)
- `version` (number, optimistic lock)
- `createdAt`, `updatedAt` (timestamps)

## Requirements
- Node.js (>= 18)
- Yarn
- Docker (for local PostgreSQL)

## Setup
1. Start database via Docker Compose:
   - `docker-compose up -d`
2. Environment variables:
   - Copy `.env.example` to `.env` if needed; defaults match `docker-compose.yml`.
3. Install dependencies:
   - `yarn install`
4. Run the app:
   - Development: `yarn start:dev`

## API Endpoints
- `POST /products` → Create product
- `GET /products` → List products
- `GET /products/:id` → Get product by id
- `PUT /products/:id` → Full update with optimistic lock
  - Body requires: `name`, `price`, `stock`, `version`
  - If body `version` ≠ current `version`: returns `409 Conflict`
- `POST /products/:id/purchase` → Purchase with pessimistic write lock
  - Body: `{ "quantity": number }`
  - Validates positive quantity and sufficient stock; returns `409 Conflict` if insufficient

## Locking Concepts
### Optimistic Locking
- Use case: Resolve conflicts without locking resources during reads/writes.
- Implementation: `VersionColumn` on `Product`; each successful update increments `version`.
- API behavior:
  - Client must send current `version` in `PUT` body.
  - If stale `version` provided → `409 Conflict`.

### Pessimistic Locking
- Use case: Prevent race conditions during stock updates under high concurrency.
- Implementation: Transaction + `createQueryBuilder().setLock('pessimistic_write')` to lock the row until transaction completes.
- API behavior:
  - `POST /products/:id/purchase` acquires a write lock, checks stock, decrements, and saves.

## Testing Guide
### Quick Manual Tests
1. Create product:
   - `curl -s -X POST http://localhost:3000/products -H 'Content-Type: application/json' -d '{"name":"Demo","price":10,"stock":5}'`
2. Get product and note `version`:
   - `curl -s http://localhost:3000/products/1`
3. Optimistic update success:
   - `curl -i -s -X PUT http://localhost:3000/products/1 -H 'Content-Type: application/json' -d '{"name":"Demo+","price":12,"stock":5,"version":<CURRENT_VERSION>}'`
4. Optimistic update conflict:
   - `curl -i -s -X PUT http://localhost:3000/products/1 -H 'Content-Type: application/json' -d '{"name":"Demo++","price":13,"stock":5,"version":<STALE_VERSION>}'`
5. Purchase success:
   - `curl -i -s -X POST http://localhost:3000/products/1/purchase -H 'Content-Type: application/json' -d '{"quantity":2}'`
6. Purchase insufficient stock:
   - `curl -i -s -X POST http://localhost:3000/products/1/purchase -H 'Content-Type: application/json' -d '{"quantity":999}'`

### Demo Script (Concurrent Purchase)
Run a demo script to simulate concurrent purchases:
- Ensure app is running on `http://localhost:3000`
- `yarn demo:purchase`

The script will:
- Create a demo product with initial stock
- Fire two concurrent purchase requests (e.g., quantities 2 and 4)
- Log success vs conflict outcomes and final stock

## Development
- Build: `yarn build`
- Lint: `yarn lint`
- Format: `yarn format`

## License
MIT