# Sankey Scenarios - Feature Analysis

## 1. Project Overview

**Sankey Scenarios** is a web application for creating, managing, and visualizing Sankey diagrams. It allows users to build flow diagrams with reusable components (groups and nodes) and supports real-time collaboration.

### Core Technology Stack

- **Frontend**: React 19, React Router 7, TypeScript, TailwindCSS
- **Backend**: Express 5, Server-side rendering (SSR)
- **Database**: PostgreSQL with DrizzleORM
- **Visualization**: D3.js (custom Sankey implementation matching SankeyMATIC style)
- **Real-time**: Server-Sent Events (SSE)

---

## 2. High-Level Feature Categories

1. **Authentication & User Management**
2. **Project Management**
3. **Scenario Building & Editing**
4. **Sankey Diagram Visualization**
5. **Reusable Components (Groups & Nodes)**
6. **Real-time Collaboration**
7. **User Settings & Localization**
8. **Admin Panel**

---

## 3. Detailed Feature Breakdown

### 3.1 Authentication & User Management

#### 3.1.1 User Registration (Signup)

- Email/password registration
- Automatic password hashing
- First user automatically becomes admin with active status
- Subsequent users start with "pending" status (require admin approval)
- Locale preferences can be set during signup
- **Validation**: Email uniqueness, password requirements

#### 3.1.2 User Login

- Email/password authentication
- Session-based authentication (stored in database)
- Session cookie creation
- Redirect to home on successful login
- **Error handling**: Invalid credentials, pending accounts, blocked accounts

#### 3.1.3 Session Management

- Database-backed sessions
- Session expiration tracking
- Automatic session cleanup
- Logout functionality (single session deletion)
- Delete all user sessions capability

#### 3.1.4 Password Reset

- Token-based password reset
- Token expiration (time-limited)
- Secure token generation
- Email enumeration prevention (always shows success)
- Development mode: Token displayed in UI for testing

#### 3.1.5 User Status States

- **Pending**: Awaiting admin approval
- **Active**: Full access to the application
- **Blocked**: Access denied (by admin action)

#### 3.1.6 Role-Based Access Control

- **Admin role**: Full access, user management
- **Member role**: Standard access to projects/scenarios
- Users can have multiple roles
- First-user automatic admin assignment

---

### 3.2 Project Management

#### 3.2.1 Project CRUD Operations

- **Create**: New project with name and description
- **Read**: View project details, scenarios, groups, nodes
- **Update**: Edit project name and description
- **Delete**: Remove project and all associated data (cascade)

#### 3.2.2 Project Listing

- **My Projects**: Projects owned by current user
- **Shared Projects**: Projects shared with current user
- Display project name, description, scenario count
- Sort by last updated date
- Visual differentiation between owned and shared projects

#### 3.2.3 Project Sharing

- Share projects with other users by email
- **Permission levels**:
  - `readonly`: View only access
  - `readwrite`: Full edit access
- Owner-only share management
- Prevent self-sharing
- Update/remove share permissions
- Visual indicators for shared projects and permission levels

#### 3.2.4 Project Access Control

- Owner detection
- Permission checking (read/write)
- Automatic access for project owner
- Share-based access for collaborators
- Mixed scenario: owner + shared users

---

### 3.3 Scenario Building & Editing

#### 3.3.1 Scenario CRUD Operations

- **Create**: New scenario within a project
- **Read**: View scenario with Sankey diagram
- **Update**: Edit name, description, auto-fit labels setting
- **Delete**: Remove scenario and all connections

#### 3.3.2 Local Nodes

- Scenario-specific named entities
- Automatically created when referenced in connections
- Editable names (inline editing)
- Unique within scenario
- Automatic cleanup of unused local nodes

#### 3.3.3 Direct Connections

- Source → Target flow definitions
- Numeric value assignment
- **Value types**:
  - **Absolute**: Fixed numeric value
  - **Percent**: Percentage of incoming flow to source node
- **Special connection types**:
  - **Auto**: Value = 100% of total incoming to source
  - **Missing**: Placeholder for supply deficit (red)
  - **Remaining**: Placeholder for distribution surplus (green)
- Display order control
- Value expressions support
- Value descriptions/documentation

#### 3.3.4 Expression Support

- Mathematical expression evaluation
- Basic operations: `+`, `-`, `*`, `/`
- Parentheses grouping
- Locale-aware number parsing
- Percentage suffix recognition (`%`, `p`, `percent`)
- Heuristic decimal separator detection

#### 3.3.5 Connection Management

- Add new connections via form
- **Source/target selection**:
  - Local nodes (scenario-specific)
  - Project nodes (reusable)
  - Groups (reusable templates)
