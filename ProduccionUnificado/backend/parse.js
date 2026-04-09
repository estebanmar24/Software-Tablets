const fs = require('fs');
const data = JSON.parse(fs.readFileSync('test_oee.json', 'utf16le').toString());
data.slice(0, 10).forEach(m => console.log(m.maquina + ' | ' + m.totalHorasProductivas + ' | ' + m.totalHorasAuxiliares + ' | ' + m.totalHoras));
