# proyecto-software2

Repositorio del proyecto

# Yupay Finance

## Estructura

- `frontend/`: React + TypeScript (Vite)
- `backend/`: Express + TypeScript

## Cómo ejecutar

```bash
cd backend && npm install && npm run dev     # http://localhost:3000
cd frontend && npm install && npm run dev    # http://localhost:5173
```

## Perfil de usuario

El perfil de demostración se sirve mediante `GET /api/perfil` y se actualiza con
`PUT /api/perfil`, enviando `nombre` y `correo` como JSON. Los datos se guardan en
`backend/data/perfiles.json`; los correos deben ser únicos entre los perfiles.
