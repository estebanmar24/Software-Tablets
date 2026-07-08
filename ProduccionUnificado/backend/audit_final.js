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
            SELECT SUM("Cantidad") as total, COUNT(*) as count
            FROM "RegistrosDesperdicio"
            WHERE "Fecha" >= '2026-04-01' AND "Fecha" <= '2026-04-30 23:59:59'
        `);
        console.log('Total quantity in DB:', res.rows[0].total);
        console.log('Total records in DB:', res.rows[0].count);
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

main();
