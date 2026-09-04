# ADR 0001: Yjs Binary Compaction and Ticketed WebSocket Handshakes

## Context
Real-time collaborative applications face severe database bloat and unauthorized document tampering without strict sync protocols.

## Decision
1. **Binary Snapshot Compaction**: Merge incremental Yjs updates into binary database blobs.
2. **Ticketed WebSocket Auth**: Authenticate client roles during initial WebSocket connection upgrade.
3. **Redis Pub/Sub Backplane**: Distribute document updates across multi-node server clusters.

## Consequences
- **Positive**: Sub-second collaboration latency, zero merge conflicts, and minimal database overhead.
- **Negative**: Requires Redis infrastructure for multi-instance deployment.
