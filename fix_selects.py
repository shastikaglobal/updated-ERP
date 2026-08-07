import re

def update_file(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Regex to match the Select component for warehouse
        pattern = re.compile(
            r'([ \t]*)<Select\s+value=\{formState\.warehouse\}\s+onValueChange=\{\(val\) => setFormState\(\(prev\) => \(\{ \.\.\.prev, warehouse: val \}\)\)\}\s*>\s*<SelectTrigger>\s*<SelectValue placeholder="[^"]+" />\s*</SelectTrigger>\s*<SelectContent>\s*\{warehouses\.length === 0 \? \(\s*<div className="[^"]+">No warehouses available</div>\s*\) : \(\s*warehouses\.map\(\(w: any\) => \(\s*<SelectItem key=\{w\.id\} value=\{[^\}]+\}>[^<]+</SelectItem>\s*\)\)\s*\)\}\s*</SelectContent>\s*</Select>',
            re.MULTILINE
        )
        
        def replace_match(match):
            indent = match.group(1)
            return (
                indent + '<div className="flex flex-col gap-2">\n' +
                indent + '  <Input\n' +
                indent + '    placeholder="Type or select warehouse..."\n' +
                indent + '    value={formState.warehouse}\n' +
                indent + '    onChange={(e) => setFormState((prev) => ({ ...prev, warehouse: e.target.value }))}\n' +
                indent + '    list="warehouse-options"\n' +
                indent + '  />\n' +
                indent + '  <datalist id="warehouse-options">\n' +
                indent + '    {warehouses.map((warehouse: any) => (\n' +
                indent + '      <option key={warehouse.id} value={warehouse.name}>\n' +
                indent + '        {[warehouse.location, warehouse.city].filter(Boolean).join(", ")}\n' +
                indent + '      </option>\n' +
                indent + '    ))}\n' +
                indent + '  </datalist>\n' +
                indent + '</div>'
            )
            
        new_content, count = pattern.subn(replace_match, content)
        
        if count > 0:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f"Updated {filepath} ({count} replacements)")
        else:
            print(f"No match found in {filepath}")
    except Exception as e:
        print(f"Error processing {filepath}: {e}")

update_file('src/pages/inventory/DamagedStockManagement.tsx')
update_file('src/pages/inventory/ExpiryMonitoring.tsx')
update_file('src/pages/inventory/BatchWiseStock.tsx')
