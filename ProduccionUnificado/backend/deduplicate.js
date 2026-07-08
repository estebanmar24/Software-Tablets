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
        
        console.log('Counting duplicates...');
        const res = await client.query(`
            SELECT COUNT(*) FROM (
                SELECT "Id",
                       ROW_NUMBER() OVER (
                           PARTITION BY "Fecha", "MaquinaId", "UsuarioId", "OrdenProduccion", "Cantidad", "Nota"
                           ORDER BY "Id"
                       ) as row_num
                FROM "RegistrosDesperdicio"
                WHERE "Fecha" >= '2026-04-01' AND "Fecha" <= '2026-04-30 23:59:59'
            ) t
            WHERE t.row_num > 1
        `);
        console.log(`Records to be deleted: ${res.rows[0].count}`);

        if (parseInt(res.rows[0].count) > 0) {
            console.log('Executing deduplication...');
            const delRes = await client.query(`
                DELETE FROM "RegistrosDesperdicio"
                WHERE "Id" IN (
                    SELECT "Id"
                    FROM (
                        SELECT "Id",
                               ROW_NUMBER() OVER (
                                   PARTITION BY "Fecha", "MaquinaId", "UsuarioId", "OrdenProduccion", "Cantidad", "Nota"
                                   ORDER BY "Id"
                               ) as row_num
                        FROM "RegistrosDesperdicio"
                        WHERE "Fecha" >= '2026-04-01' AND "Fecha" <= '2026-04-30 23:59:59'
                    ) t
                    WHERE t.row_num > 1
                )
            `);
            console.log(`Deleted ${delRes.rowCount} duplicate records.`);
        }

        // Final sync
        console.log('Syncing ProduccionDiaria summary...');
        await client.query(`
            UPDATE "ProduccionDiaria" pd
            SET "Desperdicio" = (
                SELECT COALESCE(SUM(rd."Cantidad"), 0)
                FROM "RegistrosDesperdicio" rd
                WHERE rd."Fecha"::date = pd."Fecha"::date
                  AND rd."MaquinaId" = pd."MaquinaId"
                  AND rd."UsuarioId" = pd."UsuarioId"
            )
            WHERE pd."Fecha" >= '2026-04-01' AND pd."Fecha" <= '2026-04-30';
        `);
        console.log('Sync completed.');

    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

main();
