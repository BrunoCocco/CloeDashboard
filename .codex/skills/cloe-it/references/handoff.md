# Handoff Cloe → IT

Cloe entrega un prompt autocontenido con esta información:

## Pedido literal

Qué pidió Bruno, conservando nombres, prioridades y restricciones relevantes.

## Datos y estado

- Estado actual confirmado.
- Histórico que debe preservarse.
- Fuentes de verdad y fecha/hora de corte cuando los datos sean variables.

## Objetivo

Resultado observable esperado por Bruno.

## Alcance

- Incluido.
- Excluido.
- Archivos, rutas, tablas o servicios probablemente afectados.

## Invariantes

Reglas de arquitectura, privacidad, histórico, módulos de Cloe, Spot/Futuros y real/simulación que no pueden romperse.

## Criterios de aceptación

Comportamientos verificables que determinan si el trabajo está terminado.

## Verificación

Compilación, lint, pruebas, consultas, RLS/advisors, revisión visual, rutas y comprobaciones posteriores al despliegue que correspondan.

## Publicación

- Preparar primero una rama o vista previa.
- Devolver evidencia a Cloe.
- Publicar en producción cuando Cloe confirme que el handoff está cumplido; esa confirmación representa la autorización permanente otorgada por Bruno para cambios expresamente solicitados.
- Detenerse ante cualquier excepción sensible definida en `SKILL.md`.
