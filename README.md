# SyncStack - Collaborative Kanban Board (Phase 2)

SyncStack is an offline-first, collaborative Kanban board powered by **React**, **Vite**, **Tailwind CSS**, **Yjs**, `y-indexeddb`, and `y-websocket`.

## Key Features in Phase 2
- **Real-Time Collaboration**: Updates are propagated automatically between clients/tabs using WebSockets.
- **Offline-First Resilience**: Local changes are preserved immediately in IndexedDB, and automatically merged upon reconnect.
- **Per-Board Access Control**: The sync server validates tokens and board access credentials during connection upgrade before granting document synchronization access.
- **Dynamic Board Switching**: Switch boards instantly inside the app by supplying the `Board ID` and a valid authorized `Auth Token`.

---

## Access Control Registry (Mocked)
The WebSocket server validates board credentials. The following combinations are pre-authorized for testing:
- **Board:** `board1` &rarr; **Token:** `token1` (or `admin-token`)
- **Board:** `board2` &rarr; **Token:** `token2` (or `admin-token`)
- **Board:** `board3` &rarr; **Token:** `token3` (or `admin-token`)

*Any attempt to connect to a board with an invalid token will result in connection rejection and the client showing an **Offline / Forbidden** indicator.*

---

## Setup & Running the Application

### 1. Run the Yjs Sync Server
Open a terminal in the `syncstack` directory and run:
```bash
npm run start-server
```
This boots up the WebSocket server on port `1234`.

### 2. Run the Vite Frontend
Open a separate terminal in the `syncstack` directory and run:
```bash
npm run dev
```
This runs the Vite development server (usually on `http://localhost:5173`).

### 3. Testing Real-Time Collaboration
1. Open `http://localhost:5173` in a browser tab. Keep the default values (`board1`, `token1`) and click **Switch Board** to connect. The WebSocket badge should show a green **Online** status.
2. Open `http://localhost:5173` in a second browser tab (or an incognito window).
3. Connect both tabs to the same board (`board1` / `token1`). Create, drag, edit, or delete cards in one tab and watch them instantly sync to the other!
4. Try switching one tab to a different board (e.g. `board2` with token `token2`). Observe that it has separate columns and cards, which sync independently.
5. Try inputting an invalid token (e.g. `wrong-token`) and switching boards. Notice that the connection is rejected by the server and the badge turns red showing **Offline / Forbidden**.
