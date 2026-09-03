import { describe, it, expect } from "vitest";
import * as Y from "yjs";
import { CRDTManager } from "../src/crdt/crdtManager";

describe("SyncStack Yjs State Durability & Multi-Peer Convergence", () => {
  it("encodes state as binary update and restores document accurately", () => {
    const original = new CRDTManager();
    original.addCard("card-1", "Design Database Schema", "col-todo");
    original.addElement({
      id: "elem-1",
      type: "rectangle",
      x: 100,
      y: 200,
      width: 150,
      height: 80,
      color: "#3b82f6",
      zIndex: 1,
    });

    // Serialize state
    const binaryUpdate = Y.encodeStateAsUpdate(original.doc);
    expect(binaryUpdate.byteLength).toBeGreaterThan(0);

    // Restore into fresh document
    const restoredDoc = new Y.Doc();
    Y.applyUpdate(restoredDoc, binaryUpdate);
    const restored = new CRDTManager(restoredDoc);

    const cards = restored.getCardsForColumn("col-todo");
    expect(cards.length).toBe(1);
    expect(cards[0].content).toBe("Design Database Schema");

    const elem = restored.getElement("elem-1");
    expect(elem).toBeDefined();
    expect(elem?.x).toBe(100);
    expect(elem?.y).toBe(200);
  });

  it("converges to mathematically identical state across divergent peers", () => {
    const peerA = new CRDTManager();
    const peerB = new CRDTManager();

    // Peer A adds card 1
    peerA.addCard("card-a", "Task from Peer A", "col-todo");

    // Peer B adds card 2
    peerB.addCard("card-b", "Task from Peer B", "col-in-progress");

    // Exchange updates
    const updateA = Y.encodeStateAsUpdate(peerA.doc);
    const updateB = Y.encodeStateAsUpdate(peerB.doc);

    Y.applyUpdate(peerA.doc, updateB);
    Y.applyUpdate(peerB.doc, updateA);

    // Both peers must now have both cards
    expect(peerA.cardsMap.has("card-a")).toBe(true);
    expect(peerA.cardsMap.has("card-b")).toBe(true);
    expect(peerB.cardsMap.has("card-a")).toBe(true);
    expect(peerB.cardsMap.has("card-b")).toBe(true);

    expect(peerA.getCardsForColumn("col-todo").length).toBe(1);
    expect(peerA.getCardsForColumn("col-in-progress").length).toBe(1);
    expect(peerB.getCardsForColumn("col-todo").length).toBe(1);
    expect(peerB.getCardsForColumn("col-in-progress").length).toBe(1);
  });
});
