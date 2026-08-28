# TeamFlow

Una lista de tareas compartida para un equipo chico. Una sola página, sin
compilar, con todo lo que un equipo necesita para no perderse: asignar,
comentar, repetir, avisar por Slack.

> **Este repositorio está congelado.** Es el TeamFlow original, de abril de
> 2026. El proyecto siguió con una reescritura completa que vive en otro lado
> —ver [Qué pasó después](#qué-pasó-después)—. Lo que hay acá se deja tal cual
> quedó, porque es de dónde salió todo lo demás.

---

## Por qué existió

Un equipo chico coordinándose por WhatsApp y memoria. Las herramientas que
había —Trello, Asana, Notion— resuelven el problema, pero piden que todos
aprendan una app, y arriba de cierto tamaño te cobran. La idea fue hacer una
que hiciera exactamente lo que este equipo necesitaba y nada más.

## Qué hacía

| | |
|---|---|
| **Tareas** | Prioridad, vencimiento, etiquetas, subtareas |
| **Asignación** | Cada tarea con su responsable |
| **Comentarios** | Hilos de conversación adentro de cada tarea |
| **Recurrencia** | Tareas que se repiten sin volver a crearlas |
| **Kanban** | Vista de tablero además de la lista |
| **Slack** | Avisos automáticos al canal del equipo |
| **Reportes** | Qué se hizo, quién lo hizo |
| **Panel de admin** | Gestión de usuarios |
| **Tema oscuro** | Y una interfaz pensada para el teléfono |

## Cómo estaba hecho

**Un solo archivo.** `index.html`, 2.018 líneas, con React 18 cargado por CDN
en su versión UMD. Sin `npm install`, sin compilar, sin `node_modules`. Se
abre, se edita, se sube.

Eso fue deliberado y sigue pareciendo la decisión correcta para un proyecto de
una persona: no hay build que se rompa, no hay dependencias que envejezcan, y
seis meses después el archivo abre igual. El costo es que no hay componentes en
archivos separados y el archivo se hace largo.

**Firebase Realtime Database** para los datos y **Firebase Auth** para las
cuentas. Tiempo real de fábrica: alguien mueve una tarea y a los demás se les
mueve en la pantalla.

**Dos funciones de Netlify** para lo que no puede vivir en el navegador:

- `slack.js` — recibe `{ channel, text }` y lo reenvía a Slack. Existe porque
  el token del bot **no puede estar en el frontend**: cualquiera que abra el
  inspector lo vería y podría escribir en el Slack del equipo. La función corre
  del lado del servidor, guarda el token en una variable de entorno y hace de
  intermediaria.
- `reports.js` — la misma idea para los reportes.

**Desplegado dos veces**: a Firebase Hosting, con una GitHub Action que subía
solo en cada push a `main`, y a Netlify.

## Cómo murió

Un día dejó de andar. No hubo error visible, no hubo aviso: la app cargaba y
las tareas no aparecían.

La causa fueron las **reglas de la base de datos**. Firebase, cuando creás una
Realtime Database en modo de prueba, te da reglas abiertas **con fecha de
vencimiento a 30 días**. El aviso llega por mail, se pierde entre otros mails,
y el día 31 la base deja de responder a todo el mundo. El código estaba
perfecto; lo que se venció fue un permiso.

Es un final que enseña dos cosas, y las dos se aplicaron en la reescritura:

1. **Los permisos son parte del proyecto, no del panel.** Si están escritos en
   un archivo que vive con el código, se revisan cuando se revisa el código.
2. **Un error de permisos tiene que verse.** Fallar en silencio es lo que
   convirtió un problema de diez minutos en un proyecto abandonado.

## Qué pasó después

En agosto de 2026 se lo revivió, y la conclusión fue que no alcanzaba con
arreglar las reglas: el proyecto quería ser otra cosa. La reescritura completa
—Supabase en vez de Firebase, con un asistente de IA adentro y una segunda
puerta por WhatsApp— vive en el repositorio **`newdoline`**.

De acá sobrevivieron las ideas y el criterio del archivo único; el código se
escribió de nuevo.

## Correrlo

```bash
# hace falta un proyecto de Firebase con Realtime Database y Auth
# y completar la configuración adentro de index.html
python -m http.server 3000    # o cualquier servidor estático
```

Hoy no va a funcionar sin reconectarlo a una base propia: la que usaba está
dada de baja.