- Delete connections
- Reorder connections (drag & drop)
- Inline value editing
- Connection type switching

#### 3.3.6 Group References

- Reference to reusable group templates
- Direction control: source or target
- **Show group node option**: Aggregate connections through intermediate node
- **Sub-node selection**: Connect to specific node within group
- Per-scenario node order overrides
- Value/auto/percent support for sub-node connections
- Placeholder support (`remaining`) for sub-node connections

#### 3.3.7 Node References

- Reference to reusable project nodes
- Direction control: source or target
- Automatic value from node definition

#### 3.3.8 Inline Editing

- Inline editable text for scenario name
- Inline editable text for scenario description
- Local node name editing
- Connection value editing

---

### 3.4 Sankey Diagram Visualization

#### 3.4.1 Core Rendering

- SVG-based rendering
- D3.js layout calculation
- SankeyMATIC-compatible visual style
- Responsive container

#### 3.4.2 Layout Algorithm

- Node stage assignment
- Automatic node positioning
- Shadow node/flow creation for multi-stage connections
- Iterative position optimization
- Configurable iterations

#### 3.4.3 Node Configuration

- **Node width**: Configurable bar width
- **Node height factor**: 0-100% padding control
- **Node spacing factor**: 0-100% spacing control
- **Node opacity**: 0-1 transparency
- **Node borders**: Configurable width
- Automatic color assignment (multiple color schemes)
- Custom node colors

#### 3.4.4 Flow Configuration

- **Flow curvature**: 0-1 (straight to maximum curve)
- **Flow opacity**: 0-1 transparency
- **Flow color modes**:
  - `source`: Inherit from source node
  - `target`: Inherit from target node
  - `outside-in`: Gradient effect
  - `none`: Default flow color

#### 3.4.5 Label System

- Configurable label display
- **Label content**:
  - Node name
  - Node value (optional)
- **Value positions**: above, below, before, after
- **Font configuration**: family, size, weight, color
- **Highlight backgrounds**: Configurable opacity
- **Line spacing**: Multi-line label support
- Collision detection with auto-compact mode
- Label click interactions

#### 3.4.6 Interaction Features

- **Node hover**: Highlight connected flows
- **Flow hover**: Display tooltip with value
- **Node click**: Toggle node visibility
- **Label click**: Toggle node visibility
- **Expand/collapse**: Full-width toggle
- **Resize**: Draggable height adjustment

#### 3.4.7 Value Formatting

- Configurable prefix/suffix
- Decimal places control
- Locale-aware number formatting

#### 3.4.8 Auto-Fit Labels

- Automatic label size adjustment
- Collision-based compacting
- Dynamic height suggestions

#### 3.4.9 Color Schemes

- `category10`: D3 category 10
- `tableau10`: Tableau 10
- `dark2`: D3 dark2
- `set3`: D3 set3
- Custom color arrays
- Color scheme offset/rotation

---

### 3.5 Reusable Components

#### 3.5.1 Groups (Connection Templates)

##### 3.5.1.1 Group CRUD

- **Create**: New group with name and description
- **Read**: View group details and connections
- **Update**: Edit name, description
- **Delete**: Remove group (cascade to references)

##### 3.5.1.2 Group Connections

- Define source/target templates
- Numeric values for each connection
- Add/remove connections within group

##### 3.5.1.3 Group Usage in Scenarios

- Reference groups in scenarios
- Direction selection (source/target)
- Show intermediate group node option
- Sub-node specific connections
- Per-scenario node ordering
- Reset to default order

#### 3.5.2 Project Nodes (Reusable Values)

##### 3.5.2.1 Node CRUD

- **Create**: New node with name, value, description
- **Read**: View node details
- **Update**: Edit name, value, description
- **Delete**: Remove node (cascade to references)

##### 3.5.2.2 Node Configuration

- Name (identifier)
- Numeric value
- Optional description
- Expression support for value calculation

##### 3.5.2.3 Node Promotion

- Promote local nodes to project nodes
- Value extraction from connections
- Automatic reference creation

---

### 3.6 Real-time Collaboration

#### 3.6.1 Server-Sent Events (SSE)

- Persistent connection per user/scenario
- Event broadcasting to collaborators
- Automatic reconnection (3-second delay)

#### 3.6.2 Event Types

- `scenario-updated`: General scenario change
- `project-updated`: Project-level change
- `connection-added`: New connection
- `connection-deleted`: Removed connection
- `connection-updated`: Modified connection
- `user-joined`: New collaborator
- `user-left`: Collaborator disconnected
- `connected`: Initial connection confirmation
- `active-users`: List of current collaborators

#### 3.6.3 User Presence

- Active user tracking per scenario
- Real-time user join/leave notifications
- Visual collaborator indicators
- Connection status indicator

#### 3.6.4 Data Synchronization

- Automatic revalidation on events
- Exclude event source from updates
- Reconnection data refresh

---

### 3.7 User Settings & Localization

#### 3.7.1 User Preferences

- **Display locale**: UI language (future feature)
- **Regional locale**: Number/date formatting

#### 3.7.2 Locale Options

- Browser default
- English (US, UK)
- German (Germany, Austria, Switzerland)
- French (France, Switzerland)
- Spanish (Spain)
- Italian (Italy)
- Dutch (Netherlands)
- Polish (Poland)
- Portuguese (Portugal, Brazil)

#### 3.7.3 Number Formatting

- Locale-specific thousands separator
- Locale-specific decimal separator
- Sample number preview
- Heuristic parsing for mixed input

---

### 3.8 Admin Panel

#### 3.8.1 User Management Dashboard

- List all users
- **Status statistics**: Pending, Active, Blocked counts
- Visual status cards

#### 3.8.2 User Table

- User name and email
- Status badge (color-coded)
- Role badges
- Join date
- View user details action

#### 3.8.3 User Administration

- View individual user
- Approve pending users
- Block/unblock users
- Role management (add/remove)

---

## 4. Value System & Calculation Logic

This section details the complex value calculation system that powers the Sankey diagram flow values.

### 4.1 Value Input Methods

#### 4.1.1 Direct Numeric Entry

- Simple number input: `100`, `1500.50`
- Locale-aware parsing (e.g., `1.234,56` for German locale → 1234.56)
- Heuristic separator detection when locale unknown:
  - `1,234.56` → US format (1234.56)
  - `1.234,56` → European format (1234.56)
  - `123,456` → Ambiguous, treated as European (123.456)

#### 4.1.2 Mathematical Expressions

- **Supported operators**: `+`, `-`, `*`, `/`
- **Parentheses**: Full grouping support
- **Examples**:
  - `100 + 50` → 150
  - `1000 * 0.5` → 500
  - `(100 + 200) / 3` → 100
  - `1.234,56 + 100` (German) → 1334.56
- **Storage**: Expression stored in `valueExpression`, computed result in `value`
- **Display**: Shows "150 (= 100 + 50)" format when expression present

#### 4.1.3 Percentage Values

- **Suffix options**: `%`, `p`, `percent` (case-insensitive)
- **Examples**: `50%`, `25p`, `33.5 percent`
- **Expression + percent**: `(100 + 50) / 5 %` → 50%
- **Meaning**: Percentage of total incoming flow to the source node
- **Resolution**: Calculated dynamically based on source node's incoming total

#### 4.1.4 Special Keywords

| Keyword   | Aliases               | Description                          |
| --------- | --------------------- | ------------------------------------ |
| Auto      | `a`, `auto`           | 100% of source's incoming flow       |
| Missing   | `?`, `m`, `missing`   | Gap-filling for supply deficit       |
| Remaining | `*`, `r`, `remaining` | Gap-filling for distribution surplus |

---

### 4.2 Value Types Explained

#### 4.2.1 Absolute Values

- **Behavior**: Fixed numeric value, does not change
- **Use case**: Known, static flow amounts
- **Example**: "Sales revenue is always 10,000"

#### 4.2.2 Percentage Values

- **Storage**: Stored as percentage (e.g., 50 for "50%")
- **Resolution formula**: `resolvedValue = (sourceIncoming * percentValue) / 100`
- **Dynamic**: Recalculates when source's incoming total changes
- **Use case**: "30% of income goes to taxes"
- **Example flow**:
  ```
  Income (1000 incoming) --[30%]--> Taxes
  Resolved: 1000 * 30 / 100 = 300
  ```

#### 4.2.3 Auto Values

- **Behavior**: Equivalent to 100% - forwards all incoming to source
- **Resolution formula**: `resolvedValue = sourceIncoming`
- **Constraint**: Only one auto connection per source node allowed
- **Use case**: "Everything from X flows to Y"
- **Example flow**:
  ```
  Revenue (500 incoming) --[auto]--> Net Income
  Resolved: 500
  ```

---

### 4.3 Placeholder Types (Balancing Flows)

Placeholders automatically calculate values to balance node flows.

#### 4.3.1 Missing Placeholder

- **Trigger condition**: Node has more outgoing than incoming
- **Visual**: Bright red flow (#ff0000)
- **Source node**: Virtual `_Missing_[NodeName]` node
- **Target node**: The unbalanced node
- **Calculation**: `missingValue = totalOutgoing - totalIncoming`
- **Use case**: Show where additional supply is needed
- **Example**:
  ```
  Before:
    A --[100]--> B --[150]--> C
    B has: incoming=100, outgoing=150 (deficit of 50)

  With Missing placeholder on B:
    _Missing_B --[50]--> B (red flow)
    Now B balances: incoming=150, outgoing=150
  ```

#### 4.3.2 Remaining Placeholder

- **Trigger condition**: Node has more incoming than outgoing
- **Visual**: Bright green flow (#00cc00)
- **Source node**: The unbalanced node
- **Target node**: Virtual `_Remaining_[NodeName]` node
- **Calculation**: `remainingValue = totalIncoming - totalOutgoing`
- **Use case**: Show where surplus flows
- **Example**:
  ```
  Before:
    A --[200]--> B --[150]--> C
    B has: incoming=200, outgoing=150 (surplus of 50)

  With Remaining placeholder on B:
    B --[50]--> _Remaining_B (green flow)
    Now B balances: incoming=200, outgoing=200
  ```

#### 4.3.3 User-Defined vs Auto-Generated Placeholders

- **User-defined**: Explicitly added by user, maintains position in connection list
- **Auto-generated**: System creates if needed, inserted after last connection for that node
- **Priority**: User placeholders take precedence

---

### 4.4 Value Resolution Algorithm

The system uses iterative resolution because values can depend on each other.

#### 4.4.1 Resolution Order

1. **Calculate node balances** (incoming/outgoing totals)
2. **Resolve placeholder values** based on node diffs
3. **Resolve auto/percent values** based on incoming totals
4. **Iterate until stable** (max 100 iterations)

#### 4.4.2 Dependency Chain Example

```
Scenario:
  A --[1000]--> B
  B --[auto]--> C
  C --[remaining]--> _Remaining_C
  C --[50%]--> D

Iteration 1:
  - B receives 1000
  - B auto → C = 1000
  - C receives 1000, has 50% outgoing → D = 500
  - C remaining = 1000 - 500 = 500
  
Final state:
  A → B: 1000
  B → C: 1000 (auto)
  C → D: 500 (50%)
  C → Remaining: 500
```

#### 4.4.3 Chained Placeholders

Placeholders can feed into other calculations:

```
  A --[100]--> B
  _Missing_B --[?]--> B   (resolves to 50)
  B --[auto]--> C          (receives 150)
  
Missing contributes to B's incoming total, which then
affects the auto connection to C.
```

---

### 4.5 Group Reference Value Handling

#### 4.5.1 Standard Group Reference (No Sub-Node)

- Values come from group's connection definitions
- All connections inherit group values
- Optional: Show intermediate group node aggregating flows

#### 4.5.2 Sub-Node Group Reference

When connecting to a specific node within a group:

- **Custom value**: Override the group-defined value
- **Percent value**: Percentage of connecting node's incoming
- **Auto value**: 100% of connecting node's incoming
- **Remaining**: Calculate based on connecting node's balance
- **Default**: Sum of matching group connections if no override

#### 4.5.3 Per-Scenario Node Ordering

- Override display order of group nodes for specific scenario
- Stored in `scenarioGroupNodeOrders` table
- Reset to default option available

---

### 4.6 Expression Evaluator Details

#### 4.6.1 Tokenization

1. Skip whitespace
2. Recognize parentheses: `(`, `)`
3. Recognize operators: `+`, `-`, `*`, `/`
4. Parse numbers with locale awareness
5. Handle negative numbers after operators

#### 4.6.2 Parsing (Recursive Descent)

- **Precedence**:
  1. Parentheses (highest)
  2. Multiplication, Division
  3. Addition, Subtraction (lowest)
- **Error handling**: Division by zero, mismatched parentheses

#### 4.6.3 Locale-Aware Number Parsing

```
Input: "1.234,56"
Locale: de-DE
→ Thousands separator: "."
→ Decimal separator: ","
→ Normalized: "1234.56"
→ Result: 1234.56
```

#### 4.6.4 Heuristic Parsing (No Locale)

| Input       | Interpretation     | Result  |
| ----------- | ------------------ | ------- |
| `1,234.56`  | US format          | 1234.56 |
| `1.234,56`  | European format    | 1234.56 |
| `1,234`     | European decimal   | 1.234   |
| `1,234,567` | US thousands       | 1234567 |
| `1.234.567` | European thousands | 1234567 |

---

## 5. Data Model Summary

### 5.1 Core Entities

| Entity                  | Description                             |
| ----------------------- | --------------------------------------- |
| Users                   | Application users with roles and status |
| Roles                   | Permission groups (admin, member)       |
| Sessions                | Authentication sessions                 |
| Projects                | Top-level containers for scenarios      |
| ProjectShares           | Sharing configuration                   |
| Scenarios               | Individual Sankey diagrams              |
| ScenarioLocalNodes      | Scenario-specific named nodes           |
| Connections             | Flow definitions between nodes          |
| Groups                  | Reusable connection templates           |
| Nodes                   | Reusable single nodes with values       |
| ScenarioGroups          | Junction: scenarios ↔ groups            |
| ScenarioNodes           | Junction: scenarios ↔ nodes             |
| ScenarioGroupNodeOrders | Per-scenario group node ordering        |

### 5.2 Connection Types

| Type            | Description                         |
| --------------- | ----------------------------------- |
| Direct          | Explicit source → target with value |
| Group Reference | Template-based connections          |
| Node Reference  | Single reusable node connection     |

### 5.3 Value Types

| Type      | Description                     |
| --------- | ------------------------------- |
| Absolute  | Fixed numeric value             |
| Percent   | Percentage of source incoming   |
| Auto      | 100% of source incoming         |
| Missing   | Calculated supply deficit       |
| Remaining | Calculated distribution surplus |

---

## 6. API Routes

| Route                              | Type   | Description            |
| ---------------------------------- | ------ | ---------------------- |
| `/`                                | Page   | Home dashboard         |
| `/login`                           | Page   | Login form             |
| `/signup`                          | Page   | Registration form      |
| `/logout`                          | Action | Session termination    |
| `/forgot-password`                 | Page   | Password reset request |
| `/reset-password`                  | Page   | Password reset form    |
| `/settings`                        | Page   | User preferences       |
| `/projects`                        | Page   | Project list           |
| `/projects/new`                    | Page   | Create project         |
| `/projects/:id`                    | Page   | View project           |
| `/projects/:id/edit`               | Page   | Edit project           |
| `/projects/:id/scenarios/new`      | Page   | Create scenario        |
| `/projects/:id/scenarios/:id`      | Page   | View scenario          |
| `/projects/:id/scenarios/:id/edit` | Page   | Edit scenario          |
| `/projects/:id/groups`             | Page   | Group list             |
| `/projects/:id/groups/new`         | Page   | Create group           |
| `/projects/:id/groups/:id`         | Page   | View group             |
| `/projects/:id/groups/:id/edit`    | Page   | Edit group             |
| `/projects/:id/nodes`              | Page   | Node list              |
| `/projects/:id/nodes/new`          | Page   | Create node            |
| `/projects/:id/nodes/:id`          | Page   | View node              |
| `/projects/:id/nodes/:id/edit`     | Page   | Edit node              |
| `/admin/users`                     | Page   | User list              |
| `/admin/users/:id`                 | Page   | User details           |
| `/api/realtime`                    | SSE    | Real-time events       |
| `/api/projects/:id/shares`         | API    | Share management       |

---

## 7. Component Architecture

### 7.1 Sankey Components

- `SankeyDiagram.tsx`: Main React component
- `layout.ts`: D3-based layout engine
- `renderer.ts`: SVG generation helpers
- `types.ts`: TypeScript interfaces

### 7.2 Scenario Edit Components

- `AddConnectionForm.tsx`: Connection creation form
- `ConnectionList.tsx`: Connection management list
- `ConnectionRow.tsx`: Individual connection display
- `EditableConnectionRow.tsx`: Inline editing row
- `DiagramSection.tsx`: Diagram container
- `LocalNodesPanel.tsx`: Local node management
- `InlineEditableText.tsx`: Generic inline editor
- `NodeCombobox.tsx`: Node selection dropdown
- `ReorderGroupNodesModal.tsx`: Group node ordering

### 7.3 Utility Modules

- `expressionEvaluator.ts`: Math expression parser
- `numberUtils.ts`: Locale number formatting
- `resolvedConnections.ts`: Connection resolution engine
- `realtime.server.ts`: SSE server logic
- `useRealtime.tsx`: SSE client hook

---

## 8. Security Features

- Password hashing (secure algorithm)
- Session-based authentication
- CSRF protection via form submissions
- Role-based route protection
- Project ownership verification
- Share permission enforcement
- Email enumeration prevention
- Token-based password reset with expiration

---

## 9. Performance Considerations

- Server-side rendering (faster initial load)
- Database connection pooling
- Incremental layout calculation
- SVG-based rendering (hardware accelerated)
- SSE for efficient real-time updates
- Optimistic UI updates via fetchers

---

_Document generated for test planning and documentation purposes._
