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
            SELECT SUM("Cantidad") as total
            FROM "RegistrosDesperdicio"
            WHERE "Fecha" >= '2026-04-01' AND "Fecha" <= '2026-04-30 23:59:59'
              AND "MaquinaId" = 9
        `);
        console.log('Total waste for SpeedMaster 7 (ID 9):', res.rows[0].total);
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

main();
