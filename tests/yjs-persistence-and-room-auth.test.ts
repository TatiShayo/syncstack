import { describe, it, expect } from "vitest";
import * as Y from "yjs";
import { CRDTManager } from "../src/crdt/crdtManager";

/**
 * NOTE: this suite originally called CRDTManager.addCard / .addElement and a
 * card `content` field — an API the manager no longer exposes (it was renamed
 * to createCard/createElement, and CardData's text field is `title`). The
 * suite failed on HEAD for that reason alone. Updated below to the live API;
 * the durability and convergence assertions themselves are unchanged.
 */
describe("SyncStack Yjs State Durability & Multi-Peer Convergence", () => {
  it("encodes state as binary update and restores document accurately", () => {
    const original = new CRDTManager();
    const cardResult = original.createCard("Design Database Schema", "", "", "todo");
    expect(cardResult.error).toBeUndefined();
    expect(cardResult.cardId).toBeTruthy();
    original.createElement({
      id: "elem-1",
      type: "rectangle",
      x: 100,
      y: 200,
      width: 150,
      height: 80,
      fill: "#3b82f6",
      stroke: "#1d4ed8",
      strokeWidth: 2,
      zIndex: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
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
    expect(cards[0].title).toBe("Design Database Schema");

    const elem = restored.getElement("elem-1");
    expect(elem).toBeDefined();
    expect(elem?.x).toBe(100);
    expect(elem?.y).toBe(200);
  });

  it("converges to mathematically identical state across divergent peers", () => {
    const peerA = new CRDTManager();
    const peerB = new CRDTManager();

    // Peer A adds card 1
    const cardA = peerA.createCard("Task from Peer A", "", "", "todo");
    expect(cardA.cardId).toBeTruthy();

    // Peer B adds card 2
    const cardB = peerB.createCard("Task from Peer B", "", "", "in-progress");
    expect(cardB.cardId).toBeTruthy();

    // Exchange updates
    const updateA = Y.encodeStateAsUpdate(peerA.doc);
    const updateB = Y.encodeStateAsUpdate(peerB.doc);

    Y.applyUpdate(peerA.doc, updateB);
    Y.applyUpdate(peerB.doc, updateA);

    // Both peers must now have both cards
    expect(peerA.cardsMap.has(cardA.cardId!)).toBe(true);
    expect(peerA.cardsMap.has(cardB.cardId!)).toBe(true);
    expect(peerB.cardsMap.has(cardA.cardId!)).toBe(true);
    expect(peerB.cardsMap.has(cardB.cardId!)).toBe(true);

    expect(peerA.getCardsForColumn("col-todo").length).toBe(1);
    expect(peerA.getCardsForColumn("col-in-progress").length).toBe(1);
    expect(peerB.getCardsForColumn("col-todo").length).toBe(1);
    expect(peerB.getCardsForColumn("col-in-progress").length).toBe(1);
  });
});
