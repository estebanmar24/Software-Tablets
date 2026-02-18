import fs from 'fs';

const text = fs.readFileSync('extracted_text.txt', 'utf16le');

const machines = [
    { name: '1B CONVERTIDORA', id: 2 },
    { name: '2A Guillotina polar132', id: 3 },
    { name: '2B Guillotina org- Perfecta 107', id: 4 },
    { name: '4 Sord Z', id: 6 },
    { name: '5 Sord Z', id: 7 },
    { name: '6 SpeedMaster', id: 8 },
    { name: '7 SpeedMaster', id: 9 },
    { name: '8A Troqueladora de Papel', id: 10 },
    { name: '8B Troqueladora de Papel', id: 11 },
    { name: '8C Estampadora', id: 12 },
    { name: '9 Troqueladora Rollo', id: 13 },
    { name: '10A Colaminadora Carton', id: 14 },
    { name: '10B Colaminadora Carton', id: 15 },
    { name: '11 Laminadora BOPP', id: 16 },
    { name: '13A Corrugadora FLTE', id: 19 },
    { name: '13b Corrugadora FLTB', id: 20 },
    { name: '14 Pegadora de Cajas', id: 21 },
    { name: '16 Barnizadora UV', id: 103 }
];

const users = [
    { name: 'Obando Higuita Jose Luis', id: 10 },
    { name: 'Rodriguez Castaño Maria Alejandra', id: 19 },
    { name: 'Bedoya Maria Fernanda', id: 16 },
    { name: 'Enrique Muñoz Hector Hilde', id: 3 },
    { name: 'Gomez Ruiz William Hernan', id: 18 },
    { name: 'Morales Grueso Claudia Patricia', id: 17 },
    { name: 'Martinez Osorno Karen Lizeth', id: 5 },
    { name: 'Uran Quintero Yohao Alexander', id: 26 },
    { name: 'Josue lopez', id: 40 },
    { name: 'helder valencia', id: 35 },
    { name: 'santiago agudelo', id: 36 },
    { name: 'Jose Fernando Ruiz', id: 28 },
    { name: 'Valencia Mirquez Nicol', id: 25 },
    { name: 'Mina Sinisterra Jhon Jairo', id: 24 },
    { name: 'Johan Alexander Preciado', id: 29 },
    { name: 'Blandon Moreno Jose Lizandro', id: 1 },
    { name: 'Escobar Cardona John Fredy', id: 4 },
    { name: 'Millan Salazar Magaly', id: 6 },
    { name: 'Moriano Chiguas Yurde Arley', id: 15 },
    { name: 'Motta Talaga Leidy Jhoanna', id: 9 },
    { name: 'Perdomo Rincon Gustavo Adolfo', id: 14 },
    { name: 'Preciado Rivas Johan Alexander', id: 27 },
    { name: 'Ramirez Romero Andres Mauricio', id: 11 },
    { name: 'Riascos Castillo Andres Felipe', id: 21 },
    { name: 'Rojas Collazos Joan Mauricio', id: 20 },
    { name: 'Velez Arana Robert De Jesus', id: 13 },
    { name: 'Cristian Felipe Echavarria', id: 30 },
    { name: 'Roldan Barona Erik Esteban', id: 22 },
    { name: 'Sarmiento Rincon Yhan Otoniel', id: 12 },
    { name: 'Moreno Mendez Angel Julio', id: 7 },
    { name: 'Moreno Urrea Marlene', id: 8 }
];

const codesIdMap = {
    '01': 2, '02': 3, '03': 4, '10': 11, '11': 12, '12': 13, '13': 14, '14': 15, '15': 16,
    'sin codigo': 17, 'codigo': 17, 'sin': 17
};

// Normalize text
const flat = text.replace(/-- \d+ of \d+ --/g, ' ').replace(/\n/g, ' ').replace(/\s+/g, ' ');

// Split body to avoid summary
const splitIdx = flat.toLowerCase().indexOf('resumen por');
const body = splitIdx === -1 ? flat : flat.substring(0, splitIdx);

// Dates
const dateRegex = /(\d{4}-\d{2}-\d{2})/g;
let dates = [];
let dm;
while ((dm = dateRegex.exec(body)) !== null) {
    dates.push({ date: dm[1], index: dm.index });
}

// Triplets matching: (Code/Sin) (OP) (Amount)
// Regex: (?:01|02...|sin codigo|codigo)\s+(\d+)\s+(\d+)
// Note: "sin codigo" has a space, so we need to be careful with \s+
const tripletRegex = /(01|02|03|04|05|06|07|08|09|10|11|12|13|14|15|sin codigo|codigo|sin)\s+(\d+)\s+(\d+)/g;

