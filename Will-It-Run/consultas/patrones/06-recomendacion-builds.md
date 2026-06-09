# 06 · Recomendación de builds por gama y perfil

**Motores:** MongoDB
**Patrón (Etapa 1, §6):** *Recomendación de builds preconfiguradas por gama (alta/media/baja) y
objetivo (gaming/diseño/arquitectura). Entrada: gama + perfil de uso. Salida: builds
preconfiguradas con sus componentes y su score/tier.*

## Diagrama de flujo en las bases de datos

```text
Cliente --> MongoDB
            coleccion "ensambles" (presets gama x perfil)
            filtro por gama + perfilUso, orden por buildScore
```

## Flujo de respuesta

1. **De dónde nace el dato:** builds curadas en la colección `ensambles`, cargadas del seed
   `data/builds.json`. Cada documento trae `gama`, `perfilUso`, `componentes` (7 slots),
   `buildScore` y `tier`.
2. **Qué proceso lo valida/transforma:** se filtra por `gama` + `perfilUso` (diseño orientado a
   la consulta: la build ya viene armada y puntuada).
3. **En qué motor se persiste:** MongoDB (documental).
4. **Qué consulta se ejecuta:** `db.ensambles.find({ gama, perfilUso })`.
5. **Qué resultado se obtiene:** las builds que corresponden a esa gama y perfil.
6. **Interpretación técnica:** un solo documento contiene la build completa + su score/tier, por
   lo que recomendar es una lectura directa, sin joins.

## 1) Carga del dato (de dónde nace)

```powershell
npm run seed:mongo
```

> Para enriquecer la demo con otra gama, se puede insertar una build más (Mongo puro):
> ```js
> db.ensambles.insertOne({
>   nombreBuild: "AM4 Oficina Básica",
>   perfilUso: "creative",
>   gama: "baja",
>   componentes: { cpu: "ryzen-5-7600", motherboard: "b650-tomahawk", memory: "corsair-vengeance-32-ddr5" },
>   buildScore: 55, tier: "C", powerDraw: 180, esPublica: true
> })
> ```

## 2) Consulta para correr y capturar

Abrir Mongo: `docker exec -it wir-mongo mongosh willitrun`

```js
// Builds de gama media para gaming
db.ensambles.find(
  { gama: "media", perfilUso: "gaming" },
  { _id: 0, nombreBuild: 1, gama: 1, perfilUso: 1, buildScore: 1, tier: 1, componentes: 1 }
)

// Todas las builds públicas ordenadas por score
db.ensambles.find({ esPublica: true }).sort({ buildScore: -1 })
```

## 3) Resultado esperado

**8 builds** coinciden con gama media + gaming. La primera, completa:

```js
[
  {
    nombreBuild: 'AM5 Gaming Equilibrada',
    perfilUso: 'gaming',
    gama: 'media',
    componentes: {
      cpu: 'ryzen-5-7600', cooler: 'hyper-212-black', motherboard: 'b650-tomahawk',
      memory: 'corsair-vengeance-32-ddr5', storage: 'samsung-990-pro-1tb',
      gpu: 'rtx-4070', psu: 'corsair-rm750e'
    },
    buildScore: 76, tier: 'A'
  }
  // + 7 más: "AM5 1080p Eficiente" (65/B), "Upgrade AM4 Gaming" (71/B),
  //          "Entrada Actual con RTX 5060" (68/B), "PC Compacta mATX AM5" (74/B), ...
]
```

## 4) Interpretación

La recomendación por gama/perfil se resuelve como una consulta documental simple porque la build
preconfigurada ya está modelada como un documento autocontenido (sus 7 slots + score + tier). El
modelo documental evita reconstruir la build con joins en cada recomendación.
