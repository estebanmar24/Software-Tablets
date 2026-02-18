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

const processedText = text.replace(/-- \d+ of \d+ --/g, ' ').replace(/\n/g, ' ').replace(/\s+/g, ' ');

const dateRegex = /(\d{4}-\d{2}-\d{2})/g;
let dates = [];
let dm;
while ((dm = dateRegex.exec(processedText)) !== null) {
    dates.push({ date: dm[1], index: dm.index });
}

const wasteRegex = /(\d+(?:\.\d+)?)\s+-/g;
let wasteMatches = [];
let wm;
while ((wm = wasteRegex.exec(processedText)) !== null) {
    wasteMatches.push({ amount: parseFloat(wm[1]), index: wm.index });
}

let results = [];
let rejectedCount = 0;

wasteMatches.forEach((wm, idx) => {
    const amount = wm.amount;
    const index = wm.index;

    const dateEntry = dates.filter(d => d.index < index).reverse()[0];
    if (!dateEntry || !dateEntry.date.startsWith('2026-01')) {
        rejectedCount++;
        return;
    }

    const fullContext = processedText.substring(dateEntry.index, index);

    let machineId = null;
    let lastMachineIndex = -1;
    for (const m of machines) {
        const mIdx = fullContext.lastIndexOf(m.name);
        if (mIdx !== -1 && mIdx > lastMachineIndex) {
            machineId = m.id;
            lastMachineIndex = mIdx;
        } else {
            const mShort = m.name.split(' ')[0] + ' ' + m.name.split(' ')[1];
            const msIdx = fullContext.lastIndexOf(mShort);
            if (msIdx !== -1 && msIdx > lastMachineIndex) {
                machineId = m.id;
                lastMachineIndex = msIdx;
            }
        }
    }

    let userId = null;
    let lastUserIndex = -1;
    for (const u of users) {
        const uIdx = fullContext.lastIndexOf(u.name);
        if (uIdx !== -1 && uIdx > lastUserIndex) {
            userId = u.id;
            lastUserIndex = uIdx;
        } else {
            const parts = u.name.split(' ');
            for (const p of parts) {
                if (p.length > 5) {
                    const pIdx = fullContext.lastIndexOf(p);
                    if (pIdx !== -1 && pIdx > lastUserIndex) {
                        userId = u.id;
                        lastUserIndex = pIdx;
                    }
                }
            }
        }
    }

    if (machineId && userId) {
        const startOfRecordSearch = Math.max(lastUserIndex, lastMachineIndex);
        const recordContext = fullContext.substring(startOfRecordSearch).trim();
        const numbersInRecord = recordContext.match(/\d+/g) || [];

        let codeId = null;
        let op = null;

        if (numbersInRecord.length >= 2) {
            const codeStr = numbersInRecord[0].padStart(2, '0');
            op = numbersInRecord[1];
            codeId = codesIdMap[codeStr] || null;
        } else if (numbersInRecord.length === 1) {
            if (numbersInRecord[0].length >= 4) op = numbersInRecord[0];
            else codeId = codesIdMap[numbersInRecord[0].padStart(2, '0')] || null;
        }

        if (recordContext.includes('sin codigo') || recordContext.includes('sin') || recordContext.includes('codigo')) {
            codeId = 17;
        }

        results.push({
            fecha: dateEntry.date,
            maquinaId: machineId,
            usuarioId: userId,
            codigoId: codeId,
            op: op,
            cantidad: amount
        });
    } else {
        console.log(`REJECTED ${idx}: Context: ${processedText.substring(index - 50, index + 5)}`);
        rejectedCount++;
    }
});

console.log(`Final parse found ${results.length} records. Rejected: ${rejectedCount}`);

let sql = '-- Ultra Detailed Records Recovery\n';
sql += 'DELETE FROM "RegistrosDesperdicio" WHERE "Fecha" >= \'2026-01-01\' AND "Fecha" <= \'2026-01-31\';\n';

results.forEach(r => {
    const codeVal = r.codigoId || 'NULL';
    const opVal = r.op ? `'${r.op}'` : 'NULL';
    sql += `INSERT INTO "RegistrosDesperdicio" ("MaquinaId", "UsuarioId", "CodigoDesperdicioId", "OrdenProduccion", "Cantidad", "Fecha", "FechaRegistro") `;
    sql += `VALUES (${r.maquinaId}, ${r.usuarioId}, ${codeVal}, ${opVal}, ${r.cantidad}, '${r.fecha} 12:00:00', NOW());\n`;
});

fs.writeFileSync('insert_waste_january_full.sql', sql);
