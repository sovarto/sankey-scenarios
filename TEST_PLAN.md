# Sankey Scenarios - E2E Test Plan

## Overview

This document defines end-to-end test cases for the Sankey Scenarios application.
Tests will be implemented using **Playwright** with a **separate test database**.

### Test Case Format

- **ID**: `AREA-FEATURE-NNN` (e.g., `AUTH-LOGIN-001`)
- **Priority**: P0 (Critical), P1 (High), P2 (Medium), P3 (Low)
- **Type**: Smoke, Regression, Edge Case

### Test Database Strategy

- Environment variable: `DATABASE_URL_TEST`
- Reset between test suites
- Seeded with baseline data fixtures

---

## 1. Authentication Tests (AUTH)

### 1.1 User Registration

| ID              | Name                       | Priority | Type       | Preconditions                   | Steps                                                                            | Expected Result                                           |
| --------------- | -------------------------- | -------- | ---------- | ------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------- |
| AUTH-SIGNUP-001 | Successful registration    | P0       | Smoke      | No existing users               | 1. Navigate to /signup<br>2. Enter valid email, password, name<br>3. Submit form | User created with 'pending' status, success message shown |
| AUTH-SIGNUP-002 | First user becomes admin   | P0       | Smoke      | Empty database                  | 1. Navigate to /signup<br>2. Register first user                                 | User has 'active' status and 'admin' role                 |
| AUTH-SIGNUP-003 | Duplicate email rejection  | P1       | Regression | User exists with email@test.com | 1. Navigate to /signup<br>2. Try registering with email@test.com                 | Error: "An account with this email already exists"        |
| AUTH-SIGNUP-004 | Email validation           | P2       | Regression | None                            | 1. Enter invalid email format<br>2. Submit                                       | Form validation error on email field                      |
| AUTH-SIGNUP-005 | Required fields validation | P2       | Regression | None                            | 1. Submit empty form                                                             | Validation errors on all required fields                  |
| AUTH-SIGNUP-006 | Email case insensitivity   | P2       | Edge Case  | User exists: user@test.com      | 1. Try registering USER@TEST.COM                                                 | Error: duplicate email                                    |

### 1.2 User Login

| ID             | Name                            | Priority | Type       | Preconditions              | Steps                                                            | Expected Result                           |
| -------------- | ------------------------------- | -------- | ---------- | -------------------------- | ---------------------------------------------------------------- | ----------------------------------------- |
| AUTH-LOGIN-001 | Successful login                | P0       | Smoke      | Active user exists         | 1. Navigate to /login<br>2. Enter valid credentials<br>3. Submit | Redirected to home, session cookie set    |
| AUTH-LOGIN-002 | Invalid password                | P0       | Regression | Active user exists         | 1. Enter correct email, wrong password                           | Error: "Invalid email or password"        |
| AUTH-LOGIN-003 | Non-existent user               | P1       | Regression | No user with email         | 1. Try login with unknown email                                  | Error: "Invalid email or password"        |
| AUTH-LOGIN-004 | Pending user blocked            | P0       | Regression | User with status='pending' | 1. Try login                                                     | Error: "Your account is pending approval" |
| AUTH-LOGIN-005 | Blocked user denied             | P0       | Regression | User with status='blocked' | 1. Try login                                                     | Error: "Your account has been blocked"    |
| AUTH-LOGIN-006 | Redirect if already logged in   | P2       | Regression | Logged in session          | 1. Navigate to /login                                            | Redirected to home                        |
| AUTH-LOGIN-007 | Remember case-insensitive email | P3       | Edge Case  | User: User@Test.com        | 1. Login with user@test.com                                      | Login succeeds                            |

### 1.3 Session Management

| ID               | Name                             | Priority | Type       | Preconditions              | Steps                                       | Expected Result                             |
| ---------------- | -------------------------------- | -------- | ---------- | -------------------------- | ------------------------------------------- | ------------------------------------------- |
| AUTH-SESSION-001 | Session persists across requests | P0       | Smoke      | Logged in                  | 1. Navigate to protected page<br>2. Refresh | Still authenticated                         |
| AUTH-SESSION-002 | Logout clears session            | P0       | Smoke      | Logged in                  | 1. Click logout                             | Session cookie cleared, redirected to login |
| AUTH-SESSION-003 | Expired session redirects        | P1       | Regression | Session exists but expired | 1. Navigate to protected page               | Redirected to login                         |
| AUTH-SESSION-004 | Invalid session cookie           | P2       | Edge Case  | Tampered cookie            | 1. Navigate to protected page               | Redirected to login                         |

