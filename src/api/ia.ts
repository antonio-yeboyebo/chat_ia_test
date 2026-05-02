// ---------------------------------------------------------------------------
// Tipos que reflejan ConsultaIa / RespuestaIa del servidor Python
// ---------------------------------------------------------------------------

export interface ConsultaIa {
  pregunta: string
  thread_id?: string | null
  confirmacion?: boolean | null
}

export interface DatosPedido {
  accion: string
  mensaje: string
  cliente_id: string
  articulo_id: string
  cantidad: number
}

export interface RespuestaIa {
  respuesta: string
  thread_id: string
  esperando_confirmacion: boolean
  datos_pedido: DatosPedido | null
  /** Array de mensajes a2ui v0.9 incluidos en la respuesta REST */
  a2ui_messages?: unknown[]
}

// ---------------------------------------------------------------------------
// Tipos para el endpoint SSE de streaming (propuesta de mejora Python)
// ---------------------------------------------------------------------------

export type TipoEvento = 'delta' | 'confirmacion' | 'fin' | 'error' | 'a2ui'

export interface EventoStream {
  tipo: TipoEvento
  contenido?: string
  thread_id?: string
  esperando_confirmacion?: boolean
  datos_pedido?: DatosPedido | null
  /** Mensaje a2ui v0.9 (createSurface / updateComponents / updateDataModel / deleteSurface) */
  a2ui_message?: unknown
}

// ---------------------------------------------------------------------------
// Configuración del endpoint
// ---------------------------------------------------------------------------

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000'
const API_ENDPOINT = import.meta.env.VITE_API_ENDPOINT ?? '/comun/ia'
const API_STREAM_ENDPOINT = import.meta.env.VITE_API_STREAM_ENDPOINT ?? '/api/ia/stream'

// ---------------------------------------------------------------------------
// Llamada estándar (JSON)
// ---------------------------------------------------------------------------

export async function consultarIa(
  consulta: ConsultaIa,
  signal?: AbortSignal,
): Promise<RespuestaIa> {
  const res = await fetch(`${API_BASE}${API_ENDPOINT}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `X-Api-Key ${import.meta.env.VITE_API_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJldmVudG9zIjpbXSwiaWQiOiJ5ZWJveWVibyIsImdydXBvIjoiYWRtaW4iLCJhcHAiOiJvbHVsYSIsImV4cCI6MjYzNzMwMzI5Mn0.drFgJjmVCIBrEHyr5rdWeYJeZ31h2yQSQIzBGfRe0QM'}`,
    },
    body: JSON.stringify(consulta),
    signal,
  })

  if (!res.ok) {
    const texto = await res.text().catch(() => res.statusText)
    throw new Error(`Error del servidor: ${res.status} – ${texto}`)
  }

  return res.json() as Promise<RespuestaIa>
}

// ---------------------------------------------------------------------------
// Llamada con streaming SSE (requiere cambios en el servidor Python)
// Genera eventos EventoStream a medida que llegan del servidor.
// ---------------------------------------------------------------------------

export async function* consultarIaStream(
  consulta: ConsultaIa,
  signal?: AbortSignal,
): AsyncGenerator<EventoStream> {
  const res = await fetch(`${API_BASE}${API_STREAM_ENDPOINT}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(consulta),
    signal,
  })

  if (!res.ok) {
    const texto = await res.text().catch(() => res.statusText)
    throw new Error(`Error del servidor: ${res.status} – ${texto}`)
  }

  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lineas = buffer.split('\n')
    buffer = lineas.pop() ?? ''

    for (const linea of lineas) {
      if (linea.startsWith('data: ')) {
        try {
          const evento = JSON.parse(linea.slice(6)) as EventoStream
          yield evento
        } catch {
          // Ignorar líneas SSE mal formadas
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Acción de usuario a2ui (client-to-server)
// ---------------------------------------------------------------------------

/** Refleja el tipo A2uiClientAction de @a2ui/web_core */
export interface A2UIClientAction {
  name: string
  surfaceId: string
  sourceComponentId: string
  timestamp: string
  context: Record<string, unknown>
}

const API_A2UI_ACTION_ENDPOINT = import.meta.env.VITE_A2UI_ACTION_ENDPOINT ?? '/comun/ia/a2ui-action'

/**
 * Envía una acción de usuario a2ui al backend.
 * El backend debe procesar la acción y puede responder con nuevos mensajes a2ui.
 */
export async function enviarAccionA2UI(
  accion: A2UIClientAction,
  threadId: string | null,
  signal?: AbortSignal,
): Promise<RespuestaIa> {
  const res = await fetch(`${API_BASE}${API_A2UI_ACTION_ENDPOINT}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `X-Api-Key ${import.meta.env.VITE_API_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJldmVudG9zIjpbXSwiaWQiOiJ5ZWJveWVibyIsImdydXBvIjoiYWRtaW4iLCJhcHAiOiJvbHVsYSIsImV4cCI6MjYzNzMwMzI5Mn0.drFgJjmVCIBrEHyr5rdWeYJeZ31h2yQSQIzBGfRe0QM'}`,
    },
    body: JSON.stringify({ version: 'v0.9', action: accion, thread_id: threadId }),
    signal,
  })

  if (!res.ok) {
    const texto = await res.text().catch(() => res.statusText)
    throw new Error(`Error al enviar acción a2ui: ${res.status} – ${texto}`)
  }

  return res.json() as Promise<RespuestaIa>
}
