# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server on port 3000
npm run build    # tsc -b && vite build
npm run preview  # Preview production build
```

No test or lint scripts are configured.

## Architecture

React + TypeScript frontend for an AI chat interface. Connects to a Python/LangGraph backend.

### Data flow

1. User submits text via `Compositor` in `Chat.tsx`
2. `IaRuntimeProvider` (in `src/runtime/`) adds the user message to state and calls either `consultarIa()` or `consultarIaStream()` depending on the streaming toggle
3. The backend returns either a JSON response or an SSE stream
4. If the response includes an order confirmation request, `IaRuntimeProvider` sets `confirmacion` state, showing `ConfirmacionPedido`
5. Confirming/canceling the order sends a follow-up message back to the same thread

### Key modules

- **`src/runtime/IaRuntimeProvider.tsx`** — all application state: message history, thread ID, streaming flag, confirmation. Bridges the backend API with `@assistant-ui/react`'s `useExternalStoreRuntime`. Exports `IaContext` and `useIaContext()`.
- **`src/api/ia.ts`** — API calls. `consultarIa()` does a standard POST; `consultarIaStream()` returns an async generator over SSE events. Both accept an `AbortSignal` for cancellation. The API key falls back to a hardcoded default if `VITE_API_KEY` is unset.
- **`src/components/Chat.tsx`** — renders the thread using `@assistant-ui/react` primitives (`ThreadPrimitive`, `MessagePrimitive`). The streaming toggle renders as a Zap/ZapOff icon in the header.
- **`src/components/ConfirmacionPedido.tsx`** — order confirmation modal, shown when `IaContext.confirmacion` is non-null.

### Backend endpoints

Configured via env vars (see `.env.example`):

| Variable | Default | Purpose |
|---|---|---|
| `VITE_API_BASE_URL` | `http://localhost:8000` | Backend base URL |
| `VITE_API_ENDPOINT` | `/api/ia` | JSON response endpoint |
| `VITE_API_STREAM_ENDPOINT` | `/api/ia/stream` | SSE streaming endpoint |
| `VITE_API_KEY` | hardcoded JWT | Auth header value |

`vite.config.ts` has a commented-out proxy to `localhost:5000` — uncomment and adjust if running the backend locally to avoid CORS issues.

### Styling

TailwindCSS with a custom `blink` keyframe animation (defined in `tailwind.config.js`) used for the loading indicator in `Chat.tsx`.
