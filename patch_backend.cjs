const fs = require('fs');

function patchFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Replace cookie settings to hardcode secure: true and sameSite: 'none'
  content = content.replace(/secure:\s*process\.env\.NODE_ENV === 'production',/g, 'secure: true,');
  content = content.replace(/sameSite:\s*process\.env\.NODE_ENV === 'production' \? 'none' : 'lax',/g, "sameSite: 'none',");
  
  // Replace the refresh token lax sameSite too
  content = content.replace(/sameSite:\s*'lax'/g, "sameSite: 'none'");
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Patched ${filePath}`);
}

patchFile('/var/www/adms-sync/routes/auth.js');
patchFile('/var/www/adms-sync/server.js');
