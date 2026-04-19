const fs = require('fs');
const files = ['EquipmentMaintenanceScreen.tsx', 'TicketsScreen.tsx', 'UserManagementScreen.tsx', 'CalidadTalleresScreen.tsx'];
for (const file of files) {
  let p = 'g:/Proyecto-Tablets/ProduccionUnificado/frontend/src/screens/' + file;
  if (!fs.existsSync(p)) continue;
  let content = fs.readFileSync(p, 'utf8');
  if (content.includes('authFetch')) continue;

  if (content.includes('import { getApiBaseUrl')) {
    content = content.replace(/import \{ getApiBaseUrl/g, "import { getToken } from '../services/authStorage';\nimport { getApiBaseUrl");
  } else if (!content.includes('getToken')) {
    content = "import { getToken } from '../services/authStorage';\n" + content;
  }

  content = content.replace(/fetch\(/g, 'authFetch(');
  
  const funcMatch = content.match(/export default function [\w]+\([^)]*\)\s*\{/);
  if (funcMatch) {
    content = content.replace(funcMatch[0], funcMatch[0] + `
    const authFetch = async (url: string, options: any = {}) => {
        const token = await getToken();
        let headers = options.headers || {};
        if (token) {
            headers = { ...headers, Authorization: \`Bearer \${token}\` };
        }
        return globalThis.fetch(url, { ...options, headers });
    };
`);
  }
  fs.writeFileSync(p, content);
  console.log('Patched ' + file);
}
