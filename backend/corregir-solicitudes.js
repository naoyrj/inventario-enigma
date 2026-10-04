const fs = require("fs");
const path = require("path");

const archivo = path.join(
  __dirname,
  "controllers",
  "solicitudesController.js"
);

const respaldo = path.join(
  __dirname,
  "controllers",
  "solicitudesController.backup.js"
);

if (!fs.existsSync(archivo)) {
  console.error(
    "No se encontró controllers/solicitudesController.js"
  );
  process.exit(1);
}

let codigo = fs.readFileSync(
  archivo,
  "utf8"
);

if (!fs.existsSync(respaldo)) {
  fs.copyFileSync(
    archivo,
    respaldo
  );

  console.log(
    "Respaldo creado:",
    respaldo
  );
} else {
  console.log(
    "El respaldo ya existe."
  );
}

let cambios = 0;

// =========================================================
// CORRECCIÓN 1
// FROM envios + destino_ubicacion_id directo
// =========================================================

const regex1 =
  /FROM\s+envios\s+WHERE\s+solicitud_id\s*=\s*\$1\s+AND\s+destino_ubicacion_id\s*=\s*\$2\s+AND\s+estado\s*=\s*'recibido'/g;

if (regex1.test(codigo)) {
  codigo = codigo.replace(
    regex1,
    `FROM envios e

            INNER JOIN solicitudes s
              ON e.solicitud_id =
                 s.id

            WHERE e.solicitud_id = $1
              AND s.destino_ubicacion_id =
                  $2
              AND e.estado = 'recibido'`
  );

  cambios++;

  console.log(
    "Consulta 1 corregida."
  );
} else {
  console.log(
    "Consulta 1 no encontrada o ya corregida."
  );
}

// =========================================================
// CORRECCIÓN 2 Y 3
// JOIN envios seguido de e.destino_ubicacion_id
// =========================================================

const regexBloque =
  /INNER\s+JOIN\s+envios\s+e\s+ON\s+el\.envio_id\s*=\s*e\.id([\s\S]*?)WHERE\s+e\.solicitud_id\s*=\s*\$1([\s\S]*?)AND\s+e\.destino_ubicacion_id\s*=\s*\$2/g;

codigo = codigo.replace(
  regexBloque,
  (match) => {
    cambios++;

    let nuevo = match;

    if (
      !nuevo.includes(
        "INNER JOIN solicitudes s"
      )
    ) {
      nuevo = nuevo.replace(
        /INNER\s+JOIN\s+envios\s+e\s+ON\s+el\.envio_id\s*=\s*e\.id/,
        `INNER JOIN envios e
                ON el.envio_id =
                   e.id

              INNER JOIN solicitudes s
                ON e.solicitud_id =
                   s.id`
      );
    }

    nuevo = nuevo.replace(
      /AND\s+e\.destino_ubicacion_id\s*=\s*\$2/,
      `AND s.destino_ubicacion_id =
                    $2`
    );

    console.log(
      `Consulta ${cambios} corregida.`
    );

    return nuevo;
  }
);

// =========================================================
// VALIDACIÓN FINAL
// =========================================================

const referenciasMalas =
  codigo.match(
    /e\.destino_ubicacion_id/g
  ) || [];

const consultaDirectaMala =
  /FROM\s+envios\s+WHERE[\s\S]{0,200}destino_ubicacion_id/.test(
    codigo
  );

if (
  referenciasMalas.length > 0 ||
  consultaDirectaMala
) {
  console.error(
    "\nERROR: todavía quedan referencias inválidas."
  );

  console.error(
    "e.destino_ubicacion_id restantes:",
    referenciasMalas.length
  );

  console.error(
    "Consulta directa incorrecta:",
    consultaDirectaMala
  );

  console.error(
    "\nNO se guardaron cambios."
  );

  process.exit(1);
}

if (cambios === 0) {
  console.log(
    "\nNo se aplicaron cambios."
  );

  console.log(
    "El archivo puede estar ya corregido."
  );

  process.exit(0);
}

fs.writeFileSync(
  archivo,
  codigo,
  "utf8"
);

console.log(
  "\n=============================="
);

console.log(
  `Cambios aplicados: ${cambios}`
);

console.log(
  "solicitudesController.js corregido."
);

console.log(
  "=============================="
);