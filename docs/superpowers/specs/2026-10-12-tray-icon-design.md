# Tray Icon — Diseño

**Fecha:** 2026-10-12
**Autor:** Jacob

## Objetivo

Agregar un ícono al system tray de Windows que permita controlar Buddy sin interactuar con el avatar directamente: mostrar/ocultar la ventana, anclar el avatar en su posición actual, y cerrar la aplicación.

## Comportamiento

### Clic izquierdo sobre el tray icon
Toggle show/hide de la ventana (mismo efecto que el menú).

### Menú (clic derecho)
| Item | Comportamiento | Label dinámico |
|---|---|---|
| Mostrar / Ocultar | Alterna `window.show()` / `window.hide()` | Cambia según visibilidad actual |
| Anclar / Desanclar | Emite evento `anchor-changed` al frontend | Cambia según estado actual |
| *(separador)* | | |
| Cerrar Buddy | Llama `app.exit(0)` | Fijo |

## Arquitectura

### Rust (`main.rs`)

- Feature `tray-icon` habilitada en el crate `tauri`
- Ícono embebido como bytes (`include_bytes!`) desde `icons/tray.png` (32×32 PNG)
- `TrayIconBuilder` construido en `setup()` con el menú y handlers registrados
- Estado mutable del tray: `is_visible: bool` e `is_anchored: bool` en `Mutex<TrayState>` gestionado vía `app.manage()`
- Al hacer clic en un item del menú, Rust lee/escribe `TrayState`, actualiza el texto del item y actúa sobre la ventana o emite un evento

### JS (`BuddyOverlay.tsx`)

- `anchoredRef = useRef(false)` — controla si el walk autónomo está pausado
- `useEffect` al montar: `listen('anchor-changed', ({ payload }) => { anchoredRef.current = payload })`
- `scheduleNextWalk`: ya tiene `if (isDraggingRef.current || stateRef.current === 'sleep') return` — se añade `|| anchoredRef.current`

### Archivo de ícono

- `apps/desktop/src-tauri/icons/tray.png` — 32×32 PNG, fondo transparente
- Para el MVP se genera programáticamente un PNG minimalista (cuadrado naranja sólido) usando la crate `image`, o se copia un PNG estático simple

## Archivos modificados

| Archivo | Cambio |
|---|---|
| `src-tauri/Cargo.toml` | Añadir feature `tray-icon` a `tauri`; añadir crate `image` si se genera el PNG en código |
| `src-tauri/src/main.rs` | `TrayState`, `TrayIconBuilder`, handlers |
| `src/BuddyOverlay.tsx` | `anchoredRef`, listener `anchor-changed`, guard en `scheduleNextWalk` |
| `src-tauri/icons/tray.png` | Archivo de ícono nuevo |

## No incluido en este spec

- Configuración de personalidad desde el tray (spec separado)
- Posición de inicio configurable (spec separado)
- Icono animado / badge de estado
