const { Client } = require('pg');

async function main() {
  const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:1@localhost:5432/postgres';
  const client = new Client({ connectionString });

  try {
    await client.connect();
    await client.query('CREATE EXTENSION IF NOT EXISTS vector;');
    const result = await client.query("SELECT extname FROM pg_extension WHERE extname = 'vector';");
    console.log('VECTOR_EXTENSION_INSTALLED', result.rowCount === 1);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('EXTENSION_ERROR', message);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

void main();