### 1.4 Password Reset

| ID             | Name                                | Priority | Type       | Preconditions      | Steps                                                                          | Expected Result                               |
| -------------- | ----------------------------------- | -------- | ---------- | ------------------ | ------------------------------------------------------------------------------ | --------------------------------------------- |
| AUTH-RESET-001 | Request reset email                 | P1       | Smoke      | User exists        | 1. Navigate to /forgot-password<br>2. Enter email<br>3. Submit                 | Success message (token generated in dev mode) |
| AUTH-RESET-002 | Reset with valid token              | P1       | Smoke      | Valid reset token  | 1. Navigate to /reset-password?token=xxx<br>2. Enter new password<br>3. Submit | Password changed, can login with new password |
| AUTH-RESET-003 | Reset with expired token            | P1       | Regression | Expired token      | 1. Try to use expired token                                                    | Error: "Invalid or expired token"             |
| AUTH-RESET-004 | Reset with invalid token            | P2       | Regression | Random token       | 1. Try to use invalid token                                                    | Error: "Invalid or expired token"             |
| AUTH-RESET-005 | Non-existent email (no enumeration) | P2       | Edge Case  | No user with email | 1. Request reset for unknown email                                             | Same success message as valid email           |

---

## 2. Project Management Tests (PROJ)

### 2.1 Project CRUD

| ID            | Name                           | Priority | Type       | Preconditions                 | Steps                                                                      | Expected Result                                         |
| ------------- | ------------------------------ | -------- | ---------- | ----------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------- |
| PROJ-CRUD-001 | Create project                 | P0       | Smoke      | Logged in as member           | 1. Navigate to /projects/new<br>2. Enter name and description<br>3. Submit | Project created, redirected to project view             |
| PROJ-CRUD-002 | Create project - name required | P1       | Regression | Logged in                     | 1. Submit without name                                                     | Validation error                                        |
| PROJ-CRUD-003 | View project details           | P0       | Smoke      | Project exists, user is owner | 1. Navigate to /projects/:id                                               | Project details displayed with scenarios, groups, nodes |
| PROJ-CRUD-004 | Edit project                   | P1       | Regression | Project exists, user is owner | 1. Navigate to /projects/:id/edit<br>2. Change name<br>3. Save             | Name updated                                            |
| PROJ-CRUD-005 | Delete project                 | P1       | Regression | Project exists, user is owner | 1. Navigate to edit page<br>2. Click delete<br>3. Confirm                  | Project and all children deleted                        |
| PROJ-CRUD-006 | Delete cascades to scenarios   | P1       | Regression | Project with scenarios        | 1. Delete project                                                          | All scenarios deleted                                   |
| PROJ-CRUD-007 | Delete cascades to groups      | P2       | Regression | Project with groups           | 1. Delete project                                                          | All groups deleted                                      |
| PROJ-CRUD-008 | Delete cascades to nodes       | P2       | Regression | Project with nodes            | 1. Delete project                                                          | All nodes deleted                                       |

### 2.2 Project Listing

| ID            | Name                       | Priority | Type       | Preconditions             | Steps                                 | Expected Result                         |
| ------------- | -------------------------- | -------- | ---------- | ------------------------- | ------------------------------------- | --------------------------------------- |
| PROJ-LIST-001 | View owned projects        | P0       | Smoke      | User owns projects        | 1. Navigate to /projects              | Own projects displayed in "My Projects" |
| PROJ-LIST-002 | View shared projects       | P0       | Smoke      | Projects shared with user | 1. Navigate to /projects              | Shared projects displayed separately    |
| PROJ-LIST-003 | Empty state                | P2       | Regression | No projects               | 1. Navigate to /projects              | "No projects yet" message               |
| PROJ-LIST-004 | Scenario count display     | P2       | Regression | Projects with scenarios   | 1. View list                          | Scenario count shown for each project   |
| PROJ-LIST-005 | Permission badge on shared | P2       | Regression | Shared project            | 1. View list                          | "View" or "Edit" badge shown            |
| PROJ-LIST-006 | Sort by updated date       | P3       | Regression | Multiple projects         | 1. Update one project<br>2. View list | Most recently updated shown first       |

