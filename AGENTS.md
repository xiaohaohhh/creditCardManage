# AGENTS.md - Credit Card Management App

> Guidelines for AI agents working in this codebase.

## Project Overview

A React + TypeScript PWA for managing credit card billing and payment due dates. Built with Vite, uses IndexedDB (Dexie) for local storage, and includes encryption capabilities for sensitive data.

**Tech Stack**: 
- Frontend: React 19, TypeScript 5.9, Vite 7, Tailwind CSS 4, Dexie (IndexedDB), date-fns
- Backend: Go 1.22, Gin, SQLite (modernc.org/sqlite)

**Deployment**:
- Frontend: Cloudflare Pages at `https://credit.xhxh.eu.org`
- Backend: N1 Docker container at `https://credit-api.xhxh.eu.org` (port 2006)

## Build/Lint/Test Commands

### Frontend

```bash
# Development server (runs on localhost:5173)
npm run dev

# Development with network access (for mobile testing)
npm run dev -- --host

# Production build (runs tsc then vite build)
npm run build

# Lint all files
npm run lint

# Preview production build
npm run preview
```

### Backend (Go)

```bash
# Run server locally
cd server
go run main.go

# Build binary
go build -o card-server main.go

# Run with environment variables
PORT=2006 DATA_DIR=./data go run main.go

# Format code
go fmt ./...

# Tidy dependencies
go mod tidy
```

**Note**: No test framework is currently configured. If adding tests:
- Frontend: Use Vitest (recommended for Vite projects)
- Backend: Use Go's standard `testing` package

## Project Structure

```
.
├── src/                    # Frontend source
│   ├── components/         # Reusable UI components (CardForm, CardItem)
│   ├── pages/              # Route pages (HomePage, AddCardPage, EditCardPage, SettingsPage)
│   ├── hooks/              # Custom React hooks (useCards)
│   ├── utils/              # Utility functions (crypto, billing, sync)
│   ├── db/                 # Database setup (Dexie/IndexedDB)
│   ├── types/              # TypeScript type definitions
│   ├── main.tsx            # App entry point
│   ├── App.tsx             # Router setup
│   └── index.css           # Global styles (Tailwind)
├── server/                 # Backend Go service
│   ├── main.go             # API server, routes, handlers, DB
│   ├── go.mod              # Go dependencies
│   └── Dockerfile          # Container build
├── public/                 # Static assets (PWA icons)
├── dist/                   # Frontend build output
└── docker-compose.yml      # Backend deployment config
```

## Code Style Guidelines

### Frontend (TypeScript/React)

#### Imports

Order imports as follows:
1. React/framework imports
2. Third-party libraries
3. Local components/pages
4. Local hooks
5. Local utilities
6. Types (use `import type` for type-only imports)

```typescript
// Example from HomePage.tsx
import { useNavigate } from 'react-router-dom';
import { Plus, CreditCard, Wallet, Settings } from 'lucide-react';
import { useCards } from '../hooks/useCards';
import { CardItem } from '../components/CardItem';
import { formatCurrency, getBillingInfo } from '../utils/billing';
```

```typescript
// Type-only imports
import type { CreditCard, CardFormData } from '../types';
```

#### Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Files (components/pages) | PascalCase.tsx | `CardForm.tsx`, `HomePage.tsx` |
| Files (utils/hooks) | camelCase.ts | `useCards.ts`, `billing.ts` |
| Components | PascalCase | `CardForm`, `CardItem` |
| Hooks | camelCase with `use` prefix | `useCards` |
| Functions | camelCase | `getBillingInfo`, `formatCurrency` |
| Types/Interfaces | PascalCase | `CreditCard`, `BillingInfo` |
| Constants | SCREAMING_SNAKE_CASE | `PBKDF2_ITERATIONS`, `SALT_LENGTH` |
| Variables | camelCase | `nextBillingDate`, `totalLimit` |

#### TypeScript

