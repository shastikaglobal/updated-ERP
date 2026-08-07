const fs = require('fs');

let content = fs.readFileSync('src/pages/shipments/CreateShipment.tsx', 'utf8');

const regex = /const totalWeight = Number\(selectedOrder\?\.quantity\) \|\| 0;\s*const count = parseInt\(containerCount\) \|\| 1;\s*const weightPerContainer = totalWeight \/ count;/g;

content = content.replace(regex, `const totalWeight = Number(selectedOrder?.quantity) || 0;
      const count = parseInt(containerCount) || 1;
      
      if (count > 50) {
        setSaving(false);
        return toast.error('Maximum 50 containers allowed per shipment. Please check the container count input.');
      }
      
      const weightPerContainer = totalWeight / count;`);

fs.writeFileSync('src/pages/shipments/CreateShipment.tsx', content, 'utf8');
console.log("Fixed count");
