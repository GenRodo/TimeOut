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
 *
 * Reservas en Google Calendar: la primera vez, elige "autorizarCalendario" arriba, presiona Ejecutar y acepta
 * el permiso del calendario. Después publica la versión nueva como se explica arriba.
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
    /* Las reservas pasan solas a Google Calendar. Si el calendario falla, lo guardado en Drive igual queda. */
    let calendario = null;
    const antes = JSON.stringify((actual && actual.reservas) || []), ahora = JSON.stringify(body.estado.reservas || []);
    if (Array.isArray(body.estado.reservas) && antes !== ahora) {
      try { calendario = sincronizarReservas_(body.estado.reservas); } catch (x) { calendario = { error: String(x && x.message || x) }; }
    }
    return salida_({ ok: true, guardado: body.estado.guardado, calendario: calendario });
  } finally {
    lock.releaseLock();
  }
}

/* ---------- Reservas en Google Calendar ----------
   Cada reserva futura queda como evento en tu calendario principal, con aviso antes, para que el celular avise
   aunque la app esté cerrada. Se reconoce por la marca [TimeOut:id] en la descripción: si la reserva cambia se
   actualiza, y si se cancela o se borra en la app, el evento se borra. Las reservas pasadas no se tocan. */
const AVISOS_MIN = [60, 15];
const DURACION_HORAS = 2;
const ZONA = 'America/Santiago';

/* Ejecútala una vez desde el editor para darle al script el permiso de tu calendario. */
function autorizarCalendario() {
  Logger.log('Listo. Las reservas se guardarán en: ' + CalendarApp.getDefaultCalendar().getName());
}

function sincronizarReservas_(reservas) {
  const cal = CalendarApp.getDefaultCalendar();
  const hoy = Utilities.parseDate(Utilities.formatDate(new Date(), ZONA, 'yyyy-MM-dd') + ' 00:00', ZONA, 'yyyy-MM-dd HH:mm');
  const hasta = new Date(hoy.getTime() + 400 * 86400000);
  const eventos = {};
  cal.getEvents(hoy, hasta, { search: 'TimeOut' }).forEach(ev => {
    const m = /\[TimeOut:([^\]]+)\]/.exec(ev.getDescription() || '');
    if (m) eventos[m[1]] = ev;
  });
  const r = { creados: 0, actualizados: 0, borrados: 0 }, vistas = {};
  reservas.forEach(x => {
    if (!x || !x.id || !x.fecha || !x.hora) return;
    const ini = Utilities.parseDate(x.fecha + ' ' + x.hora, ZONA, 'yyyy-MM-dd HH:mm');
    if (ini < hoy) return;
    vistas[x.id] = 1;
    const ev = eventos[x.id];
    if (x.estado === 'cancelada') { if (ev) { ev.deleteEvent(); r.borrados++; } return; }
    const fin = new Date(ini.getTime() + DURACION_HORAS * 3600000);
    const titulo = 'Reserva: ' + x.nombre + (x.personas ? ' (' + x.personas + ' pers.)' : '');
    const desc = [x.personas ? x.personas + ' personas' : '', x.motivo ? 'Motivo: ' + x.motivo : '', x.pedido ? 'Qué van a comer: ' + x.pedido : '',
      x.tel ? 'Teléfono: ' + x.tel : '', x.notas || '', '[TimeOut:' + x.id + ']'].filter(String).join('\n');
    if (!ev) {
      if (ini < new Date()) return;   // ya pasó la hora: no tiene sentido avisar
      const nuevo = cal.createEvent(titulo, ini, fin, { description: desc });
      nuevo.removeAllReminders();
      AVISOS_MIN.forEach(m => nuevo.addPopupReminder(m));
      r.creados++;
    } else if (ev.getTitle() !== titulo || ev.getStartTime().getTime() !== ini.getTime() || ev.getEndTime().getTime() !== fin.getTime() || ev.getDescription() !== desc) {
      ev.setTitle(titulo); ev.setTime(ini, fin); ev.setDescription(desc);
      r.actualizados++;
    }
  });
  Object.keys(eventos).forEach(id => { if (!vistas[id]) { eventos[id].deleteEvent(); r.borrados++; } });
  return r;
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
