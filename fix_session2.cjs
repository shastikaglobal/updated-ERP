const fs = require('fs');

try {
  let p = fs.readFileSync('src/lib/packing-service.ts', 'utf8');
  p = p.replace(/if\s*\(session\?\.access_token\)\s*\{\s*headers\['Authorization'\]\s*=\s*`Bearer \$\{session\.access_token\}`;?\s*\}/g, '');
  fs.writeFileSync('src/lib/packing-service.ts', p, 'utf8');
  
  let q = fs.readFileSync('src/pages/quotations/QuotationReport.tsx', 'utf8');
  q = q.replace(/\{ headers: \{ Authorization: `Bearer \$\{session\?\.access_token \}` \}\s*\}/g, '{}');
  fs.writeFileSync('src/pages/quotations/QuotationReport.tsx', q, 'utf8');
  
  console.log('Fixed packing-service.ts and QuotationReport.tsx');
} catch (e) {
  console.error(e);
}
