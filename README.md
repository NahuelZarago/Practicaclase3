# Práctica · CI/CD con Firebase Hosting y hardening de headers HTTP


---

## Arquitectura

```
  dev ──push──▶ rama feature ──PR──▶ GitHub Actions ──deploy──▶ Preview channel (URL temporal)
                                         │
                       merge a main ─────┘──deploy──▶ Canal live (producción)
                                                        │
                                          firebase.json │ headers de seguridad + caché
                                                        ▼
                                                Firebase Hosting (CDN global)
```

| Pieza | Rol |
|---|---|
| `next.config.ts` | `output: "export"` → `next build` genera HTML/JS/CSS estáticos en `out/` |
| `firebase.json` | Qué carpeta se publica, URLs limpias y **headers HTTP** (lo completás vos) |
| `.github/workflows/*.yml` | Pipelines de preview (PR) y producción (merge a `main`) — **con TODOs** |
| `scripts/check-headers.mjs` | Verifica los headers de seguridad y caché de un despliegue |
| Footer de la app | Muestra commit, rama y fecha de build → sirve para saber qué versión está viva |

---

## Pre-clase (hacelo ANTES de la clase, ~20 min)

1. **Node.js 20 o superior** y **Git** instalados.
2. Creá un proyecto en <https://console.firebase.google.com> (plan Spark, sin Analytics).
   Anotá el **Project ID** (ej. `cursos-ana-7f3a2`).
3. Creá tu repo en GitHub a partir de este (botón *Use this template*, o descargá el zip
   y subilo a un repo **tuyo**; no trabajes sobre un fork, ver *Problemas comunes*).
4. Cloná tu repo e instalá dependencias:
   ```bash
   npm install
   npx firebase login
   ```
5. Reemplazá `REEMPLAZAR-POR-TU-PROJECT-ID` en `.firebaserc`.
6. Probá en local:
   ```bash
   npm run build
   npm run serve        # emulador de Hosting en http://localhost:5000
   ```
7. Conectá GitHub con Firebase (crea la service account y el secreto en tu repo):
   ```bash
   npx firebase init hosting:github
   ```
   - Elegí tu repo `usuario/nombre-repo`.
   - Si pregunta si querés sobrescribir archivos de workflow existentes, respondé **No**:
     los workflows ya vienen en este repo. Si igual los reemplaza, restauralos con
     `git checkout -- .github/workflows`.
   - Al terminar, verificá en GitHub → *Settings → Secrets and variables → Actions* que
     exista un secreto llamado `FIREBASE_SERVICE_ACCOUNT_...`. **Anotá ese nombre.**
8. Primer deploy manual para confirmar que todo anda:
   ```bash
   npx firebase deploy --only hosting
   ```
   Deberías ver la app en `https://<PROJECT_ID>.web.app`.

---

## Durante la clase

### Parte A — Pipeline (los TODO están en `.github/workflows/`)

| TODO | Qué hacer |
|---|---|
| A1 | Triggers: `pull_request` para preview, `push` a `main` para producción |
| A2 | Inyectar SHA, rama y fecha del build como variables `NEXT_PUBLIC_BUILD_*` |
| A3 | Nombre del secreto, `projectId`, `expires` del preview y `channelId` de producción |
| A4 *(opcional)* | `concurrency` distinto para preview y producción |
| A5 *(opcional)* | GitHub Environment `production` |

Flujo de prueba:

```bash
git checkout -b feat/mi-cambio
# cambiá algún texto visible (p. ej. el título en app/page.tsx)
git commit -am "feat: cambio visible"
git push -u origin feat/mi-cambio
# abrí el PR en GitHub → esperá el comentario del bot con la URL del preview
```

Rollback: Firebase Console → Hosting → *Release history* → ⋮ → **Rollback**.
Promover un preview a producción sin rebuild:

```bash
npx firebase hosting:clone <PROJECT_ID>:<CANAL_PREVIEW> <PROJECT_ID>:live
```

### Parte B — Headers de seguridad y caché (en `firebase.json`)

