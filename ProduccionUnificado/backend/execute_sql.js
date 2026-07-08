const { Client } = require('pg');
const fs = require('fs');

async function main() {
    const client = new Client({
        host: 'localhost',
        port: 5432,
        database: 'TiemposProcesos',
        user: 'postgres',
        password: '@L3ph2026',
    });

    const sqlFile = process.argv[2] || 'recovery_april_2026.sql';
    const sql = fs.readFileSync(sqlFile, 'utf8');

    try {
        await client.connect();
        console.log(`Executing SQL from ${sqlFile}...`);
        
        // Split by semicolon and filter empty
        const commands = sql.split(';').map(c => c.trim()).filter(c => c.length > 0 && !c.startsWith('--'));

        for (let i = 0; i < commands.length; i++) {
            try {
                await client.query(commands[i]);
            } catch (cmdErr) {
                console.error(`Error executing command ${i}:`, commands[i]);
                console.error(cmdErr.message);
            }
        }

        console.log('SQL execution completed.');
    } catch (err) {
        console.error('Error connecting to database:', err);
    } finally {
        await client.end();
    }
}

main();
