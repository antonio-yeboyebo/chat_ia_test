/**
 * Fixtures a2ui v0.9 para desarrollo sin backend.
 * Activa el modo mock con VITE_A2UI_MOCK=true en .env.local
 *
 * Formato real del protocolo v0.9:
 *   - "component" (no "type") lleva el nombre del componente
 *   - Las propiedades van directamente en el objeto (no dentro de "properties")
 *   - Los literales son valores directos (no "{ literal: ... }")
 *   - Data binding: { path: "/ruta/en/el/modelo" }
 *   - Card y Button tienen "child" (singular), Column/Row/List tienen "children"
 *
 * Referencia: https://a2ui.org/specification/v0.9-a2ui/
 */

const BASIC_CATALOG_ID = 'https://a2ui.org/specification/v0_9/basic_catalog.json'

// ---------------------------------------------------------------------------
// Surface: lista de artículos con botones de pedir
// ---------------------------------------------------------------------------

export const MOCK_MESSAGES_ARTICULOS: unknown[] = [
  // 0. Eliminar la superficie si ya existe (idempotente: no lanza error si no existe)
  {
    version: 'v0.9',
    deleteSurface: { surfaceId: 'articulos' },
  },
  // 1. Crear la superficie
  {
    version: 'v0.9',
    createSurface: {
      surfaceId: 'articulos',
      catalogId: BASIC_CATALOG_ID,
    },
  },

  // 2. Definir el árbol de componentes (flat list, cada objeto es { id, component, ...props })
  {
    version: 'v0.9',
    updateComponents: {
      surfaceId: 'articulos',
      components: [
        // Raíz: columna vertical
        {
          id: 'root',
          component: 'Column',
          children: ['titulo', 'lista'],
        },
        // Título
        {
          id: 'titulo',
          component: 'Text',
          text: 'Artículos disponibles',
          variant: 'h2',
        },
        // Lista con template por item
        {
          id: 'lista',
          component: 'List',
          // template: por cada item en /articulos, instanciar "fila-item"
          children: { componentId: 'fila-item', path: '/articulos' },
        },
        // Plantilla de fila: nombre + botón (se instancia una vez por artículo)
        {
          id: 'fila-item',
          component: 'Row',
          children: ['item-nombre', 'item-btn-pedir'],
        },
        // Texto: nombre del artículo (data binding relativo al item)
        {
          id: 'item-nombre',
          component: 'Text',
          text: { path: 'nombre' },
        },
        // Texto del botón (Button requiere un componente hijo para la etiqueta)
        {
          id: 'item-btn-label',
          component: 'Text',
          text: 'Pedir',
        },
        // Botón con acción de evento
        {
          id: 'item-btn-pedir',
          component: 'Button',
          child: 'item-btn-label',
          action: {
            event: {
              name: 'pedir_articulo',
              context: {
                articulo_id: { path: 'id' },
                nombre: { path: 'nombre' },
              },
            },
          },
        },
      ],
    },
  },

  // 3. Inyectar datos
  {
    version: 'v0.9',
    updateDataModel: {
      surfaceId: 'articulos',
      path: '/',
      value: {
        articulos: [
          { id: 'A001', nombre: 'Tornillo M6 x 20mm' },
          { id: 'A002', nombre: 'Arandela plana M6' },
          { id: 'A003', nombre: 'Tuerca hexagonal M6' },
          { id: 'A004', nombre: 'Perno allen M8 x 30mm' },
        ],
      },
    },
  },
]

// ---------------------------------------------------------------------------
// Surface: confirmación de pedido
// ---------------------------------------------------------------------------

export const MOCK_MESSAGES_CONFIRMACION: unknown[] = [
  // Eliminar si ya existe
  {
    version: 'v0.9',
    deleteSurface: { surfaceId: 'confirmacion-pedido' },
  },
  {
    version: 'v0.9',
    createSurface: {
      surfaceId: 'confirmacion-pedido',
      catalogId: BASIC_CATALOG_ID,
    },
  },
  {
    version: 'v0.9',
    updateComponents: {
      surfaceId: 'confirmacion-pedido',
      components: [
        // Card con columna interior
        {
          id: 'root',
          component: 'Card',
          child: 'col',
        },
        {
          id: 'col',
          component: 'Column',
          children: ['titulo', 'resumen', 'fila-botones'],
        },
        {
          id: 'titulo',
          component: 'Text',
          text: '¿Confirmar pedido?',
          variant: 'h3',
        },
        {
          id: 'resumen',
          component: 'Text',
          text: { path: '/resumen' },
        },
        {
          id: 'fila-botones',
          component: 'Row',
          children: ['btn-confirmar', 'btn-cancelar'],
        },
        // Label del botón confirmar
        {
          id: 'lbl-confirmar',
          component: 'Text',
          text: 'Confirmar',
        },
        {
          id: 'btn-confirmar',
          component: 'Button',
          child: 'lbl-confirmar',
          variant: 'primary',
          action: { event: { name: 'confirmar_pedido' } },
        },
        // Label del botón cancelar
        {
          id: 'lbl-cancelar',
          component: 'Text',
          text: 'Cancelar',
        },
        {
          id: 'btn-cancelar',
          component: 'Button',
          child: 'lbl-cancelar',
          action: { event: { name: 'cancelar_pedido' } },
        },
      ],
    },
  },
  {
    version: 'v0.9',
    updateDataModel: {
      surfaceId: 'confirmacion-pedido',
      path: '/',
      value: {
        resumen: 'Cliente: C001 · Artículo: Tornillo M6 x 20mm · Cantidad: 10',
      },
    },
  },
]

// ---------------------------------------------------------------------------
// Helper: devuelve los mensajes mock según el texto del usuario
// ---------------------------------------------------------------------------

export function getMockA2UIMessages(texto: string): unknown[] | null {
  const t = texto.toLowerCase()
  if (t.includes('artículo') || t.includes('articulo') || t.includes('catálogo') || t.includes('catalogo')) {
    return MOCK_MESSAGES_ARTICULOS
  }
  if (t.includes('confirmar') || t.includes('pedido')) {
    return MOCK_MESSAGES_CONFIRMACION
  }
  return null
}
