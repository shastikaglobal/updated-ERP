fetch('http://127.0.0.1:8082/api/farmers/contracts', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    id: 'test1',
    farmer_id: 'test',
    contract_number: '123',
    crop_name: 'test',
    agreed_quantity: 1,
    agreed_price: 1,
    start_date: '2024-01-01',
    end_date: '2024-12-31',
    status: 'Draft',
    document_url: ''
  })
}).then(r => r.text()).then(console.log);
