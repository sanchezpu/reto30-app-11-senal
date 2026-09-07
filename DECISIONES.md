# Decisiones

Por qué Señal está construida así. Cada punto salió de un problema concreto, no de una preferencia.

---

## 1. Tres URLs, no una

**El evento de conversión casi nunca está en la portada.** Vive en la página de gracias, en la de
confirmación del pedido, o atado al clic de un botón. Una herramienta que audite solo la portada
produce el peor resultado posible: el falso negativo de «no hay eventos de conversión» en un sitio
que los tiene perfectamente puestos dos páginas más adelante.

Ese falso negativo no es un fallo menor. Es exactamente el diagnóstico que la app existe para dar,
dicho al revés, y quien lo lea puede acabar reinstalando algo que ya funcionaba.

Por eso se piden tres direcciones, con una función distinta cada una:

| Campo | Qué se busca ahí |
|---|---|
| **Portada** | El código base: casi todos los píxeles se inicializan aquí |
| **Producto o servicio** | `ViewContent`, `AddToCart`, `view_item` — el medio del embudo |
| **Gracias o confirmación** | `Purchase`, `Lead`, `purchase` — el cierre, que rara vez está en otro sitio |

Solo la primera es obligatoria. Las otras dos son opcionales, pero la interfaz explica por qué
conviene rellenarlas en vez de limitarse a marcarlas como opcionales y callarse.

## 2. El tercer campo es flexible a propósito

**Una página de gracias de verdad exige completar una compra.** No se puede pedir a alguien que
haga un pedido real para auditar su web, y en un sitio ajeno no existe forma de llegar a esa URL.

Así que el tercer campo se llama «página de gracias o confirmación» pero **acepta cualquier URL
profunda**: un carrito, un checkout, una página de contacto. En las dos auditorías reales de este
repositorio se usó el carrito, que es lo más cerca del cierre a lo que se puede llegar desde fuera.

Y de ahí sale la otra mitad de la decisión: **el informe declara siempre qué página se leyó de
verdad**, con su URL final después de redirecciones, en el bloque «Qué se pudo comprobar y qué no».

Esto no es cosmético. La etiqueta del campo dice «gracias o confirmación», pero si el usuario metió
ahí el carrito, un informe que hablara de «la página de gracias» estaría describiendo algo que
nadie leyó. Una etiqueta de procedencia equivocada desmiente el informe entero, aunque los datos
sean correctos.

Por el mismo motivo, **la etiqueta va atada a la URL y no a su posición en la lista**: quien
rellene la portada y la de gracias saltándose el campo del medio no verá su página de gracias
descrita como «producto».

## 3. Determinista, sin IA

La detección es un problema de **patrones exactos**: `fbq('init', '123')`, `ttq.load('ABC')`,
`gtag('config', 'G-XXXXXXX')`, `_linkedin_partner_id`. No hay ambigüedad que resolver ni matices
que interpretar. Un modelo de lenguaje no lo haría mejor, y sí aportaría tres cosas malas:

- **Coste y latencia** en cada análisis, para un trabajo que un regex resuelve en microsegundos.
- **Una clave que guardar** y un servicio del que depender.
- **La posibilidad de inventarse un identificador.** En una app cuya promesa central es «esto es lo
  que hay de verdad en tu web», que la herramienta alucine un número de píxel la destruiría.

Las recomendaciones tampoco necesitan un modelo: son cinco plantillas, una por tipo de hallazgo,
escritas una sola vez con el impacto explicado en dinero y no en jerga. Se leen mejor que lo que
redactaría un modelo en cada llamada, y son idénticas entre informes, que para un profesional que
enseña varios a un cliente es una ventaja, no una limitación.

**El listón para meter un modelo era «que aporte».** No aportaba.

## 4. El contenedor de Tag Manager: de complemento a función central

Esta es la decisión que más cambió la app, y no salió de pensarla sino de mirar.

El planteamiento inicial trataba la descarga del contenedor público de GTM
(`googletagmanager.com/gtm.js?id=GTM-XXXX`) como un **complemento** para recuperar parte de lo que
el HTML no muestra. Antes de construir, media hora de reconocimiento con `curl` sobre ocho tiendas
colombianas dio la vuelta a eso:

| Sitio | Píxeles en el HTML | Contenedor |
|---|---|---|
| tennis.com.co | ninguno | `GTM-TPD3L4` |
| totto.com | ninguno | `GTM-PKJD3R9` |
| arturocalle.com | ninguno | `GTM-M32DQMK` |
| alkosto.com | ninguno | `GTM-PSR2JFG` |
| exito.com | ninguno | `GTM-PNXPZ7W` |
| panamericana.com.co | ninguno | `GTM-KSBS7CF` |
| velez.com.co | ninguno | `GTM-TD68CW` |
| studiof.com.co | ninguno | `GTM-NPX7CDB` |

