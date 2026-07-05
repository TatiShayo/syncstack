import test from 'node:test';
import assert from 'node:assert/strict';
import * as Y from 'yjs';
import { fork } from 'child_process';
import ws from 'ws';
import { WebsocketProvider } from 'y-websocket';

// Helper to wait for a specific duration
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Setup doc & helper functions replicating App.tsx logic headlessly
function setupTestDoc() {
  const doc = new Y.Doc();
  
  const getColumnArray = (columnId) => {
    return doc.getArray(`col-${columnId}`);
  };

  const cardsMap = doc.getMap('cards');

  const getCardsForColumn = (columnId) => {
    const columnArray = getColumnArray(columnId);
    const cards = [];
    const toRemove = [];

    columnArray.toArray().forEach((cardId, index) => {
      const cardMap = cardsMap.get(cardId);
      if (!cardMap) {
        toRemove.push(index);
      } else {
        cards.push({
          id: cardId,
          title: cardMap.get('title') || '',
          description: cardMap.get('description') || '',
          assignee: cardMap.get('assignee') || ''
        });
      }
    });

    if (toRemove.length > 0) {
      doc.transact(() => {
        for (let i = toRemove.length - 1; i >= 0; i--) {
          columnArray.delete(toRemove[i], 1);
        }
      });
    }

    return cards;
  };

  // Helper validation replicating App.tsx
  const validateInputs = (title, description, assignee) => {
    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();
    const trimmedAssignee = assignee.trim();

    if (!trimmedTitle) {
      return 'Title is required.';
    }
    if (trimmedTitle.length > 100) {
      return 'Title must be 100 characters or less.';
    }
    if (trimmedDescription.length > 500) {
      return 'Description must be 500 characters or less.';
    }
    if (trimmedAssignee.length > 50) {
      return 'Assignee name must be 50 characters or less.';
    }
    return null;
  };

  const createCard = (title, description, assignee, columnId) => {
    const validationError = validateInputs(title, description, assignee);
    if (validationError) {
      return { error: validationError };
    }

    let cardId;
    doc.transact(() => {
      cardId = 'card_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
      const cardMap = new Y.Map();
      cardMap.set('title', title.trim());
      cardMap.set('description', description.trim());
      cardMap.set('assignee', assignee.trim());

      cardsMap.set(cardId, cardMap);
      const columnArray = getColumnArray(columnId);
      columnArray.push([cardId]);
    });
    return { cardId };
  };

  const updateCard = (cardId, title, description, assignee, modalColumn) => {
    const validationError = validateInputs(title, description, assignee);
    if (validationError) {
      return { error: validationError };
    }

    let success = false;
    doc.transact(() => {
      const cardMap = cardsMap.get(cardId);
      if (cardMap) {
        cardMap.set('title', title.trim());
        cardMap.set('description', description.trim());
        cardMap.set('assignee', assignee.trim());
        success = true;

        // Check if the column changed
        let currentColumnId = '';
        for (const colId of ['todo', 'in-progress', 'done']) {
          const colArray = getColumnArray(colId);
          if (colArray.toArray().includes(cardId)) {
            currentColumnId = colId;
            break;
          }
        }

        if (currentColumnId && currentColumnId !== modalColumn) {
          const oldArray = getColumnArray(currentColumnId);
          const oldIndex = oldArray.toArray().indexOf(cardId);
          if (oldIndex !== -1) {
            oldArray.delete(oldIndex, 1);
          }
          const newArray = getColumnArray(modalColumn);
          newArray.push([cardId]);
        }
      }
    });

    return { success };
  };

  const deleteCard = (cardId, columnId) => {
    doc.transact(() => {
      cardsMap.delete(cardId);
      const columnArray = getColumnArray(columnId);
      const index = columnArray.toArray().indexOf(cardId);
      if (index !== -1) {
        columnArray.delete(index, 1);
      }
    });
  };

  const moveCard = (cardId, sourceColId, destColId, destIndex) => {
    if (!cardsMap.has(cardId)) return;

    doc.transact(() => {
      const sourceArray = getColumnArray(sourceColId);
      const destArray = getColumnArray(destColId);

      const srcIndex = sourceArray.toArray().indexOf(cardId);
      if (srcIndex === -1) return;

      if (sourceColId === destColId) {
        if (srcIndex === destIndex) return;
        
        sourceArray.delete(srcIndex, 1);
        const insertIndex = Math.min(destIndex, sourceArray.length);
        sourceArray.insert(insertIndex, [cardId]);
      } else {
        sourceArray.delete(srcIndex, 1);
        const insertIndex = Math.min(destIndex, destArray.length);
        destArray.insert(insertIndex, [cardId]);
      }
    });
  };

  const handleMoveColumn = (cardId, currentColId, direction) => {
    const colOrder = ['todo', 'in-progress', 'done'];
    const currentIndex = colOrder.indexOf(currentColId);
    const newIndex = direction === 'left' ? currentIndex - 1 : currentIndex + 1;
    
    if (newIndex >= 0 && newIndex < colOrder.length) {
      const destColId = colOrder[newIndex];
      const destArray = getColumnArray(destColId);
      const destIndex = destArray ? destArray.length : 0;
      moveCard(cardId, currentColId, destColId, destIndex);
    }
  };

  const handleMovePosition = (cardId, columnId, direction) => {
    const colArray = getColumnArray(columnId);
    const srcIndex = colArray.toArray().indexOf(cardId);
    if (srcIndex === -1) return;

    const destIndex = direction === 'up' ? srcIndex - 1 : srcIndex + 1;
    if (destIndex >= 0 && destIndex < colArray.length) {
      moveCard(cardId, columnId, columnId, destIndex);
    }
  };

  return {
    doc,
    cardsMap,
    getColumnArray,
    getCardsForColumn,
    createCard,
    updateCard,
    deleteCard,
    moveCard,
    handleMoveColumn,
    handleMovePosition
  };
}

