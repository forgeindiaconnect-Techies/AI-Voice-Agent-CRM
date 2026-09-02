
const fs = require('fs');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;

const html = '<!DOCTYPE html><html><head></head><body><script>' + fs.readFileSync('frontend/public/plivo.min.js', 'utf8') + '</script></body></html>';
const dom = new JSDOM(html, { runScripts: 'dangerously', resources: 'usable' });
const window = dom.window;

console.log('window.Plivo:', typeof window.Plivo);
if (window.Plivo) {
    const client = new window.Plivo({ debug: 'OFF' });
    console.log('client instance created:', typeof client);
    console.log('typeof client.on:', typeof client.on);
    console.log('typeof client.client:', typeof client.client);
    console.log('client keys:', Object.keys(client));
    console.log('client prototype keys:', Object.getOwnPropertyNames(Object.getPrototypeOf(client)));
}
