# SPEC 001: Real-Time Multi-Peer CRDT Document Engine

## Problem Statement
Teams need Google Docs-style real-time collaboration in custom applications without maintaining complex operational transformation servers.

## Solution
A robust collaboration server utilizing Yjs CRDTs, binary database snapshot compaction, and scoped room authorization.

## User Stories
1. As a user, I want to edit documents simultaneously with teammates, so that changes merge instantly without conflicts.
2. As an administrator, I want read-only permissions enforced on sensitive rooms, so that observers cannot overwrite content.

## Implementation Decisions
- Binary persistence manager in `src/server/persistence.ts`.
- Room authorization guard in `src/server/auth.ts`.

## Testing Decisions
- Seam: `tests/yjs-persistence-and-room-auth.test.ts`.
- Verify binary compaction, multi-peer convergence, and read-only message dropping.
