const fs = require('fs');
const mappings = JSON.parse(fs.readFileSync('mappings.json', 'utf8'));

// Helper to find ID by name (fuzzy)
function findMachineId(name) {
    if (!name) return null;
    const n = name.toLowerCase().replace(/\s+/g, ' ').trim();
    
    // Exact or contains match
    let found = mappings.maquinas.find(m => m.Nombre.toLowerCase() === n);
    if (found) return found.Id;

    found = mappings.maquinas.find(m => m.Nombre.toLowerCase().includes(n) || n.includes(m.Nombre.toLowerCase()));
    if (found) return found.Id;

    // Word based match
    const words = n.split(' ').filter(w => w.length > 1);
    found = mappings.maquinas.find(m => {
        const mn = m.Nombre.toLowerCase();
        return words.every(w => mn.includes(w));
    });
    return found ? found.Id : null;
}

function findUserId(name) {
    if (!name) return null;
    const n = name.toLowerCase().replace(/\s+/g, ' ').trim();
    
    let found = mappings.usuarios.find(u => u.Nombre.toLowerCase() === n);
    if (found) return found.Id;

    const words = n.split(' ').filter(w => w.length > 2);
    if (words.length === 0) return null;

    found = mappings.usuarios.find(u => {
        const un = u.Nombre.toLowerCase();
        return words.every(w => un.includes(w));
    });
    
    if (!found) {
        // Try reverse word match
        found = mappings.usuarios.find(u => {
            const un = u.Nombre.toLowerCase();
            const uWords = un.split(' ').filter(w => w.length > 2);
            return uWords.every(w => n.includes(w));
        });
    }

    return found ? found.Id : null;
}

function findCodeId(codeStr) {
    if (!codeStr) return null;
    const match = codeStr.match(/^(\d+)/);
    if (!match) {
        if (codeStr.includes('S/C')) return 17; // sin codigo
        return null;
    }
    const codeNum = match[1].padStart(2, '0');
    const found = mappings.codigos.find(c => c.Codigo === codeNum);
    return found ? found.Id : null;
}

const rawData = fs.readFileSync('ocr_raw.txt', 'utf8');
const lines = rawData.split('\n');

const records = [];
// Regex for date: YYYY-MM-DD followed by machine name
// Format: 2026-04-01 16 Barnizadora UV Riascos Castillo Andres Felipe 02 - ... 7328 40 -
const recordRegex = /^(\d{4}-\d{2}-\d{2})\s+(.*?)\s+(.*?)\s+(\d{2}\s*-\s*.*?|S\/C.*?)\s+(\d+)\s+([\d.]+)\s*(.*)$/;

// Regex to split: Date | Everything else
for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('REPORTE') || line.startsWith('Fecha:') || line.startsWith('Total') || line.startsWith('Fecha Máquina')) continue;

    // Try to find the code part first (e.g., "01 -", "02 -", "S/C -")
    const codeMatch = line.match(/\s+(\d{2}\s*-\s*.*?|S\/C.*?)\s+(\d+)\s+([\d.]+)\s*(.*)$/);
    if (codeMatch) {
        const [fullCodeMatch, codigoStr, op, cant, nota] = codeMatch;
        const beforeCode = line.substring(11, line.indexOf(fullCodeMatch)).trim(); // After YYYY-MM-DD
        const fecha = line.substring(0, 10);

        // Now split beforeCode into Machine and Operario
        // This is tricky. Let's try matching known machines.
        let machineId = null;
        let machineNameFound = '';
        
        // Sort machines by length descending to match longer names first
        const sortedMaquinas = [...mappings.maquinas].sort((a,b) => b.Nombre.length - a.Nombre.length);
        for (const m of sortedMaquinas) {
            const mn = m.Nombre.toLowerCase();
            const bc = beforeCode.toLowerCase();
            // Check if machine name is in beforeCode OR beforeCode starts with a machine-like prefix
            if (bc.includes(mn) || mn.includes(bc.split(' ')[0] + ' ' + bc.split(' ')[1])) {
                machineId = m.Id;
                machineNameFound = bc.includes(mn) ? mn : bc.split(' ')[0] + ' ' + bc.split(' ')[1];
                break;
            }
        }
        
        // Final fallback for machines like "8A Troqueladora"
        if (!machineId) {
             const found = mappings.maquinas.find(m => {
                 const words = m.Nombre.toLowerCase().split(' ');
                 return words.slice(0,2).every(w => beforeCode.toLowerCase().includes(w));
             });
             if (found) {
                 machineId = found.Id;
                 machineNameFound = beforeCode.split(' ').slice(0,2).join(' ');
             }
        }

        const operarioStr = beforeCode.replace(new RegExp(machineNameFound, 'i'), '').trim();
        const usuarioId = findUserId(operarioStr);
        const codigoId = findCodeId(codigoStr);

        if (machineId && usuarioId && codigoId) {
            records.push({
                MaquinaId: machineId,
                UsuarioId: usuarioId,
                CodigoDesperdicioId: codigoId,
                OrdenProduccion: op,
                Cantidad: parseFloat(cant),
                Fecha: `${fecha} 12:00:00`,
                Nota: nota.trim() === '-' ? '' : nota.trim()
            });
        } else {
            console.warn(`[WARN] Could not map record: ${line}`);
            if (!machineId) console.warn(`  Missing Machine: ${beforeCode}`);
            if (!usuarioId) console.warn(`  Missing User: ${operarioStr}`);
            if (!codigoId) console.warn(`  Missing Code: ${codigoStr}`);
        }
    } else {
         console.warn(`[SKIP] Line did not match pattern: ${line}`);
    }
}

console.log(`Successfully parsed ${records.length} records.`);

let sql = '-- April 2026 Waste Recovery\n';
sql += 'DELETE FROM "RegistrosDesperdicio" WHERE "Fecha" >= \'2026-04-01\' AND "Fecha" <= \'2026-04-30\';\n';

records.forEach(r => {
    const notaSql = r.Nota ? `'${r.Nota.replace(/'/g, "''")}'` : 'NULL';
    sql += `INSERT INTO "RegistrosDesperdicio" ("MaquinaId", "UsuarioId", "CodigoDesperdicioId", "OrdenProduccion", "Cantidad", "Fecha", "FechaRegistro", "Nota") VALUES (${r.MaquinaId}, ${r.UsuarioId}, ${r.CodigoDesperdicioId}, '${r.OrdenProduccion}', ${r.Cantidad}, '${r.Fecha}', NOW(), ${notaSql});\n`;
});

fs.writeFileSync('recovery_april_2026.sql', sql);
console.log('SQL generated: recovery_april_2026.sql');
