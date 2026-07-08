const fs = require('fs');
const rawData = fs.readFileSync('ocr_raw.txt', 'utf8');
const lines = rawData.split('\n');

let total = 0;
let count = 0;
lines.forEach(line => {
    if (line.includes('SpeedMaster') && (line.includes(' 6 ') || line.startsWith('2026-04-14 6 '))) {
        // Find quantity - it's usually before the last '-' or at the end
        // Format: ... OP Cant Nota
        // Let's use a simpler regex to find the numbers
        const parts = line.trim().split(/\s+/);
        // Cant is usually the second to last if there's no nota, or third to last if there is
        // But the OP is also a number.
        // Let's use the full regex but more relaxed
        const match = line.match(/(\d+)\s+([\d.]+)\s*(.*)$/);
        if (match) {
            const op = match[1];
            const cant = parseFloat(match[2]);
            if (line.includes(' 6 SpeedMaster') || line.includes(' 6 SpeedMaster'.toLowerCase())) {
                total += cant;
                count++;
            }
        }
    }
});

console.log('Total for SpeedMaster 6 in OCR:', total);
console.log('Record count:', count);
