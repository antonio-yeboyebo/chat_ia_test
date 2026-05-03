import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  AssistantRuntimeProvider,
  useExternalStoreRuntime,
  type ThreadMessageLike,
  type AppendMessage,
} from '@assistant-ui/react'
import { MessageProcessor } from '@a2ui/web_core/v0_9'
import type { SurfaceModel } from '@a2ui/web_core/v0_9'
import { basicCatalog } from '@a2ui/react/v0_9'
import type { ReactComponentImplementation } from '@a2ui/react/v0_9'
import {
  consultarIa,
  consultarIaStream,
  enviarAccionA2UI,
  type DatosPedido,
  type A2UIClientAction,
} from '../api/ia'
import { getMockA2UIMessages } from '../api/a2uiMocks'

// ---------------------------------------------------------------------------
// Tipos internos
// ---------------------------------------------------------------------------

export interface MensajeChat {
  id: string
  role: 'user' | 'assistant'
  content: string
}

export interface EstadoConfirmacion {
  threadId: string
  datosPedido: DatosPedido
}

interface IaContextValue {
  threadId: string | null
  confirmacion: EstadoConfirmacion | null
  isRunning: boolean
  confirmar: (valor: boolean) => Promise<void>
  enviarMensaje: (texto: string) => Promise<void>
  cancelarMensaje: () => void
  useStreamingEnabled: boolean
  setStreamingEnabled: (v: boolean) => void
  /** Superficies a2ui activas en el hilo actual */
  a2uiSurfaces: SurfaceModel<ReactComponentImplementation>[]
  /** Mapa messageId → surfaceIds para renderizado inline */
  messageSurfaceMap: Record<string, string[]>
  /** Envía una acción de usuario a2ui al backend */
  enviarAccion: (accion: A2UIClientAction) => Promise<void>
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const IaContext = createContext<IaContextValue | null>(null)

export function useIaContext(): IaContextValue {
  const ctx = useContext(IaContext)
  if (!ctx) throw new Error('useIaContext debe usarse dentro de IaRuntimeProvider')
  return ctx
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let _counter = 0
function newId() {
  return `msg-${++_counter}`
}

function textoDe(msg: AppendMessage): string {
  return msg.content
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map(p => p.text)
    .join('\n')
}

const A2UI_MOCK_ENABLED = import.meta.env.VITE_A2UI_MOCK === 'true'

function crearProcessor(
  onAction: (accion: A2UIClientAction) => void,
): MessageProcessor<ReactComponentImplementation> {
  return new MessageProcessor([basicCatalog], onAction)
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function IaRuntimeProvider({ children }: { children: ReactNode }) {
  const [mensajes, setMensajes] = useState<MensajeChat[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [threadId, setThreadId] = useState<string | null>(null)
  const [confirmacion, setConfirmacion] = useState<EstadoConfirmacion | null>(null)
  const [streamingEnabled, setStreamingEnabled] = useState(false)
  const [a2uiSurfaces, setA2uiSurfaces] = useState<SurfaceModel<ReactComponentImplementation>[]>([])
  const [messageSurfaceMap, setMessageSurfaceMap] = useState<Record<string, string[]>>({})
  const currentMessageIdRef = useRef<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const threadIdRef = useRef<string | null>(null)

  // Mantenemos la referencia al threadId actualizada para usarla en el action handler
  // (que se crea una sola vez en el closure de crearProcessor)
  useEffect(() => {
    threadIdRef.current = threadId
  }, [threadId])

  // ── MessageProcessor a nivel de hilo ──────────────────────────────────────

  // El action handler se define con una ref para poder reemplazarlo sin recrear el processor
  const actionHandlerRef = useRef<(accion: A2UIClientAction) => void>(() => {})

  const [a2uiProcessor] = useState<MessageProcessor<ReactComponentImplementation>>(
    () => crearProcessor((accion) => actionHandlerRef.current(accion)),
  )

  // Suscribirse a la creación/eliminación de superficies
  useEffect(() => {
    const subCreated = a2uiProcessor.onSurfaceCreated((surface) => {
      setA2uiSurfaces(prev => [...prev, surface])
      const messageId = currentMessageIdRef.current
      if (messageId) {
        setMessageSurfaceMap(prev => ({
          ...prev,
          [messageId]: [...(prev[messageId] ?? []), surface.id],
        }))
      }
    })
    const subDeleted = a2uiProcessor.onSurfaceDeleted((id) => {
      setA2uiSurfaces(prev => prev.filter(s => s.id !== id))
      setMessageSurfaceMap(prev => {
        const next = { ...prev }
        for (const [msgId, surfaceIds] of Object.entries(next)) {
          const filtered = surfaceIds.filter(sid => sid !== id)
          if (filtered.length === 0) delete next[msgId]
          else next[msgId] = filtered
        }
        return next
      })
    })
    return () => {
      subCreated.unsubscribe()
      subDeleted.unsubscribe()
    }
  }, [a2uiProcessor])

  // ── Conversión para assistant-ui ────────────────────────────────────────

  const convertMessage = useCallback((msg: MensajeChat): ThreadMessageLike => ({
    id: msg.id,
    role: msg.role,
    content: [{ type: 'text', text: msg.content }],
  }), [])

  // ── Procesado de mensajes a2ui (llamado desde la lógica de envío) ────────

  const procesarMensajesA2UI = useCallback((mensajesA2UI: unknown[], messageId?: string) => {
    // Antes de pasar los mensajes al processor, inyectar deleteSurface automáticamente
    // para cualquier createSurface cuya superficie ya exista en el modelo.
    // Esto hace la integración robusta frente a backends que no gestionan el ciclo de vida.
    const mensajesNormalizados: unknown[] = []
    for (const msg of mensajesA2UI) {
      const m = msg as Record<string, unknown>
      if (m.createSurface) {
        const { surfaceId } = m.createSurface as { surfaceId: string }
        if (a2uiProcessor.model.getSurface(surfaceId)) {
          mensajesNormalizados.push({ version: 'v0.9', deleteSurface: { surfaceId } })
        }
      }
      mensajesNormalizados.push(msg)
    }
    currentMessageIdRef.current = messageId ?? null
    a2uiProcessor.processMessages(mensajesNormalizados as Parameters<typeof a2uiProcessor.processMessages>[0])
    currentMessageIdRef.current = null
  }, [a2uiProcessor])

  // ── Lógica principal de envío ────────────────────────────────────────────

  const procesarTexto = useCallback(async (texto: string) => {
    if (confirmacion) return
    if (!texto.trim()) return

    const userMsg: MensajeChat = { id: newId(), role: 'user', content: texto }
    setMensajes(prev => [...prev, userMsg])
    setIsRunning(true)
    abortRef.current = new AbortController()

    try {
      if (streamingEnabled) {
        // ── Modo streaming (requiere cambios en el servidor Python) ──────
        const assistantId = newId()
        setMensajes(prev => [...prev, { id: assistantId, role: 'assistant', content: '' }])

        let textoAcumulado = ''
        for await (const evento of consultarIaStream(
          { pregunta: texto, thread_id: threadId },
          abortRef.current.signal,
        )) {
          if (evento.tipo === 'delta' && evento.contenido) {
            textoAcumulado += evento.contenido
            setMensajes(prev =>
              prev.map(m => m.id === assistantId ? { ...m, content: textoAcumulado } : m),
            )
          } else if (evento.tipo === 'a2ui' && evento.a2ui_message) {
            procesarMensajesA2UI([evento.a2ui_message], assistantId)
          } else if (evento.tipo === 'confirmacion' && evento.datos_pedido && evento.thread_id) {
            setThreadId(evento.thread_id)
            setConfirmacion({ threadId: evento.thread_id, datosPedido: evento.datos_pedido })
          } else if (evento.tipo === 'fin' && evento.thread_id) {
            setThreadId(evento.thread_id)
          } else if (evento.tipo === 'error') {
            setMensajes(prev =>
              prev.map(m =>
                m.id === assistantId
                  ? { ...m, content: `Error: ${evento.contenido ?? 'desconocido'}` }
                  : m,
              ),
            )
          }
        }
      } else {
        // ── Modo estándar (JSON) ─────────────────────────────────────────
        const respuesta = await consultarIa(
          { pregunta: texto, thread_id: threadId },
          abortRef.current.signal,
        )
        const assistantId = newId()
        setMensajes(prev => [
          ...prev,
          { id: assistantId, role: 'assistant', content: respuesta.respuesta },
        ])
        setThreadId(respuesta.thread_id)

        // Procesar mensajes a2ui de la respuesta REST
        if (respuesta.a2ui_messages?.length) {
          procesarMensajesA2UI(respuesta.a2ui_messages, assistantId)
        }

        if (respuesta.esperando_confirmacion && respuesta.datos_pedido) {
          setConfirmacion({
            threadId: respuesta.thread_id,
            datosPedido: respuesta.datos_pedido,
          })
        }
      }

      // ── Mock de desarrollo: inyectar mensajes a2ui si aplica ───────────
      if (A2UI_MOCK_ENABLED) {
        const mockMsgs = getMockA2UIMessages(texto)
        if (mockMsgs) {
          procesarMensajesA2UI(mockMsgs)
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      setMensajes(prev => [
        ...prev,
        { id: newId(), role: 'assistant', content: `Error: ${(err as Error).message}` },
      ])
    } finally {
      setIsRunning(false)
    }
  }, [threadId, confirmacion, streamingEnabled, procesarMensajesA2UI])

  // ── Callbacks para el runtime de assistant-ui ────────────────────────────

  const onNew = useCallback(async (appendMsg: AppendMessage) => {
    await procesarTexto(textoDe(appendMsg))
  }, [procesarTexto])

  // ── Respuesta a confirmación de pedido ───────────────────────────────────

  const confirmar = useCallback(async (valor: boolean) => {
    if (!confirmacion) return

    const savedConfirmacion = confirmacion
    const pendingId = newId()
    setConfirmacion(null)
    setMensajes(prev => [...prev, { id: pendingId, role: 'assistant', content: '' }])
    setIsRunning(true)
    abortRef.current = new AbortController()

    try {
      const respuesta = await consultarIa(
        {
          pregunta: '',
          thread_id: savedConfirmacion.threadId,
          confirmacion: valor,
        },
        abortRef.current.signal,
      )

      setMensajes(prev =>
        prev.map(m => m.id === pendingId ? { ...m, content: respuesta.respuesta } : m),
      )
      setThreadId(respuesta.thread_id)

      if (respuesta.a2ui_messages?.length) {
        procesarMensajesA2UI(respuesta.a2ui_messages, pendingId)
      }

      // Soporte para confirmaciones encadenadas (raro pero posible)
      if (respuesta.esperando_confirmacion && respuesta.datos_pedido) {
        setConfirmacion({ threadId: respuesta.thread_id, datosPedido: respuesta.datos_pedido })
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      setMensajes(prev =>
        prev.map(m => m.id === pendingId ? { ...m, content: `Error: ${(err as Error).message}` } : m),
      )
    } finally {
      setIsRunning(false)
    }
  }, [confirmacion, procesarMensajesA2UI])

  // ── Cancelar petición en curso ───────────────────────────────────────────

  const onCancel = useCallback(async () => {
    abortRef.current?.abort()
    setIsRunning(false)
  }, [])

  // ── API pública para el compositor custom ────────────────────────────────

  const enviarMensaje = useCallback((texto: string): Promise<void> => {
    return procesarTexto(texto)
  }, [procesarTexto])

  const cancelarMensaje = useCallback(() => {
    abortRef.current?.abort()
    setIsRunning(false)
  }, [])

  // ── Acción a2ui ──────────────────────────────────────────────────────────

  const enviarAccion = useCallback(async (accion: A2UIClientAction) => {
    const pendingId = newId()
    setMensajes(prev => [...prev, { id: pendingId, role: 'assistant', content: '' }])
    setIsRunning(true)
    try {
      const respuesta = await enviarAccionA2UI(accion, threadIdRef.current)
      if (respuesta.a2ui_messages?.length) {
        procesarMensajesA2UI(respuesta.a2ui_messages, pendingId)
      }
      if (respuesta.respuesta) {
        setMensajes(prev =>
          prev.map(m => m.id === pendingId ? { ...m, content: respuesta.respuesta } : m),
        )
      } else {
        setMensajes(prev => prev.filter(m => m.id !== pendingId))
      }
    } catch (err) {
      console.error('Error al enviar acción a2ui:', err)
      setMensajes(prev => prev.filter(m => m.id !== pendingId))
    } finally {
      setIsRunning(false)
    }
  }, [procesarMensajesA2UI])

  // Actualizar el action handler del processor cuando cambia enviarAccion
  useEffect(() => {
    actionHandlerRef.current = enviarAccion
  }, [enviarAccion])

  // ── Runtime de assistant-ui ──────────────────────────────────────────────

  const runtime = useExternalStoreRuntime({
    isRunning,
    messages: mensajes,
    convertMessage,
    onNew,
    onCancel,
  })

  return (
    <IaContext.Provider value={{
      threadId,
      confirmacion,
      isRunning,
      confirmar,
      enviarMensaje,
      cancelarMensaje,
      useStreamingEnabled: streamingEnabled,
      setStreamingEnabled,
      a2uiSurfaces,
      messageSurfaceMap,
      enviarAccion,
    }}>
      <AssistantRuntimeProvider runtime={runtime}>
        {children}
      </AssistantRuntimeProvider>
    </IaContext.Provider>
  )
}
