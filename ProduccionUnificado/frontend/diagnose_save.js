const axios = require('axios');
const fs = require('fs');

const API_URL = 'http://localhost:5144/api';

async function diagnose() {
    try {
        console.log("1. Fetching active user and machine...");
        const usersRes = await axios.get(`${API_URL}/usuarios?includeInactive=true`);
        // Find existing user (try ID from log or first active)
        const user = usersRes.data.find(u => u.activo) || usersRes.data[0];

        const machinesRes = await axios.get(`${API_URL}/maquinas?soloActivas=true`);
        const machine = machinesRes.data[0];

        console.log(`Target: User ${user.id} (${user.nombre}), Machine ${machine.id} (${machine.nombre})`);

        const payload = [{
            "Fecha": new Date().toISOString().split('T')[0],
            "UsuarioId": user.id,
            "MaquinaId": machine.id,
            "HorarioId": null,
            "HoraInicio": "06:00:00",
            "HoraFin": "14:00:00",
            "HorasOperativas": 8,
            "RendimientoFinal": 1000,
            "Cambios": 0,
            "TiempoPuestaPunto": 0,
            "TirosDiarios": 1000,
            "TotalHorasProductivas": 8,
            "PromedioHoraProductiva": 125,
            "ValorTiroSnapshot": 10,
            "ValorAPagar": 0,
            "HorasMantenimiento": 0,
            "HorasDescanso": 0,
            "HorasOtrosAux": 0,
            "TiempoFaltaTrabajo": 0,
            "TiempoReparacion": 0,
            "TiempoOtroMuerto": 0,
            "ReferenciaOP": "TEST_DIAG",
            "Novedades": "Test",
            "Desperdicio": 0,
            "DiaLaborado": 1
        }];

        console.log("2. Sending payload...", JSON.stringify(payload, null, 2));
        const res = await axios.post(`${API_URL}/produccion/mensual`, payload);
        console.log("SUCCESS! Code:", res.status);
    } catch (error) {
        console.log("\n=== ERROR DETECTED ===");
        if (error.response) {
            console.log(`Status Code: ${error.response.status}`);
            console.log("Saving error details to error_log.json...");
            fs.writeFileSync('error_log.json', JSON.stringify(error.response.data, null, 2));
        } else {
            console.log("Error Message:", error.message);
        }
    }
}

diagnose();
