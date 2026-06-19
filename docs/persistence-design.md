# Persistence Engine Design (MVP / localStorage)

## 1. Purpose
PersistenceEngine is a stateless boundary adapter for saving and restoring game state snapshots to localStorage.

MVP assumptions:
- Browser only
- localStorage only
- Play Money only
- Single client runtime
- No server sync

## 2. Responsibilities
PersistenceEngine is responsible for:
1. Saving GameEngine checkpoint snapshots at defined persistence points.
2. Loading latest valid snapshot for a table.
3. Validating envelope/schema version before returning snapshot.
4. Clearing persisted state for a table/session reset.
5. Converting QueueState Map/Set structures to localStorage-safe snapshot form.
6. Converting persisted QueueStateSnapshot back to runtime QueueState.
7. Returning explicit error codes for storage/parse/version issues.

PersistenceEngine is NOT responsible for:
1. Domain calculations (betting/evaluator/pot/queue).
2. Mutating game rules or repairing invalid domain state.
3. Owning runtime mutable state.
4. Conflict resolution across devices.

## 3. Design Principles
1. Stateless: no in-memory authoritative state.
2. Explicit boundaries: input/output typed; no hidden globals except injected storage adapter.
3. Deterministic keys: key derivation from tableId only for latest snapshot.
4. Versioned envelope: schemaVersion for migrations.
5. Fail-safe behavior: load failure never crashes coordinator flow.
6. latest key is the single source of truth in MVP.

## 4. Integration with GameEngine
GameEngine emits persistence notifications at:
1. AFTER_START_HAND
2. AFTER_APPLY_ACTION
3. AFTER_RESOLVE_SHOWDOWN
4. AFTER_DISTRIBUTE_POT
5. AFTER_COMPLETE_HAND

Integration contract:
1. GameEngine calls PersistenceEngine.saveCheckpoint(notification, context, now).
2. PersistenceEngine serializes a versioned snapshot envelope and writes localStorage.
3. On app boot/reload, coordinator bootstrap calls PersistenceEngine.loadLatest(tableId).
4. If load fails, bootstrap falls back to fresh state creation.

## 5. Storage Model
### 5.1 Key format
- Table latest key: ffo:persistence:table:{tableId}:latest

MVP recommendation:
- Always write latest key.
- Do not write per-point history in MVP.
- latest key is the only recovery source.

### 5.2 Envelope
Persist all data inside a versioned envelope.

Envelope fields:
1. schemaVersion: number
2. savedAt: epoch millis
3. tableId: string
4. handId: string | null
5. point: persistence point
6. context: CoordinatorContextSnapshot
7. checksum (optional in MVP): omitted by default

### 5.3 QueueState snapshot conversion
QueueState includes Map/Set fields and cannot be directly serialized with JSON.

MVP conversion contract:
1. serializeQueueState(queueState) -> QueueStateSnapshot
2. deserializeQueueState(snapshot) -> QueueState

Map/Set conversion rules:
1. Map<K, V> -> [K, V][]
2. Set<T> -> T[]
3. restore preserves semantic equality, not reference identity.

Persistence layer must own this conversion boundary and must not leak raw Map/Set into storage payload.

## 6. API Surface (Design)
1. saveCheckpoint(input)
- Input: notification + context + now
- Output: success/failure with latest key and bytes

2. loadLatest(input)
- Input: tableId
- Output: loaded envelope or typed failure

3. serializeQueueState(input)
- Pure function for QueueState -> QueueStateSnapshot

4. deserializeQueueState(input)
- Pure function for QueueStateSnapshot -> QueueState

5. clearTable(input)
- Input: tableId
- Output: removed keys count (MVP: latest key only)

6. clearAll()
- MVP utility for reset/debug

7. validateEnvelope(input)
- Pure validation for unit testability

### 6.1 Restore flow order (MVP)
loadLatest must execute in this strict order:
1. validateEnvelope
2. deserialize (including deserializeQueueState)
3. validateQueueState
4. validateTableState

If any step fails, return typed error and do not return partial context.

## 7. Error Model
PersistenceErrorCode:
1. STORAGE_UNAVAILABLE
2. SERIALIZE_FAILED
3. DESERIALIZE_FAILED
4. INVALID_ENVELOPE
5. SCHEMA_VERSION_MISMATCH
6. NOT_FOUND
7. QUOTA_EXCEEDED
8. INVALID_QUEUE_STATE
9. INVALID_TABLE_STATE
10. UNKNOWN_ERROR

Behavior:
- saveCheckpoint returns error code and does not throw (except programming errors).
- loadLatest returns typed failure result and does not throw.

## 8. Migration Strategy (MVP)
- Current schemaVersion: 1
- If envelope.schemaVersion != supportedVersion:
  - return SCHEMA_VERSION_MISMATCH
  - do not auto-migrate in MVP

Future:
- introduce migrate(vN -> vN+1) pipeline when schema evolves.

## 9. TDD-First Implementation Plan
1. Create types and result contracts.
2. Write failing tests for save/load/clear/validation/error branches.
3. Add minimal implementation for green.
4. Add branch tests (quota, invalid JSON, version mismatch, storage unavailable).

## 10. Invariants
1. save success implies read-after-write consistency for same key.
2. load success returns schemaVersion supported by engine.
3. latest key always points to most recent savedAt for table.
4. failure paths never mutate input context.
5. failure paths never emit partial parsed data.
6. persisted payload never contains runtime Map/Set objects.
7. restored QueueState is validated before context is returned.
8. latest key is the only source used for restore in MVP.

## 11. Open Questions
1. Add compression (LZ) for large snapshots in non-MVP?
2. Keep checksum/hash verification in MVP or defer?
3. Introduce migration pipeline and historical snapshots after MVP?