### 2.3 Project Sharing

| ID             | Name                         | Priority | Type       | Preconditions               | Steps                                                                 | Expected Result                         |
| -------------- | ---------------------------- | -------- | ---------- | --------------------------- | --------------------------------------------------------------------- | --------------------------------------- |
| PROJ-SHARE-001 | Share with readonly          | P0       | Smoke      | Owner, other user exists    | 1. Open share modal<br>2. Enter email<br>3. Select readonly<br>4. Add | Share created, user can view            |
| PROJ-SHARE-002 | Share with readwrite         | P0       | Smoke      | Owner, other user exists    | 1. Share with readwrite permission                                    | Shared user can edit                    |
| PROJ-SHARE-003 | Cannot share with self       | P1       | Regression | Owner                       | 1. Try sharing with own email                                         | Error: "You cannot share with yourself" |
| PROJ-SHARE-004 | Share with non-existent user | P1       | Regression | Owner                       | 1. Try sharing with unknown email                                     | Error: "User not found"                 |
| PROJ-SHARE-005 | Update share permission      | P1       | Regression | Existing share              | 1. Change permission<br>2. Save                                       | Permission updated                      |
| PROJ-SHARE-006 | Remove share                 | P1       | Regression | Existing share              | 1. Remove share                                                       | Share deleted, user loses access        |
| PROJ-SHARE-007 | Only owner can manage shares | P1       | Regression | Non-owner with write access | 1. Try to access share management                                     | Share button not shown or access denied |
| PROJ-SHARE-008 | Readonly user cannot edit    | P0       | Regression | Readonly share              | 1. Try to edit project                                                | Edit actions disabled/hidden            |
| PROJ-SHARE-009 | Readwrite user can edit      | P0       | Regression | Readwrite share             | 1. Edit scenario                                                      | Changes saved successfully              |

---

## 3. Scenario Tests (SCEN)

### 3.1 Scenario CRUD

| ID            | Name                              | Priority | Type       | Preconditions             | Steps                                                   | Expected Result                  |
| ------------- | --------------------------------- | -------- | ---------- | ------------------------- | ------------------------------------------------------- | -------------------------------- |
| SCEN-CRUD-001 | Create scenario                   | P0       | Smoke      | Project exists            | 1. Navigate to new scenario<br>2. Enter name<br>3. Save | Scenario created                 |
| SCEN-CRUD-002 | View scenario diagram             | P0       | Smoke      | Scenario with connections | 1. Navigate to scenario view                            | Sankey diagram rendered          |
| SCEN-CRUD-003 | Edit scenario name inline         | P1       | Regression | Scenario exists           | 1. Click name<br>2. Edit<br>3. Blur                     | Name updated                     |
| SCEN-CRUD-004 | Edit scenario description         | P1       | Regression | Scenario exists           | 1. Click description<br>2. Edit                         | Description updated              |
| SCEN-CRUD-005 | Delete scenario                   | P1       | Regression | Scenario exists           | 1. Delete scenario                                      | Scenario and connections removed |
| SCEN-CRUD-006 | View-only mode for readonly share | P1       | Regression | Readonly access           | 1. View scenario                                        | Edit controls hidden             |

### 3.2 Local Nodes

| ID             | Name                                 | Priority | Type       | Preconditions                  | Steps                                | Expected Result                 |
| -------------- | ------------------------------------ | -------- | ---------- | ------------------------------ | ------------------------------------ | ------------------------------- |
| SCEN-LOCAL-001 | Auto-create local node on connection | P0       | Smoke      | Scenario exists                | 1. Add connection with new node name | Local node created              |
| SCEN-LOCAL-002 | Rename local node                    | P1       | Regression | Local node exists              | 1. Edit local node name              | Name updated in all connections |
| SCEN-LOCAL-003 | Local node uniqueness                | P2       | Regression | Local node "A" exists          | 1. Add connection with source "A"    | Uses existing local node        |
| SCEN-LOCAL-004 | Unused local node cleanup            | P2       | Regression | Local node with no connections | 1. Delete all connections using node | Local node removed              |

### 3.3 Direct Connections

