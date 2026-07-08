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
            SELECT "Id", "Fecha", "MaquinaId", "UsuarioId", "OrdenProduccion", "Cantidad", "Nota"
            FROM "RegistrosDesperdicio"
            WHERE "Fecha"::date = '2026-04-14' AND "MaquinaId" = 6
            ORDER BY "OrdenProduccion", "Cantidad"
        `);
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

main();
