const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function fixConstraint() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5433'),
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || '1',
    database: process.env.DB_DATABASE || 'postgres',
  });

  try {
    await client.connect();
    console.log('Connected to DB');

    // 1. Check current constraint configuration
    const checkRes = await client.query(`
      SELECT 
        conname, 
        confdeltype 
      FROM 
        pg_constraint 
      WHERE 
        conname = 'FK_5a75fa80185b70220d02ffd547d';
    `);

    if (checkRes.rows.length === 0) {
      console.log('Constraint FK_5a75fa80185b70220d02ffd547d not found. It might have been updated already or has a different name.');
      return;
    }

    const { conname, confdeltype } = checkRes.rows[0];
    console.log(`Found constraint "${conname}" with confdeltype: "${confdeltype}"`);
    // 'a' = no action, 'r' = restrict, 'c' = cascade, 'n' = set null, 'd' = set default

    if (confdeltype === 'c') {
      console.log('Constraint is already configured with ON DELETE CASCADE!');
      return;
    }

    console.log('Updating constraint to ON DELETE CASCADE...');
    await client.query(`
      ALTER TABLE chat_messages 
      DROP CONSTRAINT "FK_5a75fa80185b70220d02ffd547d",
      ADD CONSTRAINT "FK_5a75fa80185b70220d02ffd547d" 
      FOREIGN KEY (document_id) 
      REFERENCES documents(id) 
      ON DELETE CASCADE;
    `);
    console.log('Successfully updated constraint to ON DELETE CASCADE!');

  } catch (err) {
    console.error('Error during constraint update:', err);
  } finally {
    await client.end();
  }
}

fixConstraint();