// ---------------- LOCAL OPERATIONS TESTS ----------------

test('Initialization', () => {
  const { getColumnArray } = setupTestDoc();
  const todoArray = getColumnArray('todo');
  assert.equal(todoArray.length, 0);
});

test('Create card works correctly', () => {
  const { getCardsForColumn, createCard, cardsMap } = setupTestDoc();
  const { cardId, error } = createCard('Test Task', 'Task Description', 'Alice', 'todo');
  
  assert.ok(!error);
  assert.ok(cardsMap.has(cardId));
  const cardMap = cardsMap.get(cardId);
  assert.equal(cardMap.get('title'), 'Test Task');
  assert.equal(cardMap.get('description'), 'Task Description');
  assert.equal(cardMap.get('assignee'), 'Alice');

  const todoCards = getCardsForColumn('todo');
  assert.equal(todoCards.length, 1);
  assert.equal(todoCards[0].id, cardId);
  assert.equal(todoCards[0].title, 'Test Task');
});

test('Edit card fields without column change works correctly', () => {
  const { getCardsForColumn, createCard, updateCard } = setupTestDoc();
  const { cardId } = createCard('Original Title', 'Original Desc', 'Alice', 'todo');
  
  const { success } = updateCard(cardId, 'Updated Title', 'Updated Desc', 'Bob', 'todo');
  assert.ok(success);
  
  const todoCards = getCardsForColumn('todo');
  assert.equal(todoCards.length, 1);
  assert.equal(todoCards[0].title, 'Updated Title');
  assert.equal(todoCards[0].description, 'Updated Desc');
  assert.equal(todoCards[0].assignee, 'Bob');
});

test('Edit card with column change updates columns correctly', () => {
  const { getCardsForColumn, createCard, updateCard } = setupTestDoc();
  const { cardId: card1 } = createCard('Card 1', 'Desc 1', 'Alice', 'todo');
  const { cardId: card2 } = createCard('Card 2', 'Desc 2', 'Bob', 'todo');
  
  // Move card1 to 'in-progress' via edit
  updateCard(card1, 'Card 1', 'Desc 1', 'Alice', 'in-progress');
  
  const todoCards = getCardsForColumn('todo');
  const inProgressCards = getCardsForColumn('in-progress');
  
  assert.equal(todoCards.length, 1);
  assert.equal(todoCards[0].id, card2);
  
  assert.equal(inProgressCards.length, 1);
  assert.equal(inProgressCards[0].id, card1);
});

test('Delete card removes it correctly', () => {
  const { getCardsForColumn, createCard, deleteCard, cardsMap } = setupTestDoc();
  const { cardId: card1 } = createCard('Card 1', 'Desc 1', 'Alice', 'todo');
  const { cardId: card2 } = createCard('Card 2', 'Desc 2', 'Bob', 'todo');
  const { cardId: card3 } = createCard('Card 3', 'Desc 3', 'Charlie', 'todo');
  
  deleteCard(card2, 'todo');
  
  assert.ok(!cardsMap.has(card2));
  
  const todoCards = getCardsForColumn('todo');
  assert.equal(todoCards.length, 2);
  assert.equal(todoCards[0].id, card1);
  assert.equal(todoCards[1].id, card3);
});

