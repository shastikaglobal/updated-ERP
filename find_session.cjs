const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      results.push(file);
    }
  });
  return results;
}

const files = walk('./src');
const issues = [];
files.forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  if (content.match(/\bsession\b/)) {
    // Check if session is defined in the file
    // Look for const { session } = useAuth() or const session =
    const hasSessionDestructure = content.includes('const { session }') || content.includes('const {session}') || content.includes('const { session,') || content.includes('const {user, session}');
    const hasSessionArg = content.match(/\(\s*\{[^}]*session[^}]*\}\s*\)/) || content.match(/\bsession\s*:/);
    
    if (!hasSessionDestructure && !hasSessionArg && !content.includes('import') && !content.includes('export')) {
        // Just print everything that has session but no obvious destructuring
    }
    
    if (!hasSessionDestructure) {
        issues.push(f);
    }
  }
});
console.log(issues.join('\n'));
