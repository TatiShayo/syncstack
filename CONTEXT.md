# CONTEXT.md — Ubiquitous Domain Language (SyncStack)

## Core Entities
- **CollaborativeRoom**: A shared multi-user canvas or document workspace identified by unique room UUID.
- **YjsDocState**: Compacted binary representation of a CRDT document containing conflict-free edits.
- **StateVector**: Cryptographic summary of known document revisions used to compute incremental diffs.
- **PresenceBeacon**: Ephemeral cursor and awareness broadcast indicating active user positions.

## Domain Invariants
- All client update vectors must converge to mathematically identical document states regardless of arrival order.
- Read-only users cannot dispatch mutate messages to the room state.

## Forbidden Terminology
- Do not call document sync "operational transformation"; use "CRDT" or "StateVector".
- Do not store individual keystrokes in permanent tables; store "CompactedSnapshots".