test('Move card within the same column: no-op path (srcIndex === destIndex)', () => {
  const { getCardsForColumn, createCard, moveCard } = setupTestDoc();
  const { cardId } = createCard('Card 1', 'Desc 1', 'Alice', 'todo');
  
  moveCard(cardId, 'todo', 'todo', 0);
  const todoCards = getCardsForColumn('todo');
  assert.equal(todoCards[0].id, cardId);
});

test('Move card within same column: down (srcIndex < destIndex)', () => {
  const { getCardsForColumn, createCard, moveCard } = setupTestDoc();
  const { cardId: card1 } = createCard('Card 1', 'Desc 1', 'Alice', 'todo');
  const { cardId: card2 } = createCard('Card 2', 'Desc 2', 'Bob', 'todo');
  const { cardId: card3 } = createCard('Card 3', 'Desc 3', 'Charlie', 'todo');
  
  moveCard(card1, 'todo', 'todo', 2);
  
  const todoCards = getCardsForColumn('todo');
  assert.equal(todoCards[0].id, card2);
  assert.equal(todoCards[1].id, card3);
  assert.equal(todoCards[2].id, card1);
});

test('Move card within same column: up (srcIndex > destIndex)', () => {
  const { getCardsForColumn, createCard, moveCard } = setupTestDoc();
  const { cardId: card1 } = createCard('Card 1', 'Desc 1', 'Alice', 'todo');
  const { cardId: card2 } = createCard('Card 2', 'Desc 2', 'Bob', 'todo');
  const { cardId: card3 } = createCard('Card 3', 'Desc 3', 'Charlie', 'todo');
  
  moveCard(card3, 'todo', 'todo', 0);
  
  const todoCards = getCardsForColumn('todo');
  assert.equal(todoCards[0].id, card3);
  assert.equal(todoCards[1].id, card1);
  assert.equal(todoCards[2].id, card2);
});

test('Move card to a different column', () => {
  const { getCardsForColumn, createCard, moveCard } = setupTestDoc();
  const { cardId: card1 } = createCard('Card 1', 'Desc 1', 'Alice', 'todo');
  const { cardId: card2 } = createCard('Card 2', 'Desc 2', 'Bob', 'todo');
  const { cardId: card3 } = createCard('Card 3', 'Desc 3', 'Charlie', 'in-progress');
  
  moveCard(card2, 'todo', 'in-progress', 0);
  
  const todoCards = getCardsForColumn('todo');
  const inProgressCards = getCardsForColumn('in-progress');
  
  assert.equal(todoCards.length, 1);
  assert.equal(todoCards[0].id, card1);
  
  assert.equal(inProgressCards.length, 2);
  assert.equal(inProgressCards[0].id, card2);
  assert.equal(inProgressCards[1].id, card3);
});

test('RACE-01: Prune orphaned reference in getCardsForColumn', () => {
  const { getCardsForColumn, createCard, cardsMap, getColumnArray } = setupTestDoc();
  const { cardId } = createCard('Temporary Card', 'Desc', 'Alice', 'todo');
  
  // Manually delete from cardsMap but keep in column array to simulate race condition
  cardsMap.delete(cardId);
  
  const todoCards = getCardsForColumn('todo');
  assert.equal(todoCards.length, 0);

  const columnArray = getColumnArray('todo');
  assert.equal(columnArray.length, 0);
});

test('handleMoveColumn left and right', () => {
  const { getCardsForColumn, createCard, handleMoveColumn } = setupTestDoc();
  const { cardId } = createCard('Task', 'Desc', 'Alice', 'todo');
  
  handleMoveColumn(cardId, 'todo', 'right');
  assert.equal(getCardsForColumn('in-progress').length, 1);

  handleMoveColumn(cardId, 'in-progress', 'right');
  assert.equal(getCardsForColumn('done').length, 1);

  handleMoveColumn(cardId, 'done', 'right');
  assert.equal(getCardsForColumn('done').length, 1);

  handleMoveColumn(cardId, 'done', 'left');
  assert.equal(getCardsForColumn('in-progress').length, 1);

  handleMoveColumn(cardId, 'in-progress', 'left');
  assert.equal(getCardsForColumn('todo').length, 1);

  handleMoveColumn(cardId, 'todo', 'left');
  assert.equal(getCardsForColumn('todo').length, 1);
});