1. Medí el estado inicial:
   ```bash
   node scripts/check-headers.mjs https://<PROJECT_ID>.web.app
   ```
   y en <https://securityheaders.com>.
2. Agregá los headers en `hosting.headers` de `firebase.json`.
3. Probá **en local** antes de pushear:
   ```bash
   npm run build && npm run serve
   node scripts/check-headers.mjs http://localhost:5000
   ```
   Abrí <http://localhost:5000/cursos> con DevTools → *Console*: si el filtro dejó de
   funcionar, la CSP está bloqueando algo. Leé el error: te dice qué y por qué.
4. Cuando pase en local, hacelo por PR: el preview te deja validarlo antes de producción.

Formato de un header en `firebase.json`:

```json
"headers": [
  {
    "source": "**",
    "headers": [
      { "key": "X-Content-Type-Options", "value": "nosniff" }
    ]
  }
]
```

> Si dos reglas que matchean la misma URL definen el mismo header, **gana la última**
> (verificado con el emulador). Usalo para la estrategia de caché.

---

## Comandos útiles

| Comando | Para qué |
|---|---|
| `npm run dev` | Desarrollo local con hot reload (no aplica headers de `firebase.json`) |
| `npm run build` | Export estático a `out/` |
| `npm run serve` | Emulador de Hosting: sirve `out/` **con** los headers de `firebase.json` |
| `npm run typecheck` | Chequeo de tipos (también corre en el pipeline) |
| `npx firebase hosting:channel:list` | Lista canales de preview y sus vencimientos |
| `npx firebase hosting:channel:delete <canal>` | Borra un preview |

## Problemas comunes

- **El workflow no corre:** el trigger sigue en `workflow_dispatch` (TODO A1).
- **`Input required and not supplied: firebaseServiceAccount`:** el nombre del secreto no
  coincide, o el PR viene de un **fork** (GitHub no expone secretos a PRs de forks).
- **`/cursos` da 404 en el emulador o en producción:** revisá que `cleanUrls` siga en
  `true` (el export genera `cursos.html`, no `cursos/index.html`).
- **La app se ve pero el filtro no responde:** CSP bloqueando scripts. Consola de DevTools.
- **La imagen de portada no carga:** CSP bloqueando `img-src`.
- **Cambié `firebase.json` y no veo los headers:** ¿reconstruiste y reiniciaste el emulador?
  ¿Estás mirando una respuesta cacheada? Probá con `curl -I` o en una ventana privada.

---

# Práctica 4 · Cloud Firestore (reseñas en tiempo real)

Se agregó sobre este repo: login con email/contraseña (`lib/firebase.ts`, `lib/auth.ts`,
`AuthPanel.tsx`), reseñas por curso (`lib/resenas.ts`, `ResenasCurso.tsx`, botón *Ver reseñas*
en cada tarjeta de `/cursos`), reglas (`firestore.rules`), índice (`firestore.indexes.json`),
tests de reglas (`tests/reglas.test.mjs`) y la CSP con `https://firestore.googleapis.com`.

## Requisitos
Node.js 24.12+ (por `@firebase/rules-unit-testing@6`) y Java 21+ (emulador de Firestore).

## Producción
1. Firebase Console → Firestore Database → crear base (Standard, modo producción) y
   Authentication → habilitar Email/contraseña.
2. Registrá una app web y copiá su config a `.env.local` (ver `.env.example`).
3. Reemplazá `REEMPLAZAR-POR-TU-PROJECT-ID` en `.firebaserc`.
4. `npx firebase deploy --only firestore:rules,firestore:indexes`
5. **CI/CD:** el build estático "hornea" las `NEXT_PUBLIC_FIREBASE_*`. Agregalas en GitHub
   (Settings → Secrets and variables → Actions → Variables) y pasalas en el paso *Build* de
   ambos workflows, por ejemplo `NEXT_PUBLIC_FIREBASE_API_KEY: ${{ vars.NEXT_PUBLIC_FIREBASE_API_KEY }}`.
   Sin eso, el sitio desplegado no puede conectarse a Firebase.
