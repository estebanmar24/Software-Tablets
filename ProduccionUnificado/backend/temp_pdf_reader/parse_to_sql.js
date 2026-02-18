import fs from 'fs';

// Read as UTF-16LE
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
    { name: 'Jose Fernando Ruiz', id: 28 },
    { name: 'Johan Alexander Preciado', id: 29 },
    { name: 'Blandon Moreno Jose Lizandro', id: 1 },
    { name: 'Escobar Cardona John Fredy', id: 4 },
    { name: 'Motta Talaga Leidy Jhoanna', id: 9 },
    { name: 'Perdomo Rincon Gustavo Adolfo', id: 14 },
    { name: 'Preciado Rivas Johan Alexander', id: 27 },
    { name: 'Riascos Castillo Andres Felipe', id: 21 },
    { name: 'Velez Arana Robert De Jesus', id: 13 },
    { name: 'Cristian Felipe Echavarria', id: 30 },
    { name: 'Roldan Barona Erik Esteban', id: 22 },
    { name: 'Sarmiento Rincon Yhan Otoniel', id: 12 },
    { name: 'Moreno Mendez Angel Julio', id: 7 }
];

const codes = [
    { code: '01', id: 2 }, { code: '02', id: 3 }, { code: '03', id: 4 },
    { code: '10', id: 11 }, { code: '11', id: 12 }, { code: '17', id: 17 }
];

// Flatten and clean
const flat = text.replace(/\s+/g, ' ');

const pattern = /(\d{1,2})\s+(\d{4,10})\s+(\d+)\s+-/g;
const dates = [...flat.matchAll(/(\d{4}-\d{2}-\d{2})/g)];

console.log(`Dates found: ${dates.length}`);

let found = 0;
let sql = '-- Detailed Records Recovery\n';

let match;
while ((match = pattern.exec(flat)) !== null) {
    const codeStr = match[1].padStart(2, '0');
    const op = match[2];
    const waste = parseFloat(match[3]);
    const index = match.index;

    const dateMatch = dates.filter(d => d.index < index).reverse()[0];
    if (!dateMatch) continue;
    if (!dateMatch[1].startsWith('2026-01')) continue;

    const date = dateMatch[1];
    const context = flat.substring(dateMatch.index, index);

    let machineId = null;
    for (const m of machines) {
        if (context.includes(m.name) || context.includes(m.name.split(' ')[0])) {
            machineId = m.id;
            if (m.name.length > 5) break;
        }
    }

    let userId = null;
    for (const u of users) {
        const parts = u.name.split(' ');
        if (parts.some(p => p.length > 5 && context.includes(p))) {
            userId = u.id;
            break;
        }
    }

    let codeId = codes.find(c => c.code === codeStr)?.id || null;

    if (machineId && userId && waste > 0) {
        sql += `INSERT INTO "RegistrosDesperdicio" ("MaquinaId", "UsuarioId", "CodigoDesperdicioId", "OrdenProduccion", "Cantidad", "Fecha", "FechaRegistro") `;
        sql += `VALUES (${machineId}, ${userId}, ${codeId || 'NULL'}, '${op}', ${waste}, '${date} 12:00:00', NOW());\n`;
        found++;
    }
}

fs.writeFileSync('insert_waste_january.sql', sql);
console.log(`Successfully generated ${found} INSERT statements.`);
