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

    const tables = [
        ['Planeacion_Gastos', 'Fecha'],
        ['Produccion_Gastos', 'Fecha'],
        ['Talleres_Gastos', 'Fecha'],
        ['Diseno_Gastos', 'Fecha'],
        ['Mantenimiento_Gastos', 'Fecha'],
        ['GH_GastosMensuales', 'FechaCompra'],
        ['SST_GastosMensuales', 'FechaCompra'],
        ['Contabilidad_Gastos', 'Fecha'],
    ];

    for (const [table, col] of tables) {
        const sql = `
UPDATE "${table}"
SET "Anio" = EXTRACT(YEAR FROM "${col}")::int,
    "Mes" = EXTRACT(MONTH FROM "${col}")::int
WHERE "Mes" IS DISTINCT FROM EXTRACT(MONTH FROM "${col}")::int
   OR "Anio" IS DISTINCT FROM EXTRACT(YEAR FROM "${col}")::int
   OR "Anio" <= 0 OR "Mes" < 1 OR "Mes" > 12`;
        const r = await c.query(sql);
        if (r.rowCount > 0) console.log(`${table}: ${r.rowCount} filas corregidas`);
    }

    const check = await c.query(
        'SELECT COUNT(*)::int AS n FROM "Planeacion_Gastos" WHERE "Anio" = 2026 AND "Mes" = 6'
    );
    console.log('Planeacion junio 2026 despues del fix:', check.rows[0].n);
    await c.end();
})().catch((e) => {
    console.error(e);
    process.exit(1);
});