- **Strict mode enabled** - no implicit any, unused locals/parameters flagged
- Use `interface` for object shapes, `type` for unions/aliases
- Use `type` keyword for type-only imports: `import type { X } from '...'`
- Avoid `as any`, `@ts-ignore`, `@ts-expect-error`
- Optional properties use `?`: `notes?: string`

```typescript
// Interface for object shapes
export interface CreditCard {
  id?: number;
  name: string;
  billingDay: number;
  // ...
}

// Type for unions
export type CardColor = 'blue' | 'purple' | 'green' | 'orange' | 'pink' | 'gray';
export type PaymentStatus = 'safe' | 'warning' | 'urgent';
```

#### React Patterns

**Functional components only** - no class components:
```typescript
export function CardForm({ initialData, onSubmit, onCancel }: CardFormProps) {
  // ...
}
```

**Props interfaces** - define above component:
```typescript
interface CardFormProps {
  initialData?: CreditCard;
  onSubmit: (data: CardFormData) => void;
  onCancel: () => void;
  submitText?: string;
}
```

**Hooks usage**:
- `useState` for local state
- `useEffect` for side effects (with proper deps)
- `useRef` for DOM refs
- Custom hooks in `src/hooks/` for reusable logic

#### Error Handling

- Use try/catch for async operations
- Log errors with context: `console.error('图片处理失败:', err)`
- Throw descriptive errors: `throw new Error('加密管理器未解锁')`
- Validate user input before processing

```typescript
try {
  const compressed = await compressImage(file);
  setFormData(prev => ({ ...prev, [field]: compressed }));
} catch (err) {
  console.error('图片处理失败:', err);
}
```

#### Styling

- **Tailwind CSS 4** - utility-first, no separate CSS files for components
- Mobile-first responsive design
- Common patterns:
  - Rounded corners: `rounded-xl`, `rounded-2xl`
  - Shadows: `shadow-sm`, `shadow-lg`
  - Transitions: `transition-colors`, `transition-all`
  - Active states: `active:bg-blue-600`
  - Focus states: `focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20`

```typescript
const inputClass = "w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all";
```

#### Comments

- Use Chinese for user-facing comments (this is a Chinese app)
- JSDoc style for function documentation
- Inline comments for complex logic

```typescript
/**
 * 计算下一个指定日期（账单日或还款日）
 * @param day 每月的日期 (1-28)
 * @param referenceDate 参考日期，默认为今天
 */
export function getNextDateForDay(day: number, referenceDate: Date = new Date()): Date {
  // 如果目标日期已过或是今天，则取下个月
  if (isBefore(targetDate, today) || isToday(targetDate)) {
    targetDate = addMonths(targetDate, 1);
  }
  return targetDate;
}
```

### Backend (Go)

#### Project Structure

- Single file: `server/main.go` contains all code (types, handlers, DB operations)
- Framework: Gin for HTTP routing
- Database: SQLite via `modernc.org/sqlite` (pure Go, no CGO)

#### Naming Conventions

- Types: PascalCase (`Card`, `SyncRequest`, `SyncResponse`)
- Functions: camelCase (`initDB`, `healthCheck`, `syncCards`)
- Exported functions: PascalCase (none currently, all handlers are lowercase)
- Constants: Use Go conventions (no SCREAMING_SNAKE_CASE in current code)

#### API Routes

- Base prefix: `/api/v1` (versioned)
- Resource-oriented, plural nouns:
  - `GET /health` - Health check
  - `POST /sync` - Synchronization endpoint
  - `GET /cards` - List all cards
  - `POST /cards` - Create card
  - `PUT /cards/:id` - Update card
  - `DELETE /cards/:id` - Soft delete card

#### Database Patterns

- Driver: `database/sql` with `modernc.org/sqlite`
- Soft delete: `is_deleted` flag instead of hard delete
- Timestamps: Unix seconds (`created_at`, `updated_at`)
- Conflict resolution: `ON CONFLICT(sync_id) DO UPDATE WHERE excluded.updated_at > cards.updated_at`

