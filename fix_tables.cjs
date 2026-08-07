const fs = require('fs');
let content = fs.readFileSync('adms-sync/server.js', 'utf8');

const updated = content.replace(/'procurement', 'purchase_orders', 'documents'/, "'procurement', 'purchase_orders', 'documents', 'export_certificates', 'export_containers', 'export_shipments'");

fs.writeFileSync('adms-sync/server.js', updated, 'utf8');
console.log('Updated ALLOWED_FALLBACK_TABLES');
