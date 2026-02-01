const axios = require('axios');

const API_URL = 'http://localhost:5144/api'; // Assuming running locally on standard port

async function testSave() {
    try {
        console.log("Fetching users...");
        const usersRes = await axios.get(`${API_URL}/usuarios?includeInactive=true`);
        const user = usersRes.data.find(u => u.activo) || usersRes.data[0];
        console.log(`Using user: ${user.nombre} (${user.id})`);

        console.log("Fetching machines...");
        const machinesRes = await axios.get(`${API_URL}/maquinas/activas`);
        const machine = machinesRes.data[0];
        console.log(`Using machine: ${machine.nombre} (${machine.id})`);

        const payload = [{
            "Fecha": new Date().toISOString().split('T')[0], // Today
            "UsuarioId": user.id,
            "MaquinaId": machine.id,
            // "HorarioId": null, // THE TEST CASE
            "HoraInicio": "00:00:00",
            "HoraFin": "00:00:00",
            "HorasOperativas": 0,
            "RendimientoFinal": 0,
            "Cambios": 0,
            "TiempoPuestaPunto": 0,
            "TirosDiarios": 0,
            "TotalHorasProductivas": 0,
            "PromedioHoraProductiva": 0,
            "ValorTiroSnapshot": 0,
            "ValorAPagar": 0,
            "HorasMantenimiento": 0,
            "HorasDescanso": 0,
            "HorasOtrosAux": 0,
            "TiempoFaltaTrabajo": 0,
            "TiempoReparacion": 0,
            "TiempoOtroMuerto": 0,
            "ReferenciaOP": "DEBUG_TEST",
            "Novedades": "Testing null horario",
            "Desperdicio": 0,
            "DiaLaborado": 1
        }];

        console.log("Sending payload...");
        const res = await axios.post(`${API_URL}/produccion/mensual`, payload);
        console.log("SUCCESS! Status:", res.status);
    } catch (error) {
        console.error("FAILED!");
        if (error.response) {
            console.error("Status:", error.response.status);
            console.error("Data:", JSON.stringify(error.response.data, null, 2));
        } else {
            console.error("Error:", error.message);
        }
    }
}

testSave();
