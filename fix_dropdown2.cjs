const fs = require('fs');
const file = 'src/pages/farmers/GoodsCollection.tsx';
let content = fs.readFileSync(file, 'utf8');

const regex = /<select[\s\S]*?<option value="">-- Link Contract --<\/option>[\s\S]*?<\/select>/m;

if (regex.test(content)) {
  content = content.replace(regex, `<Input 
                      className="bg-[#1a1a1a] border-[#2a2a2a] h-10 w-full rounded-md px-3 py-2 text-sm"
                      placeholder="Enter Contract ID manually..."
                      value={formData.contract_id || ''}
                      onChange={(e) => setFormData(f => ({ ...f, contract_id: e.target.value }))}
                    />`);
  fs.writeFileSync(file, content, 'utf8');
  console.log('Replaced successfully');
} else {
  console.log('Regex did not match');
}
