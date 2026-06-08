# 10 · Reseñas y reportes de una build

**Motores:** MongoDB
**Patrón (Etapa 1, §6):** *Consulta de reseñas y reportes de problemas asociados a una build.
Entrada: `targetId` de la build + `targetType = build`. Salida: listado de reseñas y reportes con
su rating, comentario y fecha.*

## Flujo de respuesta

1. **De dónde nace el dato:** colección `reviews`, cargada del seed `data/reviews.json`. Cada
   documento tiene `tipo` (review | reporte_problema), `targetId`, `targetType` (componente |
   build), `autor`, `rating` y `comentario`.
2. **Qué proceso lo valida/transforma:** se filtra por `targetType` + `targetId`. Existe un índice
   de apoyo `{ targetType: 1, targetId: 1 }` para acelerar esta consulta.
3. **En qué motor se persiste:** MongoDB (documental).
4. **Qué consulta se ejecuta:** `db.reviews.find({ targetType, targetId })`.
5. **Qué resultado se obtiene:** las reseñas/reportes de esa build.
6. **Interpretación técnica:** las reseñas crecen de forma continua y tienen forma variable; el
   modelo documental + índice compuesto resuelve el filtrado por destino sin tablas de unión.

## 1) Carga del dato (de dónde nace)

```powershell
npm run seed:mongo
```

> Insert de ejemplo (Mongo puro):
> ```js
> db.reviews.insertOne({
>   tipo: "review", targetId: "665f00000000000000000001", targetType: "build",
>   autor: "Lorenzo", rating: 5,
>   comentario: "Excelente relación precio/rendimiento.", fechaCreacion: new Date()
> })
> ```

## 2) Consulta para correr y capturar

Abrir Mongo: `docker exec -it wir-mongo mongosh willitrun`

```js
// Reseñas y reportes de una build
db.reviews.find({ targetType: "build", targetId: "665f00000000000000000001" })

// Solo reportes de problemas
db.reviews.find({ tipo: "reporte_problema" })

// Reseñas con rating alto (>= 4)
db.reviews.find({ rating: { $gte: 4 } })
```

## 3) Resultado esperado

Para `db.reviews.find({ targetType: "build", targetId: "665f00000000000000000001" })` →
**5 documentos** (4 reseñas + 1 reporte):

```js
[
  { tipo: 'review', autor: 'Marcelo', rating: 4, comentario: 'Build equilibrada para probar compatibilidad y scoring.' },
  { tipo: 'review', autor: 'Hernan',  rating: 5, comentario: 'La combinacion AM5 con RTX 4070 queda muy balanceada para gaming 1440p.' },
  { tipo: 'review', autor: 'Luca',    rating: 4, comentario: 'Buena build de referencia para demostrar MongoDB, Neo4j y Redis.' },
  { tipo: 'review', autor: 'Bautista',rating: 4, comentario: 'La compatibilidad entre CPU, motherboard, RAM y GPU se entiende bien en el grafo.' },
  { tipo: 'reporte_problema', autor: 'Lucila', comentario: 'La build es compatible, pero conviene monitorear margen de potencia si se cambia la GPU.' }
]
```

(Los documentos también traen `_id`, `targetId`, `targetType` y `fechaCreacion`; se omiten acá por espacio.)

## 4) Interpretación

La consulta filtra por el destino (`targetType` = build, `targetId` = id de la build) apoyada en
el índice compuesto, devolviendo todas las opiniones de esa configuración. El mismo patrón sirve
para reseñas de un componente cambiando `targetType` a `"componente"`: un único diseño documental
cubre ambos casos.