| ID            | Name                               | Priority | Type       | Preconditions        | Steps                                  | Expected Result                                     |
| ------------- | ---------------------------------- | -------- | ---------- | -------------------- | -------------------------------------- | --------------------------------------------------- |
| SCEN-CONN-001 | Add connection with absolute value | P0       | Smoke      | Scenario exists      | 1. Add A → B with value 100            | Connection created, shows in diagram                |
| SCEN-CONN-002 | Add connection with expression     | P1       | Regression | Scenario exists      | 1. Add with value "100 + 50"           | Value calculated as 150, expression stored          |
| SCEN-CONN-003 | Add connection with percentage     | P1       | Regression | Scenario exists      | 1. Add A → B with "50%"                | Percentage stored, calculated based on A's incoming |
| SCEN-CONN-004 | Edit connection value inline       | P1       | Regression | Connection exists    | 1. Click value<br>2. Change<br>3. Save | Value updated                                       |
| SCEN-CONN-005 | Delete connection                  | P1       | Regression | Connection exists    | 1. Delete connection                   | Connection removed from list and diagram            |
| SCEN-CONN-006 | Reorder connections                | P2       | Regression | Multiple connections | 1. Drag to reorder                     | Order persisted, diagram updates                    |
| SCEN-CONN-007 | Change connection source           | P2       | Regression | Connection exists    | 1. Change source node                  | Connection updated                                  |
| SCEN-CONN-008 | Change connection target           | P2       | Regression | Connection exists    | 1. Change target node                  | Connection updated                                  |

### 3.4 Special Connection Types

| ID               | Name                      | Priority | Type       | Preconditions                 | Steps                                      | Expected Result                   |
| ---------------- | ------------------------- | -------- | ---------- | ----------------------------- | ------------------------------------------ | --------------------------------- |
| SCEN-SPECIAL-001 | Add auto connection       | P0       | Smoke      | Node with incoming flow       | 1. Add "auto" connection from node         | Value = 100% of incoming          |
| SCEN-SPECIAL-002 | Auto keyword aliases      | P2       | Regression | Scenario exists               | 1. Enter "a" as value                      | Recognized as auto                |
| SCEN-SPECIAL-003 | Add missing placeholder   | P0       | Smoke      | Node with outgoing > incoming | 1. Add "?" or "missing" connection         | Red flow added, value = deficit   |
| SCEN-SPECIAL-004 | Missing keyword aliases   | P2       | Regression | Scenario exists               | 1. Enter "m" as value                      | Recognized as missing             |
| SCEN-SPECIAL-005 | Add remaining placeholder | P0       | Smoke      | Node with incoming > outgoing | 1. Add "*" or "remaining" connection       | Green flow added, value = surplus |
| SCEN-SPECIAL-006 | Remaining keyword aliases | P2       | Regression | Scenario exists               | 1. Enter "r" as value                      | Recognized as remaining           |
| SCEN-SPECIAL-007 | Only one auto per source  | P1       | Regression | Auto connection exists        | 1. Try adding second auto from same source | Error or prevented                |

### 3.5 Value Calculation

| ID            | Name                           | Priority | Type       | Preconditions                              | Steps                        | Expected Result                |
| ------------- | ------------------------------ | -------- | ---------- | ------------------------------------------ | ---------------------------- | ------------------------------ |
| SCEN-CALC-001 | Percentage calculation         | P0       | Smoke      | A (1000 in) → B at 30%                     | 1. View diagram              | B receives 300                 |
| SCEN-CALC-002 | Auto calculation               | P0       | Smoke      | A (500 in) → B auto                        | 1. View diagram              | B receives 500                 |
| SCEN-CALC-003 | Missing calculation            | P0       | Smoke      | B: 100 in, 150 out                         | 1. Add missing placeholder   | Missing shows 50               |
| SCEN-CALC-004 | Remaining calculation          | P0       | Smoke      | B: 200 in, 150 out                         | 1. Add remaining placeholder | Remaining shows 50             |
| SCEN-CALC-005 | Chained percentage             | P1       | Regression | A→B→C with percentages                     | 1. View diagram              | Cascading calculations correct |
| SCEN-CALC-006 | Chained placeholder            | P1       | Regression | Missing feeds into auto                    | 1. View diagram              | Values resolve correctly       |
| SCEN-CALC-007 | Expression with parentheses    | P2       | Regression | Value = "(100 + 200) / 3"                  | 1. View                      | Calculated as 100              |
| SCEN-CALC-008 | Expression with multiplication | P2       | Regression | Value = "1000 * 0.5"                       | 1. View                      | Calculated as 500              |
| SCEN-CALC-009 | Locale-aware expression (EU)   | P2       | Edge Case  | User locale: de-DE, value "1.234,56 + 100" | 1. Save                      | Parsed as 1334.56              |
| SCEN-CALC-010 | Division by zero handling      | P2       | Edge Case  | Expression = "100 / 0"                     | 1. Enter                     | Error shown, not saved         |

