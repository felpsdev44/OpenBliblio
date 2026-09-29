// Grava uma cópia diária dos dados em JSON. A senha não entra nesse arquivo.
import fs from "fs";
import path from "path";
import pool from "./db.js";

// Copia usuários, obras e sugestões. senha_hash fica de fora de propósito.
export async function backupDiario() {
  const pasta = path.resolve("backups");
  fs.mkdirSync(pasta, { recursive: true });
  const dia = new Date().toISOString().slice(0, 10);
  const arquivo = path.join(pasta, `bliblioteca-${dia}.json`);
  // O arquivo do dia já existe: não gera outra cópia.
  if (fs.existsSync(arquivo)) return;

  const tabelas = ["usuarios", "obras", "sugestoes"];
  const dados = {};
  for (const tabela of tabelas) {
    const colunas = await pool.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1
       ORDER BY ordinal_position`,
      [tabela],
    );
    const nomes = colunas.rows
      .map((coluna) => coluna.column_name)
      .filter((nome) => nome !== "senha_hash");
    const lista = nomes.map((nome) => `"${nome}"`).join(", ");
    const resultado = await pool.query(`SELECT ${lista} FROM "${tabela}"`);
    dados[tabela] = resultado.rows;
  }
  fs.writeFileSync(arquivo, JSON.stringify(dados));
  console.log(`Backup diário salvo em ${arquivo}`);
}

// Roda ao ligar o servidor e depois de hora em hora.
export function agendarBackup() {
  const rodar = async () => {
    try {
      await backupDiario();
    } catch (error) {
      console.error("Falha no backup diário:", error);
    }
  };
  rodar();
  setInterval(rodar, 60 * 60 * 1000);
}
