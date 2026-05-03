import { useState, useCallback, type KeyboardEvent } from 'react'
import {
  MessagePrimitive,
  ThreadPrimitive,
  useMessage,
} from '@assistant-ui/react'
import { Bot, SendHorizontal, StopCircle, User, Zap, ZapOff } from 'lucide-react'
import { A2uiSurface, MarkdownContext } from '@a2ui/react/v0_9'
import { renderMarkdown } from '@a2ui/markdown-it'
import { useIaContext } from '../runtime/IaRuntimeProvider'
import { ConfirmacionPedido } from './ConfirmacionPedido'

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export function Chat() {
  const { confirmacion, confirmar, isRunning, useStreamingEnabled, setStreamingEnabled } =
    useIaContext()

  return (
    <div className="flex h-screen w-full flex-col bg-gray-50">
      {/* Cabecera */}
      <header className="flex items-center justify-between border-b bg-white px-5 py-3 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600">
            <Bot size={16} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">Asistente IA</p>
            <p className="text-xs text-gray-400">Gemini · LangGraph</p>
          </div>
        </div>

        {/* Toggle streaming */}
        <button
          onClick={() => setStreamingEnabled(!useStreamingEnabled)}
          title={useStreamingEnabled ? 'Streaming activo' : 'Streaming inactivo (requiere endpoint Python)'}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            useStreamingEnabled
              ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-200'
              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
          }`}
        >
          {useStreamingEnabled ? <Zap size={12} /> : <ZapOff size={12} />}
          {useStreamingEnabled ? 'Streaming' : 'Estándar'}
        </button>
      </header>

      {/* Área de mensajes — flex-1 para ocupar el espacio restante */}
      <ThreadPrimitive.Root className="flex min-h-0 flex-1 flex-col">
        <ThreadPrimitive.Viewport className="messages-viewport flex-1 min-h-0 overflow-y-auto px-4 py-6">
          <ThreadPrimitive.Empty>
            <EmptyState />
          </ThreadPrimitive.Empty>

          <ThreadPrimitive.Messages
            components={{ UserMessage, AssistantMessage }}
          />

        </ThreadPrimitive.Viewport>
      </ThreadPrimitive.Root>

      {/* Panel de confirmación — fuera de ThreadPrimitive.Root para no afectar la altura del viewport */}
      {confirmacion && (
        <div className="flex-none">
          <ConfirmacionPedido
            datos={confirmacion.datosPedido}
            onConfirmar={() => confirmar(true)}
            onCancelar={() => confirmar(false)}
            disabled={isRunning}
          />
        </div>
      )}

      {/* Compositor — textarea nativo, sin dependencia de ComposerPrimitive */}
      {!confirmacion && <Compositor />}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Estado vacío
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-100">
        <Bot size={28} className="text-blue-600" />
      </div>
      <p className="text-base font-semibold text-gray-700">¿En qué puedo ayudarte?</p>
      <p className="mt-1 max-w-xs text-sm text-gray-400">
        Puedo buscar clientes y artículos, y crear pedidos con confirmación.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {SUGERENCIAS.map(s => (
          <SugerenciaChip key={s} texto={s} />
        ))}
      </div>
    </div>
  )
}

const SUGERENCIAS = [
  'Busca el cliente C001',
  'Busca el artículo A100',
  'Crea un pedido',
]

function SugerenciaChip({ texto }: { texto: string }) {
  return (
    <span className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs text-gray-500 shadow-sm">
      {texto}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Compositor (textarea nativo — evita problemas con TextareaAutosize)
// ---------------------------------------------------------------------------

function Compositor() {
  const { isRunning, enviarMensaje, cancelarMensaje } = useIaContext()
  const [texto, setTexto] = useState('')

  const enviar = useCallback(async () => {
    const trimmed = texto.trim()
    if (!trimmed || isRunning) return
    setTexto('')
    await enviarMensaje(trimmed)
  }, [texto, isRunning, enviarMensaje])

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      enviar()
    }
  }, [enviar])
  
  return (
    <div className="flex-none border-t bg-white px-4 py-3 border-gray-200">
      <form
        onSubmit={(e) => { e.preventDefault(); enviar() }}
        className="flex items-end gap-2"
      >
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          autoFocus
          placeholder="Escribe un mensaje…"
          disabled={isRunning}
          className="flex-1 resize-none rounded-xl border border-gray-300 px-4 py-2.5 text-sm leading-relaxed focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 max-h-32 overflow-y-auto disabled:opacity-60"
        />

        {isRunning ? (
          <button
            type="button"
            onClick={cancelarMensaje}
            aria-label="Cancelar"
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-500 ring-1 ring-red-200 transition-colors hover:bg-red-100"
          >
            <StopCircle size={17} />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!texto.trim()}
            aria-label="Enviar"
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <SendHorizontal size={17} />
          </button>
        )}
      </form>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Mensajes
// ---------------------------------------------------------------------------

function UserMessage() {
  return (
    <MessagePrimitive.Root className="mb-4 flex justify-end px-1">
      <div className="flex items-end gap-2">
        <div className="max-w-[75vw] rounded-2xl rounded-br-sm bg-blue-600 px-4 py-2.5 text-sm text-white shadow-sm sm:max-w-md">
          <MessagePrimitive.Content
            components={{ Text: ({ text }) => <span className="whitespace-pre-wrap">{text}</span> }}
          />
        </div>
        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gray-200">
          <User size={13} className="text-gray-600" />
        </div>
      </div>
    </MessagePrimitive.Root>
  )
}

function AssistantMessage() {
  return (
    <MessagePrimitive.Root className="mb-4 flex flex-col px-1">
      <div className="flex items-end gap-2">
        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-blue-100">
          <Bot size={13} className="text-blue-600" />
        </div>
        <AssistantMessageContent />
      </div>
      <AssistantMessageA2UI />
    </MessagePrimitive.Root>
  )
}

function AssistantMessageA2UI() {
  const messageId = useMessage(m => m.id)
  const { a2uiSurfaces, messageSurfaceMap } = useIaContext()

  const surfaceIds = messageSurfaceMap[messageId] ?? []
  const surfaces = a2uiSurfaces.filter(s => surfaceIds.includes(s.id))

  if (surfaces.length === 0) return null

  return (
    <MarkdownContext.Provider value={renderMarkdown}>
      <div className="mt-2 ml-9 flex flex-col gap-2">
        {surfaces.map(surface => (
          <A2uiSurface key={surface.id} surface={surface} />
        ))}
      </div>
    </MarkdownContext.Provider>
  )
}

function AssistantMessageContent() {
  const showDots = useMessage((m) => {
    if (m.status?.type !== 'running') return false
    const text = m.content
      .filter(p => p.type === 'text')
      .map(p => (p as { text: string }).text)
      .join('')
    return text.length === 0
  })

  return (
    <div className="max-w-[75vw] rounded-2xl rounded-bl-sm border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-800 shadow-sm sm:max-w-md">
      {showDots ? (
        <span className="inline-flex gap-1">
          <span className="animate-blink h-1.5 w-1.5 rounded-full bg-gray-400 [animation-delay:0ms]" />
          <span className="animate-blink h-1.5 w-1.5 rounded-full bg-gray-400 [animation-delay:200ms]" />
          <span className="animate-blink h-1.5 w-1.5 rounded-full bg-gray-400 [animation-delay:400ms]" />
        </span>
      ) : (
        <MessagePrimitive.Content
          components={{ Text: ({ text }) => <span className="whitespace-pre-wrap">{text}</span> }}
        />
      )}
    </div>
  )
}
