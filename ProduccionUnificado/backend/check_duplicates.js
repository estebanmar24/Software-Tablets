const { Client } = require('pg');

async function main() {
    const client = new Client({
        host: 'localhost',
        port: 5432,
        database: 'TiemposProcesos',
        user: 'postgres',
        password: '@L3ph2026',
    });

    try {
        await client.connect();
        const res = await client.query(`
            SELECT "Fecha", "MaquinaId", "UsuarioId", "OrdenProduccion", "Cantidad", COUNT(*)
            FROM "RegistrosDesperdicio"
            WHERE "Fecha" >= '2026-04-01' AND "Fecha" <= '2026-04-30'
            GROUP BY "Fecha", "MaquinaId", "UsuarioId", "OrdenProduccion", "Cantidad"
            HAVING COUNT(*) > 1
            LIMIT 20;
        `);
        console.log('Duplicate groups found:', res.rowCount);
        console.log(JSON.stringify(res.rows, null, 2));

        const totalRes = await client.query('SELECT COUNT(*) FROM "RegistrosDesperdicio" WHERE "Fecha" >= \'2026-04-01\' AND "Fecha" <= \'2026-04-30\'');
        console.log('Total records in April:', totalRes.rows[0].count);
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

main();
