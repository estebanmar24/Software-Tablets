const { Client } = require('pg');
const client = new Client({
    host: 'localhost',
    port: 5432,
    database: 'TiemposProcesos',
    user: 'postgres',
    password: '@L3ph2026',
});

async function run() {
    try {
        await client.connect();
        const res = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'");
        console.log('Tables found:');
        console.log(res.rows.map(r => r.table_name).join(', '));
        
        // Check Usuarios table count
        const userCount = await client.query('SELECT COUNT(*) FROM "Usuarios"');
        console.log('Usuarios count:', userCount.rows[0].count);
        
    } catch (err) {
        console.error('Database check failed:', err.message);
    } finally {
        await client.end();
    }
}

run();
