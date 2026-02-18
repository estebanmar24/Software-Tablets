import fs from 'fs';

const sql = fs.readFileSync('insert_waste_january_final.sql', 'utf8');
const inserts = sql.split('\n').filter(l => l.startsWith('INSERT'));

const parsedInserts = inserts.map(line => {
    // INSERT INTO ... VALUES (10, 30, 2, '7278', 16, '2026-01-05 12:00:00', NOW());
    const m = line.match(/\((\d+), (\d+), (\d+|NULL), ('[^']+'|NULL), ([\d.]+), '([^']+)',/);
    if (!m) return null;
    return {
        maquinaId: parseInt(m[1]),
        usuarioId: parseInt(m[2]),
        codigoId: m[3] === 'NULL' ? null : parseInt(m[3]),
        op: m[4] === 'NULL' ? null : m[4].replace(/'/g, ''),
        cantidad: parseFloat(m[5]),
        fecha: m[6].split(' ')[0]
    };
}).filter(x => x);

console.log(`Parsed ${parsedInserts.length} inserts from SQL.`);

try {
    const csvData = fs.readFileSync('db_records.csv', 'utf8');
    const csvLines = csvData.split('\n').filter(l => l.trim() && !l.startsWith('Id') && !l.startsWith('('));

    // Id,MaquinaId,UsuarioId,CodigoDesperdicioId,OrdenProduccion,Cantidad,Fecha,FechaRegistro,Nota
    // 176,13,13,3,7292,180,2026-01-26 12:00:00,2026-02-12 11:23:45.123,

    const dbRecords = csvLines.map(line => {
        const parts = line.split(','); // simple split, assumes no commas in values (OP is text but usually has no commas)

        // If OP might have commas, this breaks. But OP 7292 doesn't.
        // Also verify indices.
        // Id is parts[0]
        // MaquinaId is parts[1]
        // UsuarioId is parts[2]
        // CodigoDesperdicioId is parts[3]
        // OrdenProduccion is parts[4]
        // Cantidad is parts[5]

        return {
            MaquinaId: parseInt(parts[1]),
            UsuarioId: parseInt(parts[2]),
            CodigoDesperdicioId: parts[3] ? parseInt(parts[3]) : null,
            OrdenProduccion: parts[4] ? parts[4].trim() : null, // trim potential quotes?
            Cantidad: parseFloat(parts[5]),
            Fecha: parts[6]
        };
    });

    console.log(`Loaded ${dbRecords.length} records from DB (CSV).`);

    const dbSet = new Set();
    dbRecords.forEach(r => {
        // Normalize OP
        let op = r.OrdenProduccion;
        if (op === '' || op === 'NULL') op = null;

        // Fecha timestamp from DB: 2026-01-26 12:00:00
        const date = r.Fecha ? r.Fecha.split(' ')[0] : 'NULL';

        const key = `${r.MaquinaId}-${r.UsuarioId}-${date}-${r.Cantidad}-${op}`;
        dbSet.add(key);
    });

    const missing = [];
    parsedInserts.forEach((ins, i) => {
        let op = ins.op;
        if (op === undefined || op === null) op = null;

        const key = `${ins.maquinaId}-${ins.usuarioId}-${ins.fecha}-${ins.cantidad}-${op}`;

        if (!dbSet.has(key)) {
            missing.push({ index: i, key, ...ins });
        }
    });

    console.log(`Found ${missing.length} missing records.`);
    missing.forEach(m => console.log(JSON.stringify(m)));

} catch (e) {
    console.error("Error:", e.message);
}
