const { Client } = require('pg');
const client = new Client({ user: 'postgres', password: '1', host: 'localhost', port: 5433, database: 'postgres' });
client.connect().then(() => client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'")).then(res => { console.log(res.rows.map(r => r.table_name).join(', ')); process.exit(0); });