### 3.6 Group References

| ID            | Name                       | Priority | Type       | Preconditions             | Steps                                    | Expected Result                           |
| ------------- | -------------------------- | -------- | ---------- | ------------------------- | ---------------------------------------- | ----------------------------------------- |
| SCEN-GREF-001 | Add group reference        | P0       | Smoke      | Group exists              | 1. Add connection using group            | Group connections expanded in diagram     |
| SCEN-GREF-002 | Group as source            | P1       | Regression | Group with items          | 1. Add group → local node                | Group items flow to target                |
| SCEN-GREF-003 | Group as target            | P1       | Regression | Group with items          | 1. Add local node → group                | Source flows to group items               |
| SCEN-GREF-004 | Show group node option     | P1       | Regression | Group reference           | 1. Enable "show group node"              | Intermediate node appears                 |
| SCEN-GREF-005 | Sub-node selection         | P1       | Regression | Group with multiple items | 1. Select specific sub-node              | Only that connection shown                |
| SCEN-GREF-006 | Sub-node with custom value | P2       | Regression | Sub-node selected         | 1. Set custom value                      | Override applied                          |
| SCEN-GREF-007 | Sub-node with percentage   | P2       | Regression | Sub-node selected         | 1. Set percentage value                  | Calculated based on connecting node       |
| SCEN-GREF-008 | Sub-node with remaining    | P2       | Regression | Sub-node selected         | 1. Set as remaining                      | Value calculated                          |
| SCEN-GREF-009 | Per-scenario node ordering | P2       | Regression | Group reference           | 1. Reorder group nodes for this scenario | Order persisted, original group unchanged |
| SCEN-GREF-010 | Reset group node order     | P3       | Regression | Custom order set          | 1. Reset to default                      | Default order restored                    |
| SCEN-GREF-011 | Delete group reference     | P1       | Regression | Group reference exists    | 1. Delete reference                      | Reference removed, group intact           |

### 3.7 Node References

| ID            | Name                         | Priority | Type       | Preconditions       | Steps                        | Expected Result                |
| ------------- | ---------------------------- | -------- | ---------- | ------------------- | ---------------------------- | ------------------------------ |
| SCEN-NREF-001 | Add node reference           | P0       | Smoke      | Project node exists | 1. Add connection using node | Node value used                |
| SCEN-NREF-002 | Node as source               | P1       | Regression | Project node        | 1. Add node → local          | Node flows to local            |
| SCEN-NREF-003 | Node as target               | P1       | Regression | Project node        | 1. Add local → node          | Local flows to node            |
| SCEN-NREF-004 | Node value updates reflected | P1       | Regression | Node referenced     | 1. Edit project node value   | Scenario diagram updates       |
| SCEN-NREF-005 | Delete node reference        | P1       | Regression | Reference exists    | 1. Delete reference          | Reference removed, node intact |

---

## 4. Sankey Visualization Tests (VIZ)

### 4.1 Diagram Rendering

| ID             | Name                       | Priority | Type       | Preconditions             | Steps            | Expected Result            |
| -------------- | -------------------------- | -------- | ---------- | ------------------------- | ---------------- | -------------------------- |
| VIZ-RENDER-001 | Basic diagram renders      | P0       | Smoke      | Scenario with connections | 1. View scenario | SVG diagram visible        |
| VIZ-RENDER-002 | Nodes positioned correctly | P1       | Regression | Multi-stage flow          | 1. View diagram  | Nodes in correct columns   |
| VIZ-RENDER-003 | Flows connect nodes        | P1       | Regression | Connections exist         | 1. View diagram  | Curved paths connect nodes |
| VIZ-RENDER-004 | Empty state handling       | P2       | Regression | No connections            | 1. View scenario | "No connections" message   |
| VIZ-RENDER-005 | Color scheme applied       | P2       | Regression | Multiple nodes            | 1. View diagram  | Different colors per node  |

