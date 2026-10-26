/**
 * Horario del personal: guarda los datos de la app en tu Google Drive.
 *
 * Cómo usarlo (una sola vez):
 * 1. Cambia la clave de abajo por una tuya (letras y números, sin espacios).
 * 2. Arriba, elige la función "configurar" y presiona Ejecutar. Acepta los permisos.
 * 3. Implementar > Nueva implementación > Tipo: Aplicación web.
 *    Ejecutar como: Yo. Quién tiene acceso: Cualquier persona.
 * 4. Copia la URL que termina en /exec y pégala en la app, en "Conexión", junto con la clave.
 *
 * Para actualizar el script (sin cambiar la URL ni la clave):
 * pega el código nuevo, guarda, y haz Implementar > Gestionar implementaciones > editar (lápiz)
 * > Versión: Nueva versión > Implementar. No ejecutes "configurar" otra vez: la clave ya está guardada.
 */
const CLAVE_INICIAL = 'CAMBIA-ESTA-CLAVE';

const ARCHIVO = 'horario-datos.json';
const CARPETA = 'Horario del personal - datos';

function configurar() {
  if (CLAVE_INICIAL === 'CAMBIA-ESTA-CLAVE') throw new Error('Primero cambia CLAVE_INICIAL por una clave tuya.');
  const props = PropertiesService.getScriptProperties();
  props.setProperty('CLAVE', CLAVE_INICIAL);
  carpeta_();
  Logger.log('Listo. Clave guardada y carpeta creada en tu Drive: ' + CARPETA);
}

/* Lectura antigua, con la clave en la dirección. La app actual lee por POST; esto queda para equipos con una versión anterior. */
function doGet(e) {
  if (!claveOk_(e.parameter.key)) return salida_({ ok: false, error: 'clave' });
  return leer_();
}

/* La clave viaja dentro del mensaje. accion "leer" devuelve los datos; si no, guarda el estado enviado. */
function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); } catch (x) { return salida_({ ok: false, error: 'formato' }); }
  if (!claveOk_(body.key)) return salida_({ ok: false, error: 'clave' });
  if (body.accion === 'leer') return leer_();
  if (!body.estado || !Array.isArray(body.estado.turnos)) return salida_({ ok: false, error: 'datos incompletos' });
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const f = archivo_();
    const actual = f ? JSON.parse(f.getBlob().getDataAsString()) : null;
    if (actual && actual.guardado && !body.force && body.base !== actual.guardado) {
      return salida_({ ok: false, error: 'conflicto', guardado: actual.guardado });
    }
    const texto = JSON.stringify(body.estado);
    if (f) { respaldoDiario_(actual); f.setContent(texto); }
    else carpeta_().createFile(ARCHIVO, texto, 'application/json');
    return salida_({ ok: true, guardado: body.estado.guardado });
  } finally {
    lock.releaseLock();
  }
}

function leer_() {
  const f = archivo_();
  return salida_({ ok: true, estado: f ? JSON.parse(f.getBlob().getDataAsString()) : null });
}

/* Guarda una copia por día (la primera versión de cada día) por si algo sale mal. */
function respaldoDiario_(estado) {
  if (!estado) return;
  const dia = Utilities.formatDate(new Date(), 'America/Santiago', 'yyyy-MM-dd');
  const nombre = 'respaldo-' + dia + '.json';
  const c = carpeta_();
  if (!c.getFilesByName(nombre).hasNext()) c.createFile(nombre, JSON.stringify(estado), 'application/json');
}

function claveOk_(k) {
  const clave = PropertiesService.getScriptProperties().getProperty('CLAVE');
  return !!clave && k === clave;
}

function carpeta_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('CARPETA_ID');
  if (id) { try { return DriveApp.getFolderById(id); } catch (x) {} }
  const c = DriveApp.createFolder(CARPETA);
  props.setProperty('CARPETA_ID', c.getId());
  return c;
}

function archivo_() {
  const it = carpeta_().getFilesByName(ARCHIVO);
  return it.hasNext() ? it.next() : null;
}

function salida_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