let results = [];
let match;
while ((match = tripletRegex.exec(body)) !== null) {
    const rawCode = match[1];
    const op = match[2];
    const amount = parseFloat(match[3]);
    const index = match.index;

    // Nearest Date
    const dateEntry = dates.filter(d => d.index < index).reverse()[0];
    if (!dateEntry || !dateEntry.date.startsWith('2026-01')) continue;

    // Context from Date to Index
    const context = body.substring(dateEntry.index, index);

    // Find Machine
    let machineId = null;
    let lastMachineIndex = -1;
    for (const m of machines) {
        // Check full name first
        let mIdx = context.lastIndexOf(m.name);
        if (mIdx !== -1 && mIdx > lastMachineIndex) {
            machineId = m.id;
            lastMachineIndex = mIdx;
        } else {
            // Check first 2 words if long enough
            const parts = m.name.split(' ');
            if (parts.length >= 2) {
                const mShort = parts[0] + ' ' + parts[1];
                const msIdx = context.lastIndexOf(mShort);
                if (msIdx !== -1 && msIdx > lastMachineIndex) {
                    machineId = m.id;
                    lastMachineIndex = msIdx;
                }
            }
        }
    }

    // Find User
    let userId = null;
    let lastUserIndex = -1;
    for (const u of users) {
        let uIdx = context.lastIndexOf(u.name);
        if (uIdx !== -1 && uIdx > lastUserIndex) {
            userId = u.id;
            lastUserIndex = uIdx;
        } else {
            // Check individual long names
            const parts = u.name.split(' ');
            for (const p of parts) {
                if (p.length > 5) {
                    const pIdx = context.lastIndexOf(p);
                    if (pIdx !== -1 && pIdx > lastUserIndex) {
                        userId = u.id;
                        lastUserIndex = pIdx;
                    }
                }
            }
        }
    }

    let codeId = codesIdMap[rawCode.padEnd(2, '0')] || codesIdMap[rawCode] || 17; // Default to 'sin codigo' if unknown pattern but matched
    if (rawCode.includes('sin') || rawCode.includes('codigo')) codeId = 17;
    else if (codesIdMap[rawCode.padStart(2, '0')]) codeId = codesIdMap[rawCode.padStart(2, '0')];

    // Fallback: If no machine/user found in immediate context, likely same as previous record (merged line)
    // The loop runs in order, so we could theoretically store "last known"
    // BUT, since we look back to the DATE, it should cover it if they are in the same block.

    // Correction: If user or machine index is VERY far back (like different day block), that's wrong.
    // But we limit context to `dateEntry.index`, so it's safe within the day.

    if (machineId && userId) {
        results.push({
            fecha: dateEntry.date,
            maquinaId: machineId,
            usuarioId: userId,
            codigoId: codeId,
            op: op,
            cantidad: amount
        });
    } else {
        // Try to reuse last valid if on same day? 
        // For now just log it
        // console.log(`Missing context for ${op} on ${dateEntry.date}`);
        if (results.length > 0) {
            const last = results[results.length - 1];
            if (last.fecha === dateEntry.date) {
                if (!machineId) machineId = last.maquinaId;
                if (!userId) userId = last.usuarioId;
                results.push({
                    fecha: dateEntry.date,
                    maquinaId: machineId,
                    usuarioId: userId,
                    codigoId: codeId,
                    op: op,
                    cantidad: amount
                });
            }
        }
    }
}

console.log(`Final Robust Parse: Found ${results.length} records.`);

let sql = '-- Final 186 Records Recovery\n';
sql += 'DELETE FROM "RegistrosDesperdicio" WHERE "Fecha" >= \'2026-01-01\' AND "Fecha" <= \'2026-01-31\';\n';

results.forEach(r => {
    const codeVal = r.codigoId || 'NULL';
    const opVal = r.op ? `'${r.op}'` : 'NULL';
    sql += `INSERT INTO "RegistrosDesperdicio" ("MaquinaId", "UsuarioId", "CodigoDesperdicioId", "OrdenProduccion", "Cantidad", "Fecha", "FechaRegistro") `;
    sql += `VALUES (${r.maquinaId}, ${r.usuarioId}, ${codeVal}, ${opVal}, ${r.cantidad}, '${r.fecha} 12:00:00', NOW());\n`;
});

fs.writeFileSync('insert_waste_january_final.sql', sql);
