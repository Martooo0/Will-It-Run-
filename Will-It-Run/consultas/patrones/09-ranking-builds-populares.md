# 09 · Ranking de builds populares por período

**Motores:** Redis
**Patrón (Etapa 1, §6):** *Ranking de builds más populares en un período de tiempo (semana, mes).
Estructura: sorted set `builds:trending:{periodo}`, score = visitas o likes acumulados. Entrada:
el período + cantidad de resultados (top N). Salida: ranking ordenado con su puntaje.*

## Diagrama de flujo en las bases de datos

```text
Cliente --> Redis
            sorted set builds:trending:{periodo}
            ZINCRBY (registrar visita/like) / ZREVRANGE (top N)
```

## Flujo de respuesta

1. **De dónde nace el dato:** las interacciones de los usuarios (visitas / likes) sobre cada build.
2. **Qué proceso lo valida/transforma:** cada interacción **suma** puntaje a la build con `ZINCRBY`
   sobre el sorted set del período; el ranking se obtiene con `ZREVRANGE` (orden descendente).
3. **En qué motor se persiste:** Redis (estructura *sorted set* `builds:trending:{periodo}`).
4. **Qué consulta se ejecuta:** `ZINCRBY` (registrar) y `ZREVRANGE ... WITHSCORES` (leer top N).
5. **Qué resultado se obtiene:** las builds ordenadas por puntaje, con su score.
6. **Interpretación técnica:** el sorted set mantiene el orden en `O(log N)` por inserción y
   devuelve el top sin recalcular; en Mongo esto exigiría una aggregation costosa en cada lectura.

## 1) Carga del dato (de dónde nace)

Cada visita/like es una interacción. Acá se simulan tres builds **reales** de `data/builds.json`
con distinto puntaje (el _id en Mongo es el member del sorted set):

| member (`_id`)             | build                    |
|----------------------------|--------------------------|
| `665f00000000000000000003` | Ryzen 1440p Popular      |
| `665f00000000000000000001` | AM5 Gaming Equilibrada   |
| `665f00000000000000000009` | Arquitectura Alta Gama   |

`docker exec -it wir-redis redis-cli`

```redis
DEL builds:trending:semana
ZINCRBY builds:trending:semana 8 665f00000000000000000003
ZINCRBY builds:trending:semana 5 665f00000000000000000001
ZINCRBY builds:trending:semana 3 665f00000000000000000009
```

## 2) Consulta para correr y capturar

```redis
ZREVRANGE builds:trending:semana 0 9 WITHSCORES
ZSCORE builds:trending:semana 665f00000000000000000001
ZREVRANK builds:trending:semana 665f00000000000000000001
```

## 3) Resultado esperado

```
ZREVRANGE builds:trending:semana 0 9 WITHSCORES
1) "665f00000000000000000003"   # Ryzen 1440p Popular
2) "8"
3) "665f00000000000000000001"   # AM5 Gaming Equilibrada
4) "5"
5) "665f00000000000000000009"   # Arquitectura Alta Gama
6) "3"

ZSCORE   -> "5"
ZREVRANK -> (integer) 1     # posición 0-based: 2º en el ranking
```

## 4) Interpretación

El sorted set ordena solo: `...003` (8) queda primera, la build de referencia `...001` (5)
segunda y `...009` (3) tercera. Registrar una visita es un único `ZINCRBY` y leer el top es un
único `ZREVRANGE`, ambos en tiempo logarítmico, sin tocar Mongo. Cambiando el período
(`builds:trending:mes`) se obtiene otro ranking con la misma estructura.

> El mismo patrón aplica a los **componentes más usados** por categoría:
> `componentes:trending:cpu`, `componentes:trending:gpu`, etc. (ver `redis-demo.txt`).
