import { CheckCircle, XCircle, ShoppingCart } from 'lucide-react'
import type { DatosPedido } from '../api/ia'

interface Props {
  datos: DatosPedido
  onConfirmar: () => void
  onCancelar: () => void
  disabled?: boolean
}

export function ConfirmacionPedido({ datos, onConfirmar, onCancelar, disabled }: Props) {
  return (
    <div className="mx-4 mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <ShoppingCart size={16} className="text-amber-600" />
        <h3 className="text-sm font-semibold text-amber-800">Confirmar creación de pedido</h3>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-amber-700">
        <span className="font-medium">Cliente:</span>
        <span>{datos.cliente_id}</span>
        <span className="font-medium">Artículo:</span>
        <span>{datos.articulo_id}</span>
        <span className="font-medium">Cantidad:</span>
        <span>{datos.cantidad}</span>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onConfirmar}
          disabled={disabled}
          className="flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <CheckCircle size={15} />
          Confirmar
        </button>
        <button
          onClick={onCancelar}
          disabled={disabled}
          className="flex items-center gap-1.5 rounded-lg bg-white px-4 py-2 text-sm font-medium text-red-600 ring-1 ring-red-200 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <XCircle size={15} />
          Cancelar
        </button>
      </div>
    </div>
  )
}
