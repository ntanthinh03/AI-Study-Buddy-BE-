import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function checkDb() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || '1',
    database: process.env.DB_DATABASE || 'postgres',
  });

  try {
    await client.connect();
    console.log('Connected to DB');

    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    console.log('Tables:', tablesRes.rows.map(r => r.table_name));

    const quizzesCount = await client.query('SELECT COUNT(*) FROM quizzes');
    console.log('Quizzes count:', quizzesCount.rows[0].count);

    const chatArtifactsCount = await client.query("SELECT COUNT(*) FROM chat_messages WHERE message_type = 'ARTIFACT' AND artifact_type = 'QUIZ'");
    console.log('Chat artifact quizzes count:', chatArtifactsCount.rows[0].count);

    const learningLessonsCount = await client.query("SELECT COUNT(*) FROM learning_lessons WHERE quiz_json IS NOT NULL");
    console.log('Lessons with quiz count:', learningLessonsCount.rows[0].count);

    if (quizzesCount.rows[0].count === '0') {
      console.log('\n--- SAMPLE ROW FROM CHAT_MESSAGES (QUIZ ARTIFACT) ---');
      const sampleArtifact = await client.query("SELECT id, artifact_json FROM chat_messages WHERE message_type = 'ARTIFACT' AND artifact_type = 'QUIZ' LIMIT 1");
      console.log(JSON.stringify(sampleArtifact.rows[0], null, 2));
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

checkDb();
