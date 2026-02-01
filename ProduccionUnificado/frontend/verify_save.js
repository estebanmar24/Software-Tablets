const axios = require('axios');

const API_URL = 'http://localhost:5144/api';

async function verify() {
    try {
        console.log("1. Fetching active user and machine...");
        const usersRes = await axios.get(`${API_URL}/usuarios?includeInactive=true`);
        const user = usersRes.data.find(u => u.activo) || usersRes.data[0];

        const machinesRes = await axios.get(`${API_URL}/maquinas?soloActivas=true`);
        const machine = machinesRes.data[0];

        console.log(`Target: Machine ${machine.id}`);

        // Read data back
        // We need 'mes' and 'anio'. Diagnostic used current date.
        const today = new Date();
        const mes = today.getMonth() + 1;
        const anio = today.getFullYear();

        const url = `${API_URL}/produccion/detalles-maquina?mes=${mes}&anio=${anio}&maquinaId=${machine.id}`;
        console.log(`2. Getting data from: ${url}`);

        const res = await axios.get(url);

        if (res.data && res.data.length > 0) {
            console.log("Data found!");
            const record = res.data.find(r => r.referenciaOP === "TEST_DIAG");
            if (record) {
                console.log("Found TEST_DIAG record:");
                console.log("Record ID:", record.id);
                console.log("UsuarioId:", record.usuarioId);
                console.log("HorarioId:", record.horarioId);

                if (record.usuarioId === user.id) {
                    console.log("VERIFICATION SUCCESS: Expecting " + user.id + ", got " + record.usuarioId);
                } else {
                    console.log("VERIFICATION FAILED: Expecting " + user.id + ", got " + record.usuarioId);
                }
            } else {
                console.log("TEST_DIAG record not found in response.");
                console.log("Sample record:", res.data[0]);
            }
        } else {
            console.log("No data returned for this machine/month.");
        }

    } catch (error) {
        console.log("Error:", error.message);
    }
}

verify();
