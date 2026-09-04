# TICKETS — SyncStack Real-Time Pipeline

## [TICKET-001] Yjs Binary Snapshot Persistence & Compaction
- **Blocked by**: None
- **Delivers**: Compacted database storage engine for conflict-free document updates.
- **Verification**: `tests/yjs-persistence-and-room-auth.test.ts`

## [TICKET-002] Scoped WebSocket Room Authentication Guard
- **Blocked by**: TICKET-001
- **Delivers**: Connection upgrade verifier checking room JWT claims and enforcing write permissions.
- **Verification**: Read-only permission unit tests.
