const fs = require("fs");
const path = require("path");

const archivo = path.join(
  __dirname,
  "controllers",
  "solicitudesController.js"
);

if (!fs.existsSync(archivo)) {
  console.error(
    "No se encontró controllers/solicitudesController.js"
  );
  process.exit(1);
}

let contenido = fs.readFileSync(
  archivo,
  "utf8"
);

const respaldo = path.join(
  __dirname,
  "controllers",
  "solicitudesController.antes-registro-inventario.js"
);

if (!fs.existsSync(respaldo)) {
  fs.writeFileSync(
    respaldo,
    contenido,
    "utf8"
  );

  console.log(
    "Respaldo creado."
  );
} else {
  console.log(
    "El respaldo ya existe."
  );
}

let cambios = 0;

// ============================================================
// CONSULTA 1
// Verificar que exista envío recibido
// ============================================================

const consulta1Vieja = /FROM\s+envios(?:\s+e)?\s+WHERE\s+(?:e\.)?solicitud_id\s*=\s*\$1\s+AND\s+(?:e\.)?destino_ubicacion_id\s*=\s*\$2\s+AND\s+(?:e\.)?estado\s*=\s*'recibido'/gi;

const consulta1Nueva = `FROM envios e

            INNER JOIN solicitudes s
              ON e.solicitud_id =
                 s.id

            WHERE e.solicitud_id = $1

              AND s.destino_ubicacion_id =
                  $2

              AND e.estado = 'recibido'`;

const antes1 = contenido;

contenido = contenido.replace(
  consulta1Vieja,
  consulta1Nueva
);

if (contenido !== antes1) {
  cambios += 1;

  console.log(
    "Consulta 1 corregida."
  );
} else {
  console.log(
    "Consulta 1 ya estaba corregida o no se encontró."
  );
}

// ============================================================
// CONSULTAS 2 Y 3
// envio_lineas + envios
// ============================================================

const destinoEnvioRegex =
  /INNER\s+JOIN\s+envios\s+e\s+ON\s+el\.envio_id\s*=\s*e\.id([\s\S]{0,500}?)WHERE\s+e\.solicitud_id\s*=\s*\$1([\s\S]{0,300}?)AND\s+e\.destino_ubicacion_id\s*=\s*\$2/gi;

contenido = contenido.replace(
  destinoEnvioRegex,
  (
    coincidencia,
    entreJoinYWhere,
    entreWhereYDestino
  ) => {
    cambios += 1;

    return `INNER JOIN envios e
                ON el.envio_id =
                   e.id

              INNER JOIN solicitudes s
                ON e.solicitud_id =
                   s.id${entreJoinYWhere}

              WHERE e.solicitud_id =
                    $1${entreWhereYDestino}

                AND s.destino_ubicacion_id =
                    $2`;
  }
);

// ============================================================
// VERIFICACIÓN
// ============================================================

const referenciasInvalidas =
  contenido.match(
    /\be\.destino_ubicacion_id\b/g
  ) || [];

const referenciaSinAliasInvalida =
  contenido.match(
    /\bAND\s+destino_ubicacion_id\s*=\s*\$2/g
  ) || [];

if (
  referenciasInvalidas.length > 0 ||
  referenciaSinAliasInvalida.length > 0
) {
  console.error(
    "\nTodavía quedaron referencias inválidas:"
  );

  console.error(
    "e.destino_ubicacion_id:",
    referenciasInvalidas.length
  );

  console.error(
    "destino_ubicacion_id sin JOIN:",
    referenciaSinAliasInvalida.length
  );

  console.error(
    "\nNO se guardaron cambios."
  );

  process.exit(1);
}

fs.writeFileSync(
  archivo,
  contenido,
  "utf8"
);

console.log(
  "\n======================================"
);

console.log(
  `Cambios realizados: ${cambios}`
);

console.log(
  "solicitudesController.js verificado."
);

console.log(
  "No quedan referencias a e.destino_ubicacion_id."
);

console.log(
  "======================================"
);