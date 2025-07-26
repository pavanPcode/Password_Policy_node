const express = require('express');
const net = require('net');

const app = express();
app.use(express.json());

app.get('/api/printLabel', (req, res) => {
  const { ip, barcode_number, label_text } = req.query;

  if (!ip || !barcode_number || !label_text) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }

  const zpl = `
^XA
^FO50,30^ADN,36,20^FD${label_text}^FS
^FO50,80^BY2
^BCN,100,Y,N,N
^FD${barcode_number}^FS
^XZ
`;

  const client = new net.Socket();

  client.connect(9100, ip, () => {
    client.write(zpl);
    client.end();
    res.json({ success: true, message: '✅ ZPL print job sent successfully.' });
  });

  client.on('error', (err) => {
    res.status(500).json({ success: false, message: '❌ Failed to print', error: err.message });
  });
});

// Start the server
app.listen(8080, () => {
  console.log('🖨️ Print API running on http://localhost:8080/api/printLabel');
});
