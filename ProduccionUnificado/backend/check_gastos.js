const { Client } = require('pg');

(async () => {
    const c = new Client({
        host: 'localhost',
        port: 5432,
        database: 'TiemposProcesos',
        user: 'postgres',
        password: '@L3ph2026',
    });
    await c.connect();
    const junio = await c.query(
        'SELECT COUNT(*)::int AS n FROM "Planeacion_Gastos" WHERE "Anio" = 2026 AND "Mes" = 6'
    );
    const bad = await c.query(
        `SELECT COUNT(*)::int AS n FROM "Planeacion_Gastos"
         WHERE "Anio" <= 0 OR "Mes" < 1 OR "Mes" > 12`
    );
    const recent = await c.query(
        `SELECT "Id", "Anio", "Mes", "Precio", "Fecha"::text
         FROM "Planeacion_Gastos" ORDER BY "Id" DESC LIMIT 15`
    );
    console.log('Junio 2026:', junio.rows[0].n);
    console.log('Sin Anio/Mes valido:', bad.rows[0].n);
    console.table(recent.rows);
    await c.end();
})().catch((e) => {
    console.error(e);
    process.exit(1);
});