```go
// Query non-deleted records
rows, err := db.Query(`
  SELECT ... FROM cards WHERE is_deleted = 0
  ORDER BY updated_at DESC
`)

// Soft delete
_, err := db.Exec(`
  UPDATE cards SET is_deleted = 1, updated_at = ? 
  WHERE id = ? OR sync_id = ?
`, time.Now().Unix(), id, id)
```

#### Error Handling

- Input validation: Return HTTP 400 with `{"error": "message"}`
- DB errors: Return HTTP 500 with `{"error": "message"}`
- Startup failures: `log.Fatal()` to terminate

```go
if err := c.ShouldBindJSON(&card); err != nil {
  c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
  return
}

if err := db.Exec(...); err != nil {
  c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
  return
}
```

#### Logging

- Use standard library `log`
- Startup: `log.Printf("信用卡管家服务启动在端口 %s", port)`
- Errors: `log.Printf("[handler] 错误描述: %v", err)`
- Fatal: `log.Fatal("致命错误:", err)`

#### Environment Variables

- `PORT` - Server port (default: 8080, production: 2006)
- `DATA_DIR` - Database directory (default: ./data)

## Database (Dexie/IndexedDB)

- Database defined in `src/db/index.ts`
- Current version: 2
- Use version migrations for schema changes
- Soft delete pattern: `isDeleted` flag instead of hard delete

```typescript
// Query non-deleted records
db.cards.filter(card => !card.isDeleted).toArray()

// Soft delete
await db.cards.update(id, { isDeleted: true, updatedAt: new Date() });
```

### Schema Migration Example

```typescript
db.version(3).stores({
  cards: '++id, name, bank, billingDay, paymentDueDay, syncId, isDeleted, createdAt, updatedAt',
  // Add new indexes or fields
}).upgrade(tx => {
  // Migration logic for existing data
  return tx.table('cards').toCollection().modify(card => {
    // Add default values for new fields
  });
});
```

## Key Libraries

| Library | Purpose | Docs |
|---------|---------|------|
| `react-router-dom` | Routing | [reactrouter.com](https://reactrouter.com) |
| `dexie` + `dexie-react-hooks` | IndexedDB wrapper | [dexie.org](https://dexie.org) |
| `date-fns` | Date manipulation | [date-fns.org](https://date-fns.org) |
| `lucide-react` | Icons | [lucide.dev](https://lucide.dev) |
| `vite-plugin-pwa` | PWA support | [vite-pwa-org.netlify.app](https://vite-pwa-org.netlify.app) |
| `gin-gonic/gin` | Go HTTP framework | [gin-gonic.com](https://gin-gonic.com) |
| `modernc.org/sqlite` | Pure Go SQLite | [pkg.go.dev](https://pkg.go.dev/modernc.org/sqlite) |

## PWA Configuration

PWA manifest configured in `vite.config.ts`. App name: "信用卡管家" (Credit Card Manager).

## Security Notes

- Sensitive data (card numbers, CVV) should be encrypted using `src/utils/crypto.ts`
- Uses Web Crypto API with AES-256-GCM encryption
- PBKDF2 for key derivation from user password (100,000 iterations)
- Never log or expose sensitive card data
- Backend stores encrypted data as-is (encryption happens on frontend)

## Deployment

### Frontend (Cloudflare Pages)

- URL: `https://credit.xhxh.eu.org`
- Build command: `npm run build`
- Output directory: `dist`
- Environment variables: None required (API URL configured in app)

### Backend (N1 Docker)

- URL: `https://credit-api.xhxh.eu.org`
- Internal port: 2006
- Container: Docker on N1 box
- Environment:
  - `PORT=2006`
  - `DATA_DIR=/app/data`
- Data persistence: Volume mounted to `/app/data`

### Local Development

```bash
# Frontend
npm run dev -- --host
# Access from mobile: http://<your-ip>:5173

# Backend
cd server
PORT=2006 DATA_DIR=./data go run main.go
# API: http://localhost:2006/api/v1/health

# Configure sync in app settings:
# Server URL: http://localhost:2006
```
