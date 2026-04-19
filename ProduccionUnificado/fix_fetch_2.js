const fs = require('fs');
const files = ['EquipmentMaintenanceScreen.tsx', 'TicketsScreen.tsx', 'UserManagementScreen.tsx', 'CalidadTalleresScreen.tsx'];

for (const file of files) {
  let p = 'g:/Proyecto-Tablets/ProduccionUnificado/frontend/src/screens/' + file;
  if (!fs.existsSync(p)) continue;
  let content = fs.readFileSync(p, 'utf8');

  content = content.replace(/[\n\s]*const authFetch = async \(url: string, options: any = \{\}\) => \{[\s\S]*?return globalThis\.fetch\(url, \{ \.\.\.options, headers \}\);\s*\};\s*/g, '\n');

  if (!content.includes('../services/authFetch')) {
      content = "import { authFetch } from '../services/authFetch';\n" + content;
  }

  fs.writeFileSync(p, content);
  console.log('Fixed ' + file);
}
