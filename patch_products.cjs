const fs = require('fs');
const filePath = '/var/www/adms-sync/routes/products.js';
let content = fs.readFileSync(filePath, 'utf8');

const targetStr = "const data = req.body;";
const debugCode = `
console.log("========== PRODUCT CREATE DEBUG ==========");
console.log("REQ BODY:", req.body);
console.log("IS ARRAY:", Array.isArray(req.body));
console.log("BODY TYPE:", typeof req.body);
console.log("BODY KEYS:", Object.keys(req.body || {}));
console.log("BODY VALUES:", Object.values(req.body || {}));
console.log("==========================================");
`;

const lines = content.split('\n');
let modified = false;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("router.post('/products'") || lines[i].includes("router.post('/')")) {
    for (let j = i; j < lines.length; j++) {
      if (lines[j].includes(targetStr)) {
        lines.splice(j + 1, 0, debugCode);
        modified = true;
        break;
      }
    }
    if (modified) break;
  }
}

if (modified) {
  fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
  console.log("Successfully patched " + filePath);
} else {
  console.log("Could not find the target string.");
}
