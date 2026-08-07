const fs = require('fs');
const path = require('path');

function processDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDir(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts') || fullPath.endsWith('.jsx')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      
      // Look for session?.access_token usage
      if (content.includes('session?.access_token')) {
        // Check if session is defined in useAuth()
        const useAuthMatch = content.match(/const\s+\{([^}]+)\}\s*=\s*useAuth\(\)/);
        
        if (useAuthMatch) {
          const destructured = useAuthMatch[1].split(',').map(s => s.trim());
          if (!destructured.includes('session')) {
            console.log('Needs fixing:', fullPath);
            const newContent = content.replace(useAuthMatch[0], `const { ${destructured.join(', ')}, session } = useAuth()`);
            fs.writeFileSync(fullPath, newContent, 'utf8');
          }
        } else {
            // it might be using session but not even calling useAuth. Or calling it in a different way.
            if (!content.includes('session =')) {
                console.log('Needs fixing but useAuth match failed:', fullPath);
            }
        }
      }
    }
  }
}

processDir('src');
