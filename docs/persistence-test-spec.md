# Persistence Engine Test Spec (MVP / localStorage / TDD)

## 1. Objective
Validate PersistenceEngine as a stateless localStorage adapter for GameEngine checkpoint lifecycle.

Validation focus:
- Save/load/clear behavior
- Envelope validation
- Error handling
- GameEngine persistence point integration contract

Total: 41 cases

## 2. Test Categories
- Contract
- Save
- Load
- Clear
- Validation
- Error Cases
- GameEngine Integration Contract

## 3. Test Cases

### 3.1 Contract (PC-01 ~ PC-04)
| ID | Preconditions | Input | Expected |
|---|---|---|---|
| PC-01 | engine create | inspect | mutable runtime state is not owned |
| PC-02 | engine create | inspect | storage adapter is dependency-injected |
| PC-03 | engine create | inspect | methods return typed Result objects |
| PC-04 | any method fail | execute | no throw for expected operational failures |

### 3.2 Save (PS-01 ~ PS-08)
| ID | Preconditions | Input | Expected |
|---|---|---|---|
| PS-01 | valid context | saveCheckpoint(AFTER_START_HAND) | writes latest key |
| PS-02 | valid context | saveCheckpoint(AFTER_APPLY_ACTION) | point stored in envelope |
| PS-03 | valid context | saveCheckpoint(AFTER_RESOLVE_SHOWDOWN) | savedAt persisted |
| PS-04 | valid context | saveCheckpoint(AFTER_DISTRIBUTE_POT) | tableId/handId persisted |
| PS-05 | valid context | saveCheckpoint(AFTER_COMPLETE_HAND) | context snapshot persisted |
| PS-06 | QueueState has Map/Set | saveCheckpoint | serializeQueueState applied and JSON-safe snapshot persisted |
| PS-07 | repeated save | newer savedAt | latest key overwritten by newer snapshot |
| PS-08 | save fail path | serialize fail | SERIALIZE_FAILED |

### 3.3 Load (PL-01 ~ PL-11)
| ID | Preconditions | Input | Expected |
|---|---|---|---|
| PL-01 | latest exists | loadLatest(tableId) | returns success envelope |
| PL-02 | latest missing | loadLatest(tableId) | NOT_FOUND |
| PL-03 | invalid JSON payload | loadLatest(tableId) | DESERIALIZE_FAILED |
| PL-04 | missing required field | loadLatest(tableId) | INVALID_ENVELOPE |
| PL-05 | schemaVersion mismatch | loadLatest(tableId) | SCHEMA_VERSION_MISMATCH |
| PL-06 | valid envelope | loadLatest(tableId) | point restored correctly |
| PL-07 | valid envelope | loadLatest(tableId) | deserializeQueueState restores Map/Set semantics |
| PL-08 | valid envelope | loadLatest(tableId) | restore executes validateEnvelope -> deserialize -> validateQueueState -> validateTableState |
| PL-09 | queue validation fails | loadLatest(tableId) | INVALID_QUEUE_STATE |
| PL-10 | table validation fails | loadLatest(tableId) | INVALID_TABLE_STATE |
| PL-11 | storage unavailable | loadLatest(tableId) | STORAGE_UNAVAILABLE |

### 3.4 Clear (PR-01 ~ PR-04)
| ID | Preconditions | Input | Expected |
|---|---|---|---|
| PR-01 | latest key exists | clearTable(tableId) | latest removed |
| PR-02 | point-like legacy keys exist | clearTable(tableId) | latest only is deletion target in MVP |
| PR-03 | nothing exists | clearTable(tableId) | success with removedCount=0 |
| PR-04 | any data exists | clearAll() | all keys under persistence prefix removed |

### 3.5 Validation (PV-01 ~ PV-05)
| ID | Preconditions | Input | Expected |
|---|---|---|---|
| PV-01 | full envelope | validateEnvelope | valid=true |
| PV-02 | schemaVersion missing | validateEnvelope | INVALID_ENVELOPE |
| PV-03 | point invalid literal | validateEnvelope | INVALID_ENVELOPE |
| PV-04 | tableId empty | validateEnvelope | INVALID_ENVELOPE |
| PV-05 | context missing | validateEnvelope | INVALID_ENVELOPE |

### 3.6 Error Cases (PE-01 ~ PE-06)
| ID | Preconditions | Input | Expected |
|---|---|---|---|
| PE-01 | localStorage throws quota | saveCheckpoint | QUOTA_EXCEEDED |
| PE-02 | localStorage throws generic | saveCheckpoint | STORAGE_UNAVAILABLE or UNKNOWN_ERROR |
| PE-03 | localStorage unavailable (SSR-like) | any method | STORAGE_UNAVAILABLE |
| PE-04 | corrupted latest snapshot | loadLatest(tableId) | DESERIALIZE_FAILED or INVALID_ENVELOPE |
| PE-05 | schema mismatch snapshot | loadLatest(tableId) | SCHEMA_VERSION_MISMATCH |
| PE-06 | corrupted payload then save | saveCheckpoint | write succeeds and latest becomes readable |

### 3.7 GameEngine Integration Contract (PG-01 ~ PG-03)
| ID | Preconditions | Input | Expected |
|---|---|---|---|
| PG-01 | 5 method success flow | saveCheckpoint calls | 5 persistence points are all accepted |
| PG-02 | GameEngine failure flow | no saveCheckpoint call | persistence not invoked on failure |
| PG-03 | reload bootstrap | loadLatest(tableId) | loaded context can be handed to coordinator start |

## 4. Coverage Targets
- Statement: >= 95%
- Branch: >= 90%

## 5. TDD Priority
1. Contract
2. Save
3. Load
4. Validation
5. Clear
6. Error Cases
7. GameEngine Integration Contract

## 6. Additional Checks
1. Key naming is deterministic and collision-safe by tableId latest key.
2. No domain recalculation in persistence layer.
3. Result objects preserve reason/errorCode for debugging.
4. save and load are idempotent for identical input.
5. persisted payload is JSON-safe and does not contain runtime Map/Set.
