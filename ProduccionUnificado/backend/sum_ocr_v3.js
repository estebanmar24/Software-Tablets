const fs = require('fs');
const rawData = fs.readFileSync('ocr_raw.txt', 'utf8');
const lines = rawData.split('\n');

const recordRegex = /^(\d{4}-\d{2}-\d{2})\s+(.*?)\s+(.*?)\s+(\d{2}\s*-\s*.*?|S\/C.*?)\s+(\d+)\s+([\d.]+)\s*(.*)$/;

let total = 0;
let count = 0;

for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const match = line.match(recordRegex);
    if (match) {
        const [_, fecha, maquinaStr, operarioStr, codigoStr, op, cant, nota] = match;
        // console.log(`'${maquinaStr}'`);
        if (maquinaStr.toLowerCase().includes('6 speedmaster')) {
            total += parseFloat(cant);
            count++;
        }
    }
}

console.log('Total for SpeedMaster 6 in OCR:', total);
console.log('Record count:', count);