**Ninguna de las ocho pega un solo píxel en el HTML.** Todas cargan Tag Manager en la portada y
meten absolutamente todo lo demás dentro del contenedor.

Sin descargar `gtm.js`, la herramienta habría contestado «no encontramos ningún píxel» en las ocho
y habría sido un producto muerto. Con él, en una sola tienda se ven el píxel de Meta, la propiedad
de GA4, la etiqueta de Ads, el embudo completo de TikTok y el reparto de las 693 etiquetas del
contenedor.

Cuesta **una petición** por análisis y el archivo es público.

Leer el contenedor obligó además a dos precisiones que no eran obvias:

- **Se trocea por etiqueta, no se lee de una pasada.** El mismo nombre de campo significa cosas
  distintas en plantillas distintas, así que hay que preguntar de quién es cada etiqueta antes de
  leer lo que declara.
- **La plataforma se deduce del nombre de la función de la etiqueta, no del identificador.** En un
  contenedor real el ID de GA4 casi nunca es un literal: viene de una variable. Deducir la
  plataforma del ID perdía todos los eventos de GA4 de cualquier web bien montada.

## 5. Qué puede y qué no puede comprobar

### Sí puede

- Qué identificadores de medición están instalados y **en qué páginas**.
- Si el mismo identificador se **inicia desde dos sitios a la vez** (a mano y por GTM, o desde dos
  etiquetas distintas del mismo contenedor). Es el hallazgo estrella, y es el que más cuidado
  necesita: un falso positivo aquí le dice a alguien que sus ventas están infladas cuando no lo
  están.
- Qué eventos se declaran, en el HTML y dentro del contenedor, y si son estándar o inventados.
- Cuántos peldaños del embudo cubre cada plataforma, y el desnivel entre ellas.
- Restos de Universal Analytics, que dejó de recoger datos y sigue cargando en cada visita.

### No puede

- **Lo que solo existe al hacer clic.** Un evento atado a un botón o al envío de un formulario no
  está en el HTML: nace en ese momento, en el navegador. No abrimos un navegador —el servidor que
  sirve esto también sostiene producción de terceros y no hay RAM para Chromium— así que esos
  eventos no aparecen, ni cuando están perfectamente puestos.
- **Saber si una etiqueta de GTM llega a dispararse.** Vemos que existe; no vemos su disparador, ni
  si está pausada.
- **Leer el nombre de un evento que viene de una variable.** Se cuentan y se declaran aparte: en un
  contenedor eran 11 etiquetas así y en otro 23. No suman a favor ni restan en contra.
- **Ver lo que carga una aplicación desde dentro.** Si un tema o una plataforma inyecta el píxel
  por su cuenta después de cargar la página, no lo servía el servidor y no lo vemos.
- **Confirmar que un evento llega de verdad a la plataforma.** Que esté declarado no significa que
  se dispare, ni que llegue, ni que la deduplicación esté bien.

### Cómo se traduce eso en la interfaz

Tres reglas, y las tres son la misma:

1. **El informe nunca dice «no hay evento X».** Dice «no lo encontramos en estas URLs».
2. **Los eventos que salen del contenedor no se atribuyen a ninguna página.** Decir «purchase salta
   en la portada» porque el contenedor está en la portada sería inventarse el dato exacto que la
   app promete no inventar.
3. **La nota se renormaliza sobre lo que se pudo medir**, y la pantalla dice sobre cuántos puntos
   va. Enseñar «31 sobre 100» cuando 20 de esos puntos no se intentaron es mentir con la aritmética
   a favor; se enseña «31 sobre 80 puntos medibles» y se explica dónde están los otros 20.

---

## Apéndice: dos correcciones que valen como decisión

**Contar cargas, no coincidencias.** El primer detector marcaba duplicado cualquier píxel que
apareciera dos veces, y en una web normal eso pasa siempre: el `fbq('init')` y su `<noscript>` son
una sola instalación, y el campo `pixelId` de una plantilla de GTM se repite en todas las etiquetas
de esa plataforma, una por evento. Se cuentan **iniciadores**. El reverso también importa: colapsar
el contenedor entero a una carga escondía el duplicado que de verdad se ve hoy, que es el mismo
píxel arrancado desde dos etiquetas de HTML personalizado distintas.

**Verificar de qué campo sale cada valor.** En la plantilla oficial de Meta, `vtp_eventName` no es
el nombre del evento: es el selector del tipo, y vale `"standard"` o `"custom"`. El nombre real
vive en `vtp_standardEventName` o `vtp_customEventName`. Leyendo el campo por su nombre, un informe
declaraba dos eventos personalizados llamados «standard» y «custom» —que no existen— y se perdía
los siete reales. El hallazgo estaba perfectamente formado, con su título, su explicación y su
recuento, y era falso. **Al leer configuraciones de terceros, el nombre de la clave no dice qué
significa el valor.**
