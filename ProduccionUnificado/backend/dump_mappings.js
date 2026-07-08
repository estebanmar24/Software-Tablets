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

    try {
        await client.connect();
        
        const maquinas = await client.query('SELECT "Id", "Nombre" FROM "Maquinas"');
        const usuarios = await client.query('SELECT "Id", "Nombre" FROM "Usuarios"');
        const codigos = await client.query('SELECT "Id", "Codigo", "Descripcion" FROM "CodigosDesperdicio"');

        const mappings = {
            maquinas: maquinas.rows,
            usuarios: usuarios.rows,
            codigos: codigos.rows
        };

        fs.writeFileSync('mappings.json', JSON.stringify(mappings, null, 2));
        console.log('Mappings dumped to mappings.json');
    } catch (err) {
        console.error('Error connecting to database:', err);
    } finally {
        await client.end();
    }
}

main();
