# Yjs Divergent Offline Merge Semantics

This document explains the deterministic offline conflict resolution and merge behaviors of the **SyncStack** Kanban board.

---

## The Divergent Offline Scenario
When two clients are disconnected (working offline) and modify the exact same card concurrently:
1. **Initial State**: Card `X` is in the `todo` column.
2. **Client A Offline Mutation**: Moves Card `X` to the `in-progress` column.
3. **Client B Offline Mutation**: Moves Card `X` to the `done` column.
4. **Reconnection (Merge)**: Both clients reconnect to the sync server, and their offline changes are merged.

---

## Yjs Merge and Conflict Resolution Mechanics

### 1. Deterministic Convergence
Under the hood, Yjs uses a Conflict-free Replicated Data Type (CRDT) model. Every mutation is tracked using **Lamport timestamps** (a combination of a client-specific unique identifier and an incrementing transaction clock/counter). 
When clients reconnect, Yjs merges the transaction histories. Because the operations are commutative, associative, and idempotent, **both clients are guaranteed to converge to the exact same state**, regardless of the order in which the updates reach the server or each other.

### 2. Element Deletions are Idempotent
* **What happens to the old column?** 
  Both Client A and Client B deleted `card-x` from `col-todo` (the `todo` column Y.Array). 
  In Yjs, deletions reference the specific unique internal ID of the item being deleted. Because both clients targeted the exact same item ID, this deletion is merged idempotently. The item `card-x` is successfully deleted from `col-todo` once, without conflicts.

### 3. Array Insertions are Cumulative (No Data Loss)
* **What happens to the new columns?**
  - Client A inserted `card-x` into the `col-in-progress` Y.Array.
  - Client B inserted `card-x` into the `col-done` Y.Array.
  
  Because these arrays are distinct Yjs shared types (`col-in-progress` and `col-done`), the insertions do not conflict with each other. Yjs merges both operations.
  Consequently, **Card `X` appears in both the `in-progress` and `done` columns** on both clients upon synchronization. 

* **Why is this desirable?**
  CRDTs prioritize **zero data loss**. In a collaborative setting, concurrently moving a card to two different states represents a human conflict. Rather than silently discarding Client A's or Client B's intent (which would happen with a Last-Write-Wins overwrite), Yjs preserves both actions, allowing collaborators to see both moves and manually reconcile them if needed.

### 4. Card Details Merging
If Client A and Client B had edited fields within the card itself (the card's Y.Map, e.g. updating description or title):
- Y.Map properties use a **Last-Write-Wins (LWW)** resolution policy based on transaction timestamps.
- If Client A updated the title to `"Alpha"` and Client B updated it to `"Beta"`, the change with the higher client ID / clock timestamp would win, and both clients would deterministically see the winning title. No updates are lost in transit, and states converge perfectly.
