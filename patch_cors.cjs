const fs = require('fs');
let content = fs.readFileSync('/var/www/adms-sync/server.js', 'utf8');

if (!content.includes("'https://erp.shastikaglobalexport.co.in'")) {
  content = content.replace(
    /const allowedOrigins = \[/g,
    "const allowedOrigins = [\n  'https://erp.shastikaglobalexport.co.in',"
  );
  fs.writeFileSync('/var/www/adms-sync/server.js', content, 'utf8');
  console.log("CORS updated");
} else {
  console.log("CORS already fine");
}