### 4.2 Labels

| ID            | Name                     | Priority | Type       | Preconditions  | Steps              | Expected Result          |
| ------------- | ------------------------ | -------- | ---------- | -------------- | ------------------ | ------------------------ |
| VIZ-LABEL-001 | Node labels displayed    | P0       | Smoke      | Nodes exist    | 1. View diagram    | Labels show node names   |
| VIZ-LABEL-002 | Value labels shown       | P1       | Regression | Values enabled | 1. View diagram    | Values appear on labels  |
| VIZ-LABEL-003 | Label collision handling | P2       | Regression | Dense diagram  | 1. View diagram    | Labels compact or adjust |
| VIZ-LABEL-004 | Auto-fit labels toggle   | P2       | Regression | Edit mode      | 1. Toggle auto-fit | Labels resize to fit     |

### 4.3 Interactions

| ID               | Name                          | Priority | Type       | Preconditions   | Steps                  | Expected Result           |
| ---------------- | ----------------------------- | -------- | ---------- | --------------- | ---------------------- | ------------------------- |
| VIZ-INTERACT-001 | Node hover highlights         | P1       | Regression | Diagram visible | 1. Hover over node     | Connected flows highlight |
| VIZ-INTERACT-002 | Flow hover tooltip            | P1       | Regression | Diagram visible | 1. Hover over flow     | Value tooltip shown       |
| VIZ-INTERACT-003 | Node click toggles visibility | P2       | Regression | Diagram visible | 1. Click node          | Node and flows hide/show  |
| VIZ-INTERACT-004 | Expand to full width          | P2       | Regression | View mode       | 1. Click expand button | Diagram fills viewport    |
| VIZ-INTERACT-005 | Resize diagram height         | P2       | Regression | Edit mode       | 1. Drag resize handle  | Height adjusts            |

### 4.4 Special Flows

| ID              | Name                    | Priority | Type       | Preconditions            | Steps           | Expected Result      |
| --------------- | ----------------------- | -------- | ---------- | ------------------------ | --------------- | -------------------- |
| VIZ-SPECIAL-001 | Missing flow is red     | P1       | Regression | Missing placeholder      | 1. View diagram | Flow colored #ff0000 |
| VIZ-SPECIAL-002 | Remaining flow is green | P1       | Regression | Remaining placeholder    | 1. View diagram | Flow colored #00cc00 |
| VIZ-SPECIAL-003 | Zero-value flows hidden | P2       | Regression | Placeholder with 0 value | 1. View diagram | Flow not rendered    |

---

## 5. Reusable Components Tests (COMP)

### 5.1 Groups

| ID             | Name                         | Priority | Type       | Preconditions           | Steps                                                   | Expected Result            |
| -------------- | ---------------------------- | -------- | ---------- | ----------------------- | ------------------------------------------------------- | -------------------------- |
| COMP-GROUP-001 | Create group                 | P0       | Smoke      | Project exists          | 1. Navigate to new group<br>2. Enter details<br>3. Save | Group created              |
| COMP-GROUP-002 | Add connection to group      | P1       | Regression | Group exists            | 1. Add node with value                                  | Connection added           |
| COMP-GROUP-003 | Edit group name              | P1       | Regression | Group exists            | 1. Edit name<br>2. Save                                 | Name updated               |
| COMP-GROUP-004 | Delete group                 | P1       | Regression | Group exists            | 1. Delete group                                         | Group removed              |
| COMP-GROUP-005 | Delete group with references | P1       | Regression | Group used in scenarios | 1. Delete group                                         | References cascade deleted |
| COMP-GROUP-006 | Remove connection from group | P2       | Regression | Group connection exists | 1. Delete connection                                    | Connection removed         |

### 5.2 Project Nodes

