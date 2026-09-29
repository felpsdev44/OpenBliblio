// Conexão com o PostgreSQL. Host, porta, usuário, senha e banco vêm do .env.
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Uma ligação só, reaproveitada pelas rotas.
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
});

pool.connect((err, client, release) => {
  if (err) {
    return console.error('❌ Erro ao conectar no PostgreSQL:', err.stack);
  }
  console.log('✅ Conectado com sucesso ao PostgreSQL!');
  release();
});

export default pool;