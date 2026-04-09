const http = require('http');
const fs = require('fs');

const fetch = (url) => new Promise(res => {
    http.get(url, resp => {
        let d = '';
        resp.on('data', chunk => { d += chunk; });
        resp.on('end', () => res(d));
    });
});

(async () => {
    try {
        const h = await fetch('http://localhost:5144/api/talleres/horarios');
        const m = await fetch('http://localhost:5144/api/produccion/maestros');
        const p = await fetch('http://localhost:5144/api/tallerespersonal');

        fs.writeFileSync('debug_ot.json', JSON.stringify({
            horarios: JSON.parse(h),
            maestros: JSON.parse(m),
            personal: JSON.parse(p)
        }, null, 2));
        console.log("Successfully wrote debug_ot.json");
    } catch (e) {
        console.error(e);
    }
})();
