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

const codesMap = {
    '01': 2, '02': 3, '03': 4, '04': 5, '05': 6, '06': 7, '07': 8, '08': 9, '09': 10,
    '10': 11, '11': 12, '12': 13, '13': 14, '14': 15, '15': 16, 'sin codigo': 17
};

// Normalize text: remove "Page X of Y", replace newlines with spaces for better regex matching
const processedText = text.replace(/-- \d+ of \d+ --/g, ' ').replace(/\n/g, ' ');

// Match Date
const dateRegex = /(\d{4}-\d{2}-\d{2})/g;
let dates = [];
let dm;
while ((dm = dateRegex.exec(processedText)) !== null) {
    dates.push({ date: dm[1], index: dm.index });
}

// Match Waste entries: (Code) (OP) (Waste) - OR (sin codigo) (OP) (Waste) - OR (Waste) (Waste) -
// Actually, let's look for any number followed by " - " or " -"
const wasteTokenRegex = /(\S+)\s+(\d+)\s+(\d+)\s+-/g;
let results = [];
let wm;
while ((wm = wasteTokenRegex.exec(processedText)) !== null) {
    const rawCode = wm[1];
    const op = wm[2];
    const amount = parseFloat(wm[3]);
    const index = wm.index;

    // Skip if it looks like a page summary or noise (e.g. "of 9 -")
    if (rawCode === 'of' || isNaN(amount)) continue;

    // Find closest date
    const dateEntry = dates.filter(d => d.index < index).reverse()[0];
    if (!dateEntry || !dateEntry.date.startsWith('2026-01')) continue;

    // Look for machine and user in context (date to match)
    const context = processedText.substring(dateEntry.index, index);

    let machineId = null;
    for (const m of machines) {
        if (context.includes(m.name) || context.includes(m.name.split(' ')[0] + ' ' + m.name.split(' ')[1])) {
            machineId = m.id;
            // No break, we want the most specific/latest match in context
        }
    }

    let userId = null;
    for (const u of users) {
        const parts = u.name.split(' ');
        const matchesPart = parts.some(p => p.length > 5 && context.includes(p));
        if (context.includes(u.name) || matchesPart) {
            userId = u.id;
            // No break, same logic
        }
    }

    let codeId = codesMap[rawCode.padStart(2, '0')] || codesMap[rawCode] || null;

    results.push({
        fecha: dateEntry.date,
        maquinaId: machineId,
        usuarioId: userId,
        codigoId: codeId,
        op: op,
        cantidad: amount,
        rawIndex: index
    });
}

console.log(`Initial parse found ${results.length} records.`);

// Handle records with 2 waste amounts on one line? (e.g. "78 50 - 30 -")
// My regex captures (\S+) (\d+) (\d+) -
// If we have "7278 50 - 30 -", it might only capture one.
// Let's refine to catch more.

// Deduplicate and generate SQL
let sql = '-- Total Records Recovery\n';
sql += 'DELETE FROM "RegistrosDesperdicio" WHERE "Fecha" >= \'2026-01-01\' AND "Fecha" <= \'2026-01-31\';\n';

results.forEach(r => {
    if (r.maquinaId && r.usuarioId) {
        const codeVal = r.codigoId || 'NULL';
        const opVal = r.op ? `'${r.op}'` : 'NULL';
        sql += `INSERT INTO "RegistrosDesperdicio" ("MaquinaId", "UsuarioId", "CodigoDesperdicioId", "OrdenProduccion", "Cantidad", "Fecha", "FechaRegistro") `;
        sql += `VALUES (${r.maquinaId}, ${r.usuarioId}, ${codeVal}, ${opVal}, ${r.cantidad}, '${r.fecha} 12:00:00', NOW());\n`;
    }
});

fs.writeFileSync('insert_waste_january_full.sql', sql);
console.log(`Generated SQL with ${results.filter(r => r.maquinaId && r.usuarioId).length} inserts.`);