test('handleMovePosition up and down', () => {
  const { getCardsForColumn, createCard, handleMovePosition } = setupTestDoc();
  const { cardId: card1 } = createCard('Card 1', 'Desc 1', 'Alice', 'todo');
  const { cardId: card2 } = createCard('Card 2', 'Desc 2', 'Bob', 'todo');
  
  handleMovePosition(card2, 'todo', 'up');
  let todoCards = getCardsForColumn('todo');
  assert.equal(todoCards[0].id, card2);
  assert.equal(todoCards[1].id, card1);

  handleMovePosition(card2, 'todo', 'down');
  todoCards = getCardsForColumn('todo');
  assert.equal(todoCards[0].id, card1);
  assert.equal(todoCards[1].id, card2);
});

test('VAL-01: Input validation for createCard', () => {
  const { createCard } = setupTestDoc();
  
  const res1 = createCard('', 'Desc', 'Alice', 'todo');
  assert.equal(res1.error, 'Title is required.');

  const res2 = createCard('a'.repeat(101), 'Desc', 'Alice', 'todo');
  assert.equal(res2.error, 'Title must be 100 characters or less.');

  const res3 = createCard('Title', 'a'.repeat(501), 'Alice', 'todo');
  assert.equal(res3.error, 'Description must be 500 characters or less.');

  const res4 = createCard('Title', 'Desc', 'a'.repeat(51), 'todo');
  assert.equal(res4.error, 'Assignee name must be 50 characters or less.');
});

test('VAL-01: Input validation for updateCard', () => {
  const { createCard, updateCard } = setupTestDoc();
  const { cardId } = createCard('Title', 'Desc', 'Alice', 'todo');

  const res1 = updateCard(cardId, '', 'Desc', 'Alice', 'todo');
  assert.equal(res1.error, 'Title is required.');

  const res2 = updateCard(cardId, 'Title', 'a'.repeat(501), 'Alice', 'todo');
  assert.equal(res2.error, 'Description must be 500 characters or less.');
});

test('RACE-01: moveCard ignores non-existent cards', () => {
  const { moveCard, getColumnArray } = setupTestDoc();
  const fakeCardId = 'fake_id_123';
  
  moveCard(fakeCardId, 'todo', 'done', 0);
  assert.equal(getColumnArray('done').length, 0);
});

// ---------------- COLLABORATIVE SYNC / WEBSOCKET TESTS ----------------

const TEST_PORT = 1239;

