const fs = require('fs');

const rawData = fs.readFileSync('ocr_raw.txt', 'utf8');
const lines = rawData.split('\n');

let total = 0;
let count = 0;
lines.forEach(line => {
    // 2026-04-01 6 SpeedMaster Josue lopez 01 - ... 7528 25 02- 25 unidades
    // Regex matches Cant at group 6
    const recordRegex = /^(\d{4}-\d{2}-\d{2})\s+(.*?)\s+(.*?)\s+(\d{2}\s*-\s*.*?|S\/C.*?)\s+(\d+)\s+([\d.]+)\s*(.*)$/;
    const match = line.match(recordRegex);
    if (match) {
        const maquinaStr = match[2];
        const cant = parseFloat(match[6]);
        if (maquinaStr.includes('6 SpeedMaster')) {
            total += cant;
            count++;
        }
    }
});

console.log('Total for SpeedMaster 6 in OCR:', total);
console.log('Record count:', count);
