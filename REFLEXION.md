## Práctica 4 · Firestore

### 1. ¿Por qué el id del documento es el UID? ¿Qué tendrías que agregar si usaras ids aleatorios con `addDoc`?

Porque así la regla de negocio "una reseña por persona y por curso" queda garantizada por la estructura: escribir de nuevo sobre `cursos/{cursoId}/resenas/{uid}` actualiza la misma reseña en lugar de crear otra. Además, las reglas pueden comparar el id del documento con `request.auth.uid` (`esDuenio(uid)`) sin leer nada más.

Con ids aleatorios (`addDoc`) habría que:
- **Guardar el UID del autor en un campo** (`autorUid`) y agregarlo a la lista blanca `hasOnly([...])`.
- **En las reglas**, exigir `request.resource.data.autorUid == request.auth.uid` al crear, y `resource.data.autorUid == request.auth.uid` al editar y borrar (más que sea inmutable).
- **Garantizar la unicidad** (una reseña por persona), lo cual con ids aleatorios es difícil de hacer solo con reglas: habría que consultar antes en el cliente (inseguro, se puede saltear) o usar lógica de servidor (Cloud Functions).

### 2. Desnormalización del nombre del autor: ¿qué se gana, qué se pierde, cómo se resuelve el cambio de nombre?

**Se gana:** mostrar la lista de reseñas no requiere una lectura extra por reseña para buscar el nombre. Con `limit(20)` se pasa de hasta 40 lecturas a 20 y se evitan consultas adicionales (menos latencia y menos costo de cuota).

**Se pierde:** consistencia. Si una persona cambia su nombre, sus reseñas viejas conservan el nombre anterior. También se duplica el dato (más almacenamiento, aunque mínimo).

**Cómo resolver el cambio de nombre:**
- *Simple (esta práctica):* aceptar que es una foto del momento, como pasa en una factura.
- *Reescritura al editar:* `guardarResena` ya manda `autor` en cada edición, así que se actualiza cuando la persona edita su reseña.
- *Propagación desde el servidor:* una Cloud Function que se dispare al cambiar el perfil y actualice todas las reseñas de ese UID (usando una consulta de collection group por `autorUid`). Queda para la Práctica 5.

### 3. Diferencia entre `resource.data` y `request.resource.data`. Ejemplo de regla que use ambos.

- `resource.data` es el documento **tal como está hoy** en la base (el estado previo). No existe en un `create`.
- `request.resource.data` es el documento **como quedaría si la escritura se aceptara** (el estado resultante). En un `update` con `merge`, ya incluye los campos que no se tocaron.

Ejemplo, la regla de edición de esta práctica, que usa ambos:

```
allow update: if esDuenio(uid)
              && resenaValida()                                        // valida el resultado
              && request.resource.data.creadaEn == resource.data.creadaEn; // compara resultado vs. actual
```

Con eso la fecha de creación es inmutable: lo que quedaría guardado tiene que ser igual a lo que ya estaba.

### 4. ¿Por qué `creadaEn == request.time` en lugar de confiar en la fecha del cliente?

Porque el reloj del cliente no es confiable: puede estar mal configurado o ser manipulado a propósito (alguien podría inventar una reseña "de 2020" o fechada en el futuro para quedar primero en el orden). `request.time` es el momento en que el servidor procesa la escritura, y `serverTimestamp()` es el valor que el servidor reemplaza por ese instante. Exigir que coincidan hace que **la fecha sea imposible de falsificar**, y como el orden de la lista se basa en `creadaEn`, también protege el orden de las reseñas.

### 5. Limitación de `getAggregateFromServer` y cómo afecta la experiencia de usuario. Alternativas.

**Limitación:** es una consulta de una sola vez; no admite listeners en tiempo real ni funciona offline. Mientras la lista de reseñas se actualiza en vivo, el promedio y la cantidad solo se actualizan cuando se vuelve a pedir.

**Efecto en la UX:** puede haber un desfasaje breve entre la lista (en vivo) y el resumen (`★ 4.5 (12)`). En esta práctica se mitiga volviendo a pedir la agregación cuando cambia `resenas.length`, pero eso no detecta, por ejemplo, una edición de puntaje que no cambia la cantidad, y cada recálculo cuesta lecturas.

**Alternativas:**
- *Mantener el resumen en el documento del curso* (`cursos/{cursoId}.resumen = {cantidad, suma/promedio}`), actualizado desde el servidor con una Cloud Function que reacciona a cada alta, edición o baja de reseña. El cliente escucha ese único documento con `onSnapshot` y obtiene un promedio en tiempo real con 1 lectura por cambio. Es la solución de la Práctica 5 (por eso las reglas bloquean la escritura del documento del curso desde el cliente).
- *Calcular en el cliente* sobre las reseñas descargadas: solo es correcto si se descargan todas, lo cual no escala (cuesta una lectura por reseña).
- *Contadores distribuidos / transacciones desde el cliente*: más complejos y exponen la lógica al cliente.

### 6. Inscripciones con cupo máximo: ¿Firestore o SQL Connect?

**SQL Connect (PostgreSQL).** Razones, con lo visto en las dos prácticas:
- **Integridad e invariantes:** "no más de N inscriptos" es una restricción que debe cumplirse siempre, aunque haya muchas inscripciones simultáneas. En SQL se resuelve en el servidor dentro de una transacción (contar y insertar de forma atómica) y con restricciones/claves foráneas.
- **Dónde corre la lógica:** en SQL Connect el cliente solo ejecuta operaciones con nombre definidas en el servidor, donde se puede validar el cupo. En Firestore el cliente escribe directo y las Security Rules no pueden contar documentos de una colección de forma eficiente ni coordinar escrituras concurrentes, así que el cupo se podría superar sin Cloud Functions.
- **Relaciones:** inscripción une alumno y curso; con JOINs nativos y claves foráneas se consulta y se mantiene consistente sin duplicar datos.
- **Cuándo sí Firestore:** donde importa el tiempo real y la lectura/escritura directa del cliente con datos independientes, como las reseñas en vivo de esta práctica, chats o presencia.