| ID            | Name                          | Priority | Type       | Preconditions          | Steps                                                      | Expected Result                       |
| ------------- | ----------------------------- | -------- | ---------- | ---------------------- | ---------------------------------------------------------- | ------------------------------------- |
| COMP-NODE-001 | Create node                   | P0       | Smoke      | Project exists         | 1. Navigate to new node<br>2. Enter name, value<br>3. Save | Node created                          |
| COMP-NODE-002 | Edit node value               | P1       | Regression | Node exists            | 1. Edit value<br>2. Save                                   | Value updated                         |
| COMP-NODE-003 | Node with expression          | P2       | Regression | Node exists            | 1. Enter expression as value                               | Expression evaluated and stored       |
| COMP-NODE-004 | Delete node                   | P1       | Regression | Node exists            | 1. Delete node                                             | Node removed                          |
| COMP-NODE-005 | Delete node with references   | P1       | Regression | Node used in scenarios | 1. Delete node                                             | References cascade deleted            |
| COMP-NODE-006 | Promote local to project node | P2       | Regression | Local node in scenario | 1. Promote to project node                                 | Project node created, reference added |

---

## 6. Real-time Collaboration Tests (RT)

### 6.1 Connection Status

| ID          | Name                        | Priority | Type       | Preconditions  | Steps                                          | Expected Result                      |
| ----------- | --------------------------- | -------- | ---------- | -------------- | ---------------------------------------------- | ------------------------------------ |
| RT-CONN-001 | SSE connection established  | P0       | Smoke      | Edit scenario  | 1. Open edit page                              | Connection indicator shows connected |
| RT-CONN-002 | Reconnect after disconnect  | P1       | Regression | Connected      | 1. Simulate network interruption<br>2. Restore | Auto-reconnects within 3s            |
| RT-CONN-003 | Connection status indicator | P1       | Regression | Various states | 1. Observe indicator                           | Shows connected/disconnected state   |

### 6.2 Multi-User Presence

| ID              | Name                    | Priority | Type       | Preconditions              | Steps                 | Expected Result                     |
| --------------- | ----------------------- | -------- | ---------- | -------------------------- | --------------------- | ----------------------------------- |
| RT-PRESENCE-001 | See other users         | P1       | Regression | Two users on same scenario | 1. User B joins       | User A sees User B in collaborators |
| RT-PRESENCE-002 | User leave notification | P1       | Regression | Two users connected        | 1. User B leaves      | User A sees User B removed          |
| RT-PRESENCE-003 | Current user excluded   | P2       | Regression | Multiple users             | 1. View collaborators | Own user not shown in list          |

### 6.3 Live Updates

| ID            | Name                   | Priority | Type       | Preconditions     | Steps                      | Expected Result           |
| ------------- | ---------------------- | -------- | ---------- | ----------------- | -------------------------- | ------------------------- |
| RT-UPDATE-001 | See connection changes | P0       | Regression | Two users editing | 1. User A adds connection  | User B sees update        |
| RT-UPDATE-002 | See value changes      | P1       | Regression | Two users editing | 1. User A edits value      | User B sees new value     |
| RT-UPDATE-003 | See name changes       | P1       | Regression | Two users editing | 1. User A renames scenario | User B sees new name      |
| RT-UPDATE-004 | Diagram updates live   | P1       | Regression | Two users viewing | 1. User A makes change     | User B diagram re-renders |

---

## 7. User Settings Tests (SET)

| ID      | Name                   | Priority | Type       | Preconditions    | Steps                                       | Expected Result         |
| ------- | ---------------------- | -------- | ---------- | ---------------- | ------------------------------------------- | ----------------------- |
| SET-001 | View settings page     | P2       | Smoke      | Logged in        | 1. Navigate to /settings                    | Settings form displayed |
| SET-002 | Change regional locale | P2       | Regression | Settings page    | 1. Select new locale<br>2. Save             | Locale saved            |
| SET-003 | Number format preview  | P2       | Regression | Settings page    | 1. Select different locales                 | Sample number updates   |
| SET-004 | Settings persist       | P2       | Regression | Changed settings | 1. Log out<br>2. Log in<br>3. View settings | Settings retained       |

---

## 8. Admin Panel Tests (ADMIN)

### 8.1 User List

| ID             | Name                    | Priority | Type       | Preconditions           | Steps                       | Expected Result      |
| -------------- | ----------------------- | -------- | ---------- | ----------------------- | --------------------------- | -------------------- |
| ADMIN-LIST-001 | View user list          | P0       | Smoke      | Logged in as admin      | 1. Navigate to /admin/users | User table displayed |
| ADMIN-LIST-002 | Status counts displayed | P1       | Regression | Users in various states | 1. View page                | Correct counts shown |
| ADMIN-LIST-003 | Non-admin denied        | P0       | Regression | Logged in as member     | 1. Navigate to /admin/users | Redirected to home   |

