# Horario del personal

App para el horario, ausencias, horas extra, anticipos, consumo y cierre del mes del personal.
Se instala en el computador y en el celular. Los datos se guardan en tu Google Drive, no en este repositorio.

## Archivos

- `index.html`: la app.
- `manifest.webmanifest`, `sw.js` e íconos: permiten instalarla y abrirla sin conexión.
- `apps-script/Codigo.gs`: el script de Google que guarda los datos en tu Drive. Se pega en script.google.com; no se usa desde GitHub.

## Puesta en marcha

1. **Publicar la app:** en el repositorio, Settings > Pages > Source: "Deploy from a branch", rama `main`, carpeta `/ (root)`. La dirección queda como `https://TU-USUARIO.github.io/NOMBRE-DEL-REPO/`.
2. **Script de Google:** en script.google.com crea un proyecto, pega `apps-script/Codigo.gs`, cambia la clave, ejecuta `configurar` y publícalo como Aplicación web (Ejecutar como: Yo; Acceso: Cualquier persona). Copia la URL que termina en `/exec`.
3. **Conectar:** abre la app, pega la URL y la clave en "Conexión".
4. **Cargar los datos:** Respaldo > Cargar respaldo con el archivo descargado del horario anterior, y presiona Guardar.
5. **Instalar:** en Chrome o Edge del computador, ícono de instalar en la barra de direcciones. En Android, menú > Instalar app. En iPhone, desde Safari, Compartir > Agregar a inicio.

## Importante

- Este repositorio es público: aquí solo va el código. Los nombres, RUT, anticipos y consumos quedan en tu Drive.
- No compartas la URL del script junto con la clave.
- El script guarda además una copia diaria en la carpeta "Horario del personal - datos" de tu Drive.
