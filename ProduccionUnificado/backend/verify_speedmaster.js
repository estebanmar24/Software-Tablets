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
              AND "MaquinaId" = 8
        `);
        console.log('Total waste for SpeedMaster 6 (ID 8):', res.rows[0].total);
        
        const countRes = await client.query(`
            SELECT COUNT(*) FROM "RegistrosDesperdicio"
            WHERE "Fecha" >= '2026-04-01' AND "Fecha" <= '2026-04-30 23:59:59'
              AND "MaquinaId" = 8
        `);
        console.log('Record count:', countRes.rows[0].count);
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

main();