### 8.2 User Management

| ID             | Name                 | Priority | Type       | Preconditions       | Steps                      | Expected Result             |
| -------------- | -------------------- | -------- | ---------- | ------------------- | -------------------------- | --------------------------- |
| ADMIN-USER-001 | Approve pending user | P0       | Smoke      | Pending user exists | 1. View user<br>2. Approve | Status changed to 'active'  |
| ADMIN-USER-002 | Block active user    | P1       | Regression | Active user         | 1. Block user              | Status changed to 'blocked' |
| ADMIN-USER-003 | Unblock blocked user | P1       | Regression | Blocked user        | 1. Unblock                 | Status changed to 'active'  |
| ADMIN-USER-004 | Add admin role       | P1       | Regression | Member user         | 1. Add admin role          | User has admin access       |
| ADMIN-USER-005 | Remove admin role    | P1       | Regression | Admin user          | 1. Remove admin role       | User loses admin access     |
| ADMIN-USER-006 | Cannot block self    | P2       | Edge Case  | Admin viewing self  | 1. Try to block            | Action prevented            |

---

## 9. API Tests (API)

### 9.1 Project Shares API

| ID            | Name                    | Priority | Type       | Preconditions  | Steps                           | Expected Result    |
| ------------- | ----------------------- | -------- | ---------- | -------------- | ------------------------------- | ------------------ |
| API-SHARE-001 | GET shares - owner only | P1       | Regression | Non-owner      | 1. GET /api/projects/:id/shares | 404 error          |
| API-SHARE-002 | POST add share          | P1       | Regression | Owner          | 1. POST with email, permission  | Share created      |
| API-SHARE-003 | POST update permission  | P1       | Regression | Existing share | 1. POST update                  | Permission changed |
| API-SHARE-004 | POST remove share       | P1       | Regression | Existing share | 1. POST remove                  | Share deleted      |

### 9.2 Realtime API

| ID         | Name                       | Priority | Type       | Preconditions   | Steps                       | Expected Result                     |
| ---------- | -------------------------- | -------- | ---------- | --------------- | --------------------------- | ----------------------------------- |
| API-RT-001 | SSE connection opens       | P1       | Regression | Logged in       | 1. Connect to /api/realtime | SSE stream opened                   |
| API-RT-002 | Initial active-users event | P2       | Regression | Connected       | 1. Observe first events     | active-users event received         |
| API-RT-003 | Events exclude sender      | P2       | Regression | Two connections | 1. User A triggers event    | User A doesn't receive, User B does |

---

## Test Fixtures Required

### Users

- `admin@test.com` - Admin user, active
- `member@test.com` - Member user, active
- `pending@test.com` - Pending user
- `blocked@test.com` - Blocked user

### Projects

- "Test Project 1" - Owned by member@test.com
- "Test Project 2" - Owned by admin@test.com, shared readonly with member
- "Empty Project" - No scenarios/groups/nodes

### Scenarios

- "Complete Scenario" - Has direct connections, group refs, node refs
- "Empty Scenario" - No connections

### Groups

- "Tax Breakdown" - Multiple items (Federal, State, Local)
- "Single Item Group" - One item

### Nodes

- "Fixed Revenue" - Value: 10000
- "Variable Cost" - Value: 5000

---

## Test Execution Priority

### P0 - Critical (Must Pass)

Run on every commit. ~25 tests covering core flows.

### P1 - High (Important)

Run on PRs. ~45 tests covering main functionality.

### P2 - Medium (Comprehensive)

Run nightly. ~35 tests covering edge cases.

### P3 - Low (Nice to Have)

Run weekly. ~10 tests covering minor features.

---

## CI/CD Integration

```yaml
# Suggested GitHub Actions workflow
test-e2e:
  runs-on: ubuntu-latest
  services:
    postgres:
      image: postgres:15
      env:
        POSTGRES_DB: sankey_test
        POSTGRES_USER: test
        POSTGRES_PASSWORD: test
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
    - run: npm ci
    - run: npx playwright install --with-deps
    - run: npm run db:migrate:test
    - run: npm run test:e2e
```

---

_Total Test Cases: ~115_
_Estimated Implementation Time: 3-4 days_