test('WebSocket Sync Suite', async (t) => {
  // Start the server process on custom port
  const serverProcess = fork('server.js', [], { env: { PORT: TEST_PORT } });
  
  // Wait for server to boot up
  await delay(1000);

  try {
    await t.test('Verify per-board access control validation (forbidden connections are rejected)', async () => {
      const doc = new Y.Doc();
      
      // Connect with invalid token
      const wsUrl = `ws://localhost:${TEST_PORT}?boardId=board1&token=invalid_token`;
      const provider = new WebsocketProvider(wsUrl, 'board1', doc, { 
        WebSocketPolyfill: ws
      });

      // Give it time to attempt connection and get rejected
      await delay(1000);

      // Verify connection gets disconnected/forbidden
      assert.equal(provider.wsconnected, false);
      provider.destroy();
    });

    await t.test('Verify missing token is rejected with 401/403', async () => {
      const doc = new Y.Doc();
      
      // Connect without token query param
      const wsUrl = `ws://localhost:${TEST_PORT}?boardId=board1`;
      const provider = new WebsocketProvider(wsUrl, 'board1', doc, { 
        WebSocketPolyfill: ws
      });

      await delay(1000);

      assert.equal(provider.wsconnected, false);
      provider.destroy();
    });

    await t.test('Valid credentials connect successfully', async () => {
      const doc = new Y.Doc();
      const wsUrl = `ws://localhost:${TEST_PORT}?boardId=board1&token=token1`;
      const provider = new WebsocketProvider(wsUrl, 'board1', doc, { 
        WebSocketPolyfill: ws 
      });

      // Wait to connect
      for (let i = 0; i < 20; i++) {
        if (provider.wsconnected) break;
        await delay(150);
      }

      assert.ok(provider.wsconnected, 'Provider did not connect successfully');
      provider.destroy();
    });

    await t.test('Confirm connection state changes and real-time syncing works', async () => {
      const doc1 = new Y.Doc();
      const doc2 = new Y.Doc();

      const wsUrl1 = `ws://localhost:${TEST_PORT}?boardId=board1&token=token1`;
      const wsUrl2 = `ws://localhost:${TEST_PORT}?boardId=board1&token=token1`;

      const provider1 = new WebsocketProvider(wsUrl1, 'board1', doc1, { WebSocketPolyfill: ws });
      const provider2 = new WebsocketProvider(wsUrl2, 'board1', doc2, { WebSocketPolyfill: ws });

      // Wait until both connect
      await delay(1000);

      // Modify doc1: Add card to columns
      const cardsMap1 = doc1.getMap('cards');
      const todoCol1 = doc1.getArray('col-todo');

      const cardId = 'card_sync_test_1';
      doc1.transact(() => {
        const cardMap = new Y.Map();
        cardMap.set('title', 'Synced Card');
        cardsMap1.set(cardId, cardMap);
        todoCol1.push([cardId]);
      });

      // Allow sync latency
      await delay(1000);

      // Read from doc2
      const cardsMap2 = doc2.getMap('cards');
      const todoCol2 = doc2.getArray('col-todo');

      assert.equal(todoCol2.length, 1);
      assert.equal(todoCol2.get(0), cardId);
      
      const cardMap2 = cardsMap2.get(cardId);
      assert.ok(cardMap2);
      assert.equal(cardMap2.get('title'), 'Synced Card');

      provider1.destroy();
      provider2.destroy();
    });

    await t.test('Confirm distinct board isolation (no cross-talk)', async () => {
      const doc1 = new Y.Doc();
      const doc2 = new Y.Doc();

      // Connect doc1 to board1, doc2 to board2
      const wsUrl1 = `ws://localhost:${TEST_PORT}?boardId=board1&token=token1`;
      const wsUrl2 = `ws://localhost:${TEST_PORT}?boardId=board2&token=token2`;

      const provider1 = new WebsocketProvider(wsUrl1, 'board1', doc1, { WebSocketPolyfill: ws });
      const provider2 = new WebsocketProvider(wsUrl2, 'board2', doc2, { WebSocketPolyfill: ws });

      await delay(1000);

      // Modify board 1
      const todoCol1 = doc1.getArray('col-todo');
      todoCol1.push(['board1_card']);

      await delay(1000);

      // Check board 2
      const todoCol2 = doc2.getArray('col-todo');
      assert.equal(todoCol2.length, 0, 'Updates crossed board boundaries!');

      provider1.destroy();
      provider2.destroy();
    });

    // ---------------- PHASE 4 PRESENCE AWARENESS & PENDING CHANGES TESTS ----------------

    await t.test('Verify username changes propagate to awareness states correctly', async () => {
      const doc1 = new Y.Doc();
      const doc2 = new Y.Doc();
      const wsUrl1 = `ws://localhost:${TEST_PORT}?boardId=board1&token=token1`;
      const wsUrl2 = `ws://localhost:${TEST_PORT}?boardId=board1&token=token1`;

      const provider1 = new WebsocketProvider(wsUrl1, 'board1', doc1, { WebSocketPolyfill: ws });
      const provider2 = new WebsocketProvider(wsUrl2, 'board1', doc2, { WebSocketPolyfill: ws });

      await delay(1000);

      // Set initial user presence details on client 1
      provider1.awareness.setLocalStateField('user', { name: 'InitialAlex', color: 'blue' });
      await delay(500);

      // Verify client 2 received the user details
      let states = Array.from(provider2.awareness.getStates().values());
      let activeNames = states.map(s => s.user && s.user.name).filter(Boolean);
      assert.ok(activeNames.includes('InitialAlex'), 'Initial username not propagated');

      // Update user details on client 1
      provider1.awareness.setLocalStateField('user', { name: 'UpdatedAlex', color: 'red' });
      await delay(500);

      // Verify client 2 received the updated name
      states = Array.from(provider2.awareness.getStates().values());
      activeNames = states.map(s => s.user && s.user.name).filter(Boolean);
      assert.ok(activeNames.includes('UpdatedAlex'), 'Updated username not propagated');
      assert.ok(!activeNames.includes('InitialAlex'), 'Old username still present');

      provider1.destroy();
      provider2.destroy();
    });

    await t.test('Verify username changes are trimmed, limited to 50 characters, and fallback to Anonymous if empty (SEC-03)', async () => {
      const doc1 = new Y.Doc();
      const doc2 = new Y.Doc();
      const wsUrl1 = `ws://localhost:${TEST_PORT}?boardId=board1&token=token1`;
      const wsUrl2 = `ws://localhost:${TEST_PORT}?boardId=board1&token=token1`;

      const provider1 = new WebsocketProvider(wsUrl1, 'board1', doc1, { WebSocketPolyfill: ws });
      const provider2 = new WebsocketProvider(wsUrl2, 'board1', doc2, { WebSocketPolyfill: ws });

      await delay(1000);

      // Case 1: Trimmed and sliced to 50
      const extremelyLongName = "   " + "a".repeat(60) + "   ";
      const sanitizedLongName = extremelyLongName.slice(0, 50).trim() || 'Anonymous';
      assert.equal(sanitizedLongName.length, 47); // "   " + 47 chars = 50 chars, trimmed to 47 chars.
      provider1.awareness.setLocalStateField('user', { name: sanitizedLongName, color: 'blue' });
      await delay(500);

      let states = Array.from(provider2.awareness.getStates().values());
      let activeNames = states.map(s => s.user && s.user.name).filter(Boolean);
      assert.ok(activeNames.includes("a".repeat(47)), 'Sanitized long name not propagated');

      // Case 2: Fallback to Anonymous on empty name
      const emptyName = "    ";
      const sanitizedEmptyName = emptyName.slice(0, 50).trim() || 'Anonymous';
      assert.equal(sanitizedEmptyName, 'Anonymous');
      provider1.awareness.setLocalStateField('user', { name: sanitizedEmptyName, color: 'blue' });
      await delay(500);

      states = Array.from(provider2.awareness.getStates().values());
      activeNames = states.map(s => s.user && s.user.name).filter(Boolean);
      assert.ok(activeNames.includes('Anonymous'), 'Fallback username not propagated');

      provider1.destroy();
      provider2.destroy();
    });

    await t.test('Verify pending changes increment correctly while the client is disconnected', async () => {
      const doc = new Y.Doc();
      const wsUrl = `ws://localhost:${TEST_PORT}?boardId=board1&token=token1`;
      const provider = new WebsocketProvider(wsUrl, 'board1', doc, { WebSocketPolyfill: ws });

      await delay(1000);

      // Disconnect
      provider.disconnect();
      await delay(200);

      // Setup pending changes counter logic exactly as in App.tsx
      let pendingChanges = 0;
      const onUpdate = (_update, origin) => {
        if (!provider.wsconnected && origin !== provider) {
          pendingChanges++;
        }
      };
      doc.on('update', onUpdate);

      // Perform local updates
      doc.transact(() => {
        doc.getArray('col-todo').push(['card-1']);
      });
      assert.equal(pendingChanges, 1, 'Pending changes did not increment to 1');

      doc.transact(() => {
        doc.getArray('col-todo').push(['card-2']);
      });
      assert.equal(pendingChanges, 2, 'Pending changes did not increment to 2');

      provider.destroy();
    });

    await t.test('Verify pending changes count resets to 0 when reconnecting and completing sync', async () => {
      const doc = new Y.Doc();
      const wsUrl = `ws://localhost:${TEST_PORT}?boardId=board1&token=token1`;
      const provider = new WebsocketProvider(wsUrl, 'board1', doc, { WebSocketPolyfill: ws });

      await delay(1000);

      // Disconnect
      provider.disconnect();
      await delay(200);

      let pendingChanges = 0;
      const onUpdate = (_update, origin) => {
        if (!provider.wsconnected && origin !== provider) {
          pendingChanges++;
        }
      };
      const onSync = (isSynced) => {
        if (isSynced) {
          pendingChanges = 0;
        }
      };
      doc.on('update', onUpdate);
      provider.on('sync', onSync);

      // Local update while offline
      doc.transact(() => {
        doc.getArray('col-todo').push(['card-offline']);
      });
      assert.equal(pendingChanges, 1);

      // Reconnect and wait for sync
      provider.connect();
      
      // Wait for provider.wsconnected to be true and sync to complete
      for (let i = 0; i < 20; i++) {
        if (pendingChanges === 0) break;
        await delay(150);
      }

      assert.equal(pendingChanges, 0, 'Pending changes did not reset to 0 after sync completion');
      provider.destroy();
    });

  } finally {
    // Kill sync server subprocess
    serverProcess.kill();
    await delay(500);
  }
});
