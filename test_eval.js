
const fs = require('fs');
let code = fs.readFileSync('./frontend/public/plivo.min.js', 'utf8');

global.window = global;
global.document = { createElement: () => ({ id: '' }), getElementById: () => null, body: { appendChild: () => {} } };
global.navigator = { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36', mediaDevices: { ondevicechange: null } };
global.chrome = { storage: { local: {} } };

eval(code);

console.log('window.Plivo:', typeof window.Plivo);
try {
    const client = new window.Plivo({ debug: 'OFF' });
    console.log('client created successfully!');
    console.log('client.emit:', typeof client.emit);
    console.log('client.on:', typeof client.on);
} catch (e) {
    console.log('Error instantiating:', e.message);
}
