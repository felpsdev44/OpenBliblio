// Servidor da Biblioteca Pública Virtual.
// As rotas, as regras de acesso e as consultas ao banco ficam neste arquivo.
import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import nodemailer from "nodemailer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pool from "./db.js";
import { cpfValido, somenteDigitos } from "./cpf.js";
import { agendarBackup } from "./backup.js";

// Transforma o token em hash. No banco fica o hash; o token original fica no navegador.
function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// Abre uma sessão de 8 horas e devolve o token para o site guardar.
async function criarSessao(usuarioId) {
  const token = crypto.randomBytes(32).toString("hex");
  await pool.query(
    `INSERT INTO sessoes (usuario_id, token_hash, expira_em)
     VALUES ($1, $2, now() + interval '8 hours')`,
    [usuarioId, hashToken(token)],
  );
  return token;
}

// O que o site pode receber depois do login. A senha não sai do servidor.
function dadosPublicos(usuario) {
  return {
    id: usuario.id,
    nome: usuario.nome_completo,
    email: usuario.email,
    perfil: usuario.perfil,
  };
}

// Exige login. Recusa token ausente, sessão vencida e conta inativa.
async function autenticar(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";

  if (!token) {
    return res.status(401).json({ erro: "Faça login para continuar." });
  }

  try {
    const result = await pool.query(
      `SELECT u.id, u.nome_completo, u.email, u.perfil, COALESCE(u.ativo, true) AS ativo,
              s.expira_em
       FROM sessoes s
       JOIN usuarios u ON u.id = s.usuario_id
       WHERE s.token_hash = $1`,
      [hashToken(token)],
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ erro: "Sessão inválida. Entre novamente." });
    }

    if (new Date(result.rows[0].expira_em) <= new Date()) {
      await pool.query("DELETE FROM sessoes WHERE token_hash = $1", [hashToken(token)]);
      return res.status(401).json({ erro: "Sessão expirada. Entre novamente." });
    }

    if (result.rows[0].ativo === false) {
      return res.status(403).json({ erro: "Cadastro inativo. Este leitor está bloqueado." });
    }

    req.usuario = result.rows[0];
    next();
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: "Erro ao validar a sessão." });
  }
}

// E-mail reservado. Um cadastro novo não pode usar este endereço.
const EMAIL_ADMIN = "felipe@gmail.com";

// Compara sem ligar para maiúscula ou minúscula.
function emailDoAdmin(email) {
  return String(email || "").trim().toLowerCase() === EMAIL_ADMIN;
}

// Deixa passar só quem tem o perfil admin_master.
function somenteAdminMaster(req, res, next) {
  if (req.usuario.perfil !== "admin_master") {
    return res.status(403).json({ erro: "Apenas o Admin Master pode fazer esta operação." });
  }
  next();
}

// O app é criado antes das rotas. A capa fica pública; o PDF não.
const app = express();

const pastaCapas = path.join(path.dirname(fileURLToPath(import.meta.url)), "capas");
const pastaPdfs = path.join(path.dirname(fileURLToPath(import.meta.url)), "pdfs");
const LIMITE_CAPA = 1_500_000;
const LIMITE_PDF = 15_000_000;

app.use(cors());
app.use(express.json({ limit: "3mb" }));
app.use("/capas", express.static(pastaCapas));

// Cria a conta. O perfil gravado é sempre leitor, mesmo que o site mande outro.
app.post("/api/cadastro", async (req, res) => {
  const { nome_completo, cpf, data_nascimento, email, senha } = req.body;
  const cpfNumeros = somenteDigitos(cpf);

  if (!cpfValido(cpfNumeros)) {
    return res.status(400).json({ erro: "CPF inválido." });
  }

  const nome = String(nome_completo || "").trim();
  const emailLimpo = String(email || "").trim();
  const nascimento = String(data_nascimento || "").trim();
  const senhaLimpa = String(senha || "");

  if (!nome || !emailLimpo || !nascimento) {
    return res.status(400).json({ erro: "Preencha nome, e-mail e data de nascimento." });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLimpo)) {
    return res.status(400).json({ erro: "Informe um e-mail válido." });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(nascimento) || Number.isNaN(Date.parse(`${nascimento}T00:00:00`))) {
    return res.status(400).json({ erro: "Informe uma data de nascimento válida." });
  }
  if (nascimento > new Date().toISOString().slice(0, 10)) {
    return res.status(400).json({ erro: "A data de nascimento não pode ser no futuro." });
  }
  if (senhaLimpa.trim().length < 6) {
    return res.status(400).json({ erro: "A senha deve ter pelo menos 6 caracteres." });
  }
  if (emailDoAdmin(emailLimpo)) {
    return res.status(400).json({ erro: "Já existe um usuário com este e-mail." });
  }

  try {
    const emailEmUso = await pool.query(
      "SELECT 1 FROM usuarios WHERE lower(email) = lower($1)",
      [emailLimpo],
    );
    if (emailEmUso.rows.length > 0) {
      return res.status(400).json({ erro: "Já existe um usuário com este e-mail." });
    }

    const senha_hash = await bcrypt.hash(senhaLimpa, 10);

    const query = `
      INSERT INTO usuarios (nome_completo, cpf, data_nascimento, email, senha_hash)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, nome_completo, email, perfil;
    `;

    const novoUsuario = await pool.query(query, [
      nome,
      cpfNumeros,
      nascimento,
      emailLimpo,
      senha_hash,
    ]);

    res.status(201).json({
      mensagem: "Usuário cadastrado com sucesso!",
      usuario: novoUsuario.rows[0],
    });
  } catch (error) {
    console.error(error);
    if (error.code === "23505") {
      return res.status(400).json({ erro: "CPF ou E-mail já cadastrado." });
    }
    res.status(500).json({ erro: "Erro interno ao cadastrar usuário." });
  }
});

// Entra com e-mail e senha. Maiúsculas no e-mail não importam.
app.post("/api/login", async (req, res) => {
  const email = String(req.body.email || "").trim();
  const senha = String(req.body.senha || "");

  try {
    const result = await pool.query(
      "SELECT * FROM usuarios WHERE lower(email) = lower($1)",
      [email],
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ erro: "E-mail ou senha incorretos." });
    }

    const usuario = result.rows[0];
    const senhaValida = await bcrypt.compare(senha, usuario.senha_hash);

    if (!senhaValida) {
      return res.status(401).json({ erro: "E-mail ou senha incorretos." });
    }

    if (usuario.ativo === false) {
      return res.status(403).json({
        erro: "Cadastro inativo. Este leitor está bloqueado e não pode entrar.",
      });
    }

    const token = await criarSessao(usuario.id);

    res.json({
      mensagem: "Login realizado com sucesso!",
      token,
      usuario: dadosPublicos(usuario),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: "Erro ao realizar login." });
  }
});

const MENSAGEM_CODIGO =
  "Se o e-mail estiver cadastrado, enviamos um código. Ele vale por 15 minutos.";

// Sem usuário e senha de e-mail no .env, o código não é enviado.
function emailConfigurado() {
  return Boolean(process.env.MAIL_USER && process.env.MAIL_PASS);
}

// Manda o código de 6 dígitos pelo Gmail.
async function enviarCodigoSenha(destino, codigo) {
  const transporte = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    },
  });
  await transporte.sendMail({
    from: `"Biblioteca Pública Virtual" <${process.env.MAIL_USER}>`,
    to: destino,
    subject: "Código para redefinir a senha",
    text: `Seu código de redefinição é ${codigo}. Ele vale por 15 minutos. Se você não pediu essa troca, ignore este e-mail.`,
  });
}

// Pede o código por e-mail. Conta inexistente ou inativa recebe a mesma resposta, sem envio.
app.post("/api/esqueci-senha", async (req, res) => {
  const email = String(req.body.email || "").trim();
  if (!email) {
    return res.status(400).json({ erro: "Informe o e-mail." });
  }
  if (!emailConfigurado()) {
    return res.status(503).json({ erro: "O envio de e-mail ainda não está configurado." });
  }

  try {
    const usuario = await pool.query(
      `SELECT id, email FROM usuarios
       WHERE lower(email) = lower($1) AND COALESCE(ativo, true) = true`,
      [email],
    );
    if (usuario.rows.length === 0) {
      return res.json({ mensagem: MENSAGEM_CODIGO });
    }

    const conta = usuario.rows[0];
    const recente = await pool.query(
      `SELECT 1 FROM codigos_senha
       WHERE usuario_id = $1 AND criado_em > now() - interval '1 minute'`,
      [conta.id],
    );
    if (recente.rows.length > 0) {
      return res.json({ mensagem: MENSAGEM_CODIGO });
    }

    const codigo = String(crypto.randomInt(100000, 1000000));
    await pool.query("DELETE FROM codigos_senha WHERE usuario_id = $1", [conta.id]);
    await pool.query(
      `INSERT INTO codigos_senha (usuario_id, codigo_hash, expira_em)
       VALUES ($1, $2, now() + interval '15 minutes')`,
      [conta.id, hashToken(codigo)],
    );
    await enviarCodigoSenha(conta.email, codigo);
    res.json({ mensagem: MENSAGEM_CODIGO });
  } catch (error) {
    console.error("Erro ao enviar código de senha:", error);
    res.status(500).json({ erro: "Não foi possível enviar o código." });
  }
});

// Troca a senha se o código ainda vale. As sessões antigas dessa conta são apagadas.
app.post("/api/redefinir-senha", async (req, res) => {
  const email = String(req.body.email || "").trim();
  const codigo = String(req.body.codigo || "").replace(/\D/g, "");
  const novaSenha = String(req.body.novaSenha || "");

  if (!email || codigo.length !== 6 || novaSenha.trim().length < 6) {
    return res.status(400).json({ erro: "Informe o e-mail, o código de 6 dígitos e uma senha com pelo menos 6 caracteres." });
  }

  try {
    const usuario = await pool.query(
      `SELECT id FROM usuarios
       WHERE lower(email) = lower($1) AND COALESCE(ativo, true) = true`,
      [email],
    );
    if (usuario.rows.length === 0) {
      return res.status(400).json({ erro: "Código inválido ou vencido." });
    }

    const usuarioId = usuario.rows[0].id;
    const salvo = await pool.query(
      `SELECT id FROM codigos_senha
       WHERE usuario_id = $1 AND codigo_hash = $2 AND expira_em > now()`,
      [usuarioId, hashToken(codigo)],
    );
    if (salvo.rows.length === 0) {
      return res.status(400).json({ erro: "Código inválido ou vencido." });
    }

    const novaSenhaHash = await bcrypt.hash(novaSenha, 10);
    await pool.query("UPDATE usuarios SET senha_hash = $1 WHERE id = $2", [novaSenhaHash, usuarioId]);
    await pool.query("DELETE FROM codigos_senha WHERE usuario_id = $1", [usuarioId]);
    await pool.query("DELETE FROM sessoes WHERE usuario_id = $1", [usuarioId]);
    res.json({ mensagem: "Senha alterada com sucesso! Faça login com a nova senha." });
  } catch (error) {
    console.error("Erro ao redefinir senha:", error);
    res.status(500).json({ erro: "Erro interno ao redefinir a senha." });
  }
});

// O site chama isso ao abrir, para saber se o token ainda vale.
app.get("/api/eu", autenticar, (req, res) => {
  res.json({ usuario: dadosPublicos(req.usuario) });
});

// Sai da conta. Apaga só a sessão deste token.
app.delete("/api/sessao", autenticar, async (req, res) => {
  const token = req.headers.authorization.slice(7);
  await pool.query("DELETE FROM sessoes WHERE token_hash = $1", [hashToken(token)]);
  res.json({ mensagem: "Sessão encerrada." });
});

// Lista de leitores. Só o admin chega nesta rota.
app.get("/api/leitores", autenticar, somenteAdminMaster, async (req, res) => {
  try {
    const lista = await pool.query(
      `SELECT id, nome_completo, cpf, email,
              to_char(data_nascimento, 'YYYY-MM-DD') AS data_nascimento,
              COALESCE(ativo, true) AS ativo, perfil,
              to_char(criado_em, 'DD/MM/YYYY') AS criado_em
       FROM usuarios
       ORDER BY nome_completo`,
    );
    res.json({ leitores: lista.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: "Erro ao listar os leitores." });
  }
});

// RF003: cada pessoa vê o próprio perfil. O admin pode abrir qualquer leitor.
app.get("/api/leitores/:id", autenticar, async (req, res) => {
  const proprio = req.usuario.id === req.params.id;
  if (!proprio && req.usuario.perfil !== "admin_master") {
    return res.status(403).json({ erro: "Você só pode ver o próprio perfil." });
  }

  try {
    const result = await pool.query(
      `SELECT id, nome_completo, cpf,
              to_char(data_nascimento, 'YYYY-MM-DD') AS data_nascimento,
              email, COALESCE(ativo, true) AS ativo, perfil,
              to_char(criado_em, 'DD/MM/YYYY') AS criado_em
       FROM usuarios WHERE id = $1`,
      [req.params.id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ erro: "Leitor não encontrado." });
    }

    res.json({ leitor: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: "Erro ao carregar o perfil do leitor." });
  }
});

// RF004: atualiza nome, CPF, nascimento e e-mail. O perfil não muda por aqui.
app.put("/api/leitores/:id", autenticar, async (req, res) => {
  const proprio = req.usuario.id === req.params.id;
  if (!proprio && req.usuario.perfil !== "admin_master") {
    return res.status(403).json({ erro: "Você só pode atualizar o próprio cadastro." });
  }

  const { nome_completo, cpf, data_nascimento, email } = req.body;
  const cpfNumeros = somenteDigitos(cpf);

  if (!nome_completo?.trim() || !email?.trim() || !data_nascimento) {
    return res.status(400).json({ erro: "Preencha nome, e-mail e data de nascimento." });
  }

  if (!cpfValido(cpfNumeros)) {
    return res.status(400).json({ erro: "CPF inválido." });
  }

  const emailLimpo = email.trim();
  if (emailDoAdmin(emailLimpo)) {
    const dono = await pool.query(
      "SELECT id FROM usuarios WHERE lower(email) = lower($1)",
      [EMAIL_ADMIN],
    );
    if (dono.rows.length === 0 || String(dono.rows[0].id) !== String(req.params.id)) {
      return res.status(400).json({ erro: "Já existe um usuário com este e-mail." });
    }
  }

  try {
    const atualizado = await pool.query(
      `UPDATE usuarios
       SET nome_completo = $1, cpf = $2, data_nascimento = $3, email = $4
       WHERE id = $5
       RETURNING id, nome_completo, cpf,
                 to_char(data_nascimento, 'YYYY-MM-DD') AS data_nascimento,
                 email, COALESCE(ativo, true) AS ativo, perfil,
                 to_char(criado_em, 'DD/MM/YYYY') AS criado_em`,
      [nome_completo.trim(), cpfNumeros, data_nascimento, emailLimpo, req.params.id],
    );

    if (atualizado.rows.length === 0) {
      return res.status(404).json({ erro: "Leitor não encontrado." });
    }

    res.json({
      mensagem: "Dados do leitor atualizados com sucesso!",
      leitor: atualizado.rows[0],
    });
  } catch (error) {
    console.error(error);
    if (error.code === "23505") {
      return res.status(400).json({ erro: "CPF ou e-mail já cadastrado para outro leitor." });
    }
    res.status(500).json({ erro: "Erro ao atualizar o leitor." });
  }
});

// RF005: só o admin muda o status. A própria conta do admin não pode ser inativada.
app.patch("/api/leitores/:id/status", autenticar, somenteAdminMaster, async (req, res) => {
  if (req.usuario.id === req.params.id && req.body.ativo === false) {
    return res.status(400).json({ erro: "O Admin Master não pode inativar a própria conta." });
  }

  const ativo = req.body.ativo;

  if (typeof ativo !== "boolean") {
    return res.status(400).json({ erro: "Informe se o leitor deve ficar ativo ou inativo." });
  }

  try {
    const atualizado = await pool.query(
      `UPDATE usuarios SET ativo = $1 WHERE id = $2
       RETURNING id, nome_completo, COALESCE(ativo, true) AS ativo`,
      [ativo, req.params.id],
    );

    if (atualizado.rows.length === 0) {
      return res.status(404).json({ erro: "Leitor não encontrado." });
    }

    // Quem foi inativado perde a sessão aberta na hora.
    if (ativo === false) {
      await pool.query("DELETE FROM sessoes WHERE usuario_id = $1", [req.params.id]);
    }

    res.json({
      mensagem: ativo
        ? "Cadastro do leitor reativado."
        : "Cadastro do leitor inativado. O acesso foi bloqueado.",
      leitor: atualizado.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: "Erro ao alterar o status do leitor." });
  }
});

// Título, autor e categoria são obrigatórios. Descrição, capa e PDF não são.
function validarObra({ titulo, autor, categoria }) {
  if (!titulo?.trim() || !autor?.trim() || !categoria?.trim()) {
    return "Preencha título, autor e categoria.";
  }
  return null;
}

// Apaga o arquivo da capa no disco quando ela é trocada ou a obra sai do acervo.
function apagarArquivoCapa(capa) {
  if (!capa || !String(capa).startsWith("/capas/")) return;
  const arquivo = path.join(pastaCapas, path.basename(capa));
  if (fs.existsSync(arquivo)) fs.unlinkSync(arquivo);
}

// Olha os primeiros bytes para não aceitar um arquivo renomeado como imagem.
function imagemValida(buffer, tipo) {
  if (tipo === "png") return buffer[0] === 0x89 && buffer[1] === 0x50;
  if (tipo === "jpeg") return buffer[0] === 0xff && buffer[1] === 0xd8;
  if (tipo === "webp") {
    return buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP";
  }
  return false;
}

// Salva a capa em disco e devolve o caminho. Aceita JPG, PNG ou WebP de até 1,5 MB.
function guardarCapa(dataUrl) {
  const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=\r\n]+)$/.exec(String(dataUrl || "").trim());
  if (!match) return { erro: "A capa precisa ser uma imagem JPG, PNG ou WebP." };
  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length || buffer.length > LIMITE_CAPA || !imagemValida(buffer, match[1])) {
    return { erro: "Envie uma imagem JPG, PNG ou WebP de até 1,5 MB." };
  }
  fs.mkdirSync(pastaCapas, { recursive: true });
  const ext = match[1] === "jpeg" ? "jpg" : match[1];
  const nome = `${crypto.randomUUID()}.${ext}`;
  fs.writeFileSync(path.join(pastaCapas, nome), buffer);
  return { capa: `/capas/${nome}` };
}

// Apaga o PDF do disco. A pasta pdfs não é pública.
function apagarArquivoPdf(pdf) {
  if (!pdf || !String(pdf).startsWith("/pdfs/")) return;
  const arquivo = path.join(pastaPdfs, path.basename(pdf));
  if (fs.existsSync(arquivo)) fs.unlinkSync(arquivo);
}

// Salva o PDF fora da pasta pública. O arquivo só sai pela rota autenticada.
function guardarPdf(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length > LIMITE_PDF) {
    return { erro: "Envie um PDF de até 15 MB." };
  }
  const inicio = buffer.subarray(0, Math.min(buffer.length, 1024)).toString("latin1");
  if (!inicio.includes("%PDF-")) return { erro: "O arquivo enviado não é um PDF." };
  fs.mkdirSync(pastaPdfs, { recursive: true });
  const nome = `${crypto.randomUUID()}.pdf`;
  fs.writeFileSync(path.join(pastaPdfs, nome), buffer);
  return { pdf: `/pdfs/${nome}` };
}

const obraSelect = `
  id, titulo, autor, categoria, situacao, capa, descricao,
  (pdf IS NOT NULL) AS tem_pdf,
  to_char(criado_em, 'DD/MM/YYYY') AS criado_em
`;

// RF006: só o admin cadastra obra. A quantidade fica 1 porque a tela não usa esse campo.
app.post("/api/obras", autenticar, somenteAdminMaster, async (req, res) => {
  const erro = validarObra(req.body);
  if (erro) return res.status(400).json({ erro });

  const { titulo, autor, categoria } = req.body;
  const descricao = String(req.body.descricao || "").trim() || null;
  let capa = null;
  if (req.body.capa) {
    const salva = guardarCapa(req.body.capa);
    if (salva.erro) return res.status(400).json({ erro: salva.erro });
    capa = salva.capa;
  }
  try {
    const criada = await pool.query(
      `INSERT INTO obras (titulo, autor, categoria, quantidade, capa, descricao)
       VALUES ($1, $2, $3, 1, $4, $5)
       RETURNING ${obraSelect}`,
      [titulo.trim(), autor.trim(), categoria.trim(), capa, descricao],
    );
    res.status(201).json({
      mensagem: "Obra cadastrada com sucesso!",
      obra: criada.rows[0],
    });
  } catch (error) {
    apagarArquivoCapa(capa);
    console.error(error);
    res.status(500).json({ erro: "Erro ao cadastrar a obra." });
  }
});

// Usado para saber se o servidor e o banco estão respondendo.
app.get("/api/saude", async (req, res) => {
  const inicio = Date.now();
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", banco: "conectado", tempoMs: Date.now() - inicio });
  } catch (error) {
    console.error(error);
    res.status(503).json({ status: "indisponivel", banco: "erro" });
  }
});

// Resumo da API, sem precisar estar logado.
app.get("/api", (req, res) => {
  res.json({
    nome: "Biblioteca Pública Virtual",
    versao: "1.0",
    recursos: [
      "/api/saude",
      "/api/cadastro",
      "/api/login",
      "/api/obras",
      "/api/leitores",
      "/api/sugestoes",
      "/api/minhas-sugestoes",
      "/api/relatorio",
    ],
  });
});

// Lista só obras ativas. A busca olha título, autor e categoria.
app.get("/api/obras", autenticar, async (req, res) => {
  try {
    const busca = String(req.query.q || "").trim();
    const lista = await pool.query(
      `SELECT ${obraSelect}
       FROM obras
       WHERE situacao = 'ativa'
         AND ($1 = '' OR titulo ILIKE $2 OR autor ILIKE $2 OR categoria ILIKE $2)
       ORDER BY titulo`,
      [busca, `%${busca}%`],
    );
    res.json({ obras: lista.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: "Erro ao listar as obras." });
  }
});

// RF007: ficha de uma obra que ainda está no acervo.
app.get("/api/obras/:id", autenticar, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ${obraSelect} FROM obras WHERE id = $1 AND situacao = 'ativa'`,
      [req.params.id],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ erro: "Obra não encontrada no acervo ativo." });
    }
    res.json({ obra: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: "Erro ao carregar a obra." });
  }
});

// RF008: atualiza a obra. Se a gravação falhar, a capa nova é apagada.
app.put("/api/obras/:id", autenticar, somenteAdminMaster, async (req, res) => {
  const erro = validarObra(req.body);
  if (erro) return res.status(400).json({ erro });

  const { titulo, autor, categoria } = req.body;
  const descricao = String(req.body.descricao || "").trim() || null;
  let arquivoNovo = null;
  try {
    const atual = await pool.query(
      "SELECT capa FROM obras WHERE id = $1 AND situacao = 'ativa'",
      [req.params.id],
    );
    if (atual.rows.length === 0) {
      return res.status(404).json({ erro: "Obra não encontrada no acervo ativo." });
    }

    let capa = atual.rows[0].capa;
    if (Object.hasOwn(req.body, "capa")) {
      if (!String(req.body.capa || "").trim()) {
        capa = null;
      } else {
        const salva = guardarCapa(req.body.capa);
        if (salva.erro) return res.status(400).json({ erro: salva.erro });
        arquivoNovo = salva.capa;
        capa = salva.capa;
      }
    }

    const atualizada = await pool.query(
      `UPDATE obras
       SET titulo = $1, autor = $2, categoria = $3, capa = $4, descricao = $5
       WHERE id = $6 AND situacao = 'ativa'
       RETURNING ${obraSelect}`,
      [titulo.trim(), autor.trim(), categoria.trim(), capa, descricao, req.params.id],
    );
    if (atualizada.rows.length === 0) {
      apagarArquivoCapa(arquivoNovo);
      return res.status(404).json({ erro: "Obra não encontrada no acervo ativo." });
    }
    if (atual.rows[0].capa && atual.rows[0].capa !== capa) {
      apagarArquivoCapa(atual.rows[0].capa);
    }
    res.json({
      mensagem: "Obra atualizada com sucesso!",
      obra: atualizada.rows[0],
    });
  } catch (error) {
    apagarArquivoCapa(arquivoNovo);
    console.error(error);
    res.status(500).json({ erro: "Erro ao atualizar a obra." });
  }
});

// RF009: tira a obra do acervo. O registro continua no banco, com situação descartada.
app.delete("/api/obras/:id", autenticar, somenteAdminMaster, async (req, res) => {
  try {
    const removida = await pool.query(
      `UPDATE obras SET situacao = 'descartada'
       WHERE id = $1 AND situacao = 'ativa'
       RETURNING id, titulo, capa, pdf`,
      [req.params.id],
    );
    if (removida.rows.length === 0) {
      return res.status(404).json({ erro: "Obra não encontrada no acervo ativo." });
    }
    apagarArquivoCapa(removida.rows[0].capa);
    apagarArquivoPdf(removida.rows[0].pdf);
    res.json({
      mensagem: `Obra "${removida.rows[0].titulo}" removida do acervo ativo.`,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: "Erro ao remover a obra." });
  }
});

// Anexa o PDF da obra. O corpo da requisição é o arquivo, não um JSON.
app.put(
  "/api/obras/:id/pdf",
  autenticar,
  somenteAdminMaster,
  express.raw({ type: "application/pdf", limit: "15mb" }),
  async (req, res) => {
    const salva = guardarPdf(req.body);
    if (salva.erro) return res.status(400).json({ erro: salva.erro });
    try {
      const atual = await pool.query(
        "SELECT pdf FROM obras WHERE id = $1 AND situacao = 'ativa'",
        [req.params.id],
      );
      if (atual.rows.length === 0) {
        apagarArquivoPdf(salva.pdf);
        return res.status(404).json({ erro: "Obra não encontrada no acervo ativo." });
      }
      const atualizada = await pool.query(
        `UPDATE obras SET pdf = $1 WHERE id = $2 AND situacao = 'ativa' RETURNING ${obraSelect}`,
        [salva.pdf, req.params.id],
      );
      if (atual.rows[0].pdf && atual.rows[0].pdf !== salva.pdf) {
        apagarArquivoPdf(atual.rows[0].pdf);
      }
      res.json({ mensagem: "PDF anexado com sucesso!", obra: atualizada.rows[0] });
    } catch (error) {
      apagarArquivoPdf(salva.pdf);
      console.error(error);
      res.status(500).json({ erro: "Erro ao anexar o PDF." });
    }
  },
);

// Tira o PDF da obra e apaga o arquivo.
app.delete("/api/obras/:id/pdf", autenticar, somenteAdminMaster, async (req, res) => {
  try {
    const atual = await pool.query(
      "SELECT pdf FROM obras WHERE id = $1 AND situacao = 'ativa'",
      [req.params.id],
    );
    if (atual.rows.length === 0) {
      return res.status(404).json({ erro: "Obra não encontrada no acervo ativo." });
    }
    const atualizada = await pool.query(
      `UPDATE obras SET pdf = NULL WHERE id = $1 AND situacao = 'ativa' RETURNING ${obraSelect}`,
      [req.params.id],
    );
    apagarArquivoPdf(atual.rows[0].pdf);
    res.json({ mensagem: "PDF removido.", obra: atualizada.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: "Erro ao remover o PDF." });
  }
});

// Leitura direta: obra ativa e conta ativa. Não existe empréstimo.
app.get("/api/obras/:id/leitura", autenticar, async (req, res) => {
  try {
    const obra = await pool.query(
      "SELECT titulo, autor, categoria, situacao, pdf FROM obras WHERE id = $1",
      [req.params.id],
    );
    if (obra.rows.length === 0 || obra.rows[0].situacao !== "ativa") {
      return res.status(404).json({ erro: "Este livro não está disponível para leitura." });
    }
    if (req.usuario.ativo === false) {
      return res.status(403).json({ erro: "Cadastro inativo. A leitura não está liberada." });
    }
    const livro = obra.rows[0];
    res.json({
      leitura: {
        titulo: livro.titulo,
        autor: livro.autor,
        categoria: livro.categoria,
        temPdf: Boolean(livro.pdf),
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: "Erro ao abrir a leitura." });
  }
});

// Entrega o PDF só para quem está logado e com a conta ativa.
app.get("/api/obras/:id/arquivo", autenticar, async (req, res) => {
  try {
    const obra = await pool.query(
      "SELECT pdf, situacao FROM obras WHERE id = $1",
      [req.params.id],
    );
    if (obra.rows.length === 0 || obra.rows[0].situacao !== "ativa" || !obra.rows[0].pdf) {
      return res.status(404).json({ erro: "Este livro não tem PDF anexado." });
    }
    if (req.usuario.ativo === false) {
      return res.status(403).json({ erro: "Cadastro inativo. A leitura não está liberada." });
    }
    const arquivo = path.join(pastaPdfs, path.basename(obra.rows[0].pdf));
    if (!fs.existsSync(arquivo)) {
      return res.status(404).json({ erro: "O arquivo do livro não foi encontrado." });
    }
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "inline");
    fs.createReadStream(arquivo).pipe(res);
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: "Erro ao abrir o PDF." });
  }
});

// O leitor sugere um livro. A sugestão nasce pendente e não vira obra sozinha.
app.post("/api/sugestoes", autenticar, async (req, res) => {
  const titulo = String(req.body.titulo_livro || "").trim();
  const autor = String(req.body.autor || "").trim();
  const categoria = String(req.body.categoria || "").trim();
  const justificativa = String(req.body.justificativa || "").trim();

  if (!titulo) {
    return res.status(400).json({ erro: "Informe o título do livro." });
  }

  try {
    const criada = await pool.query(
      `INSERT INTO sugestoes (titulo_livro, autor, categoria, justificativa, usuario_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, titulo_livro, autor, categoria, justificativa, status,
                 to_char(criado_em, 'DD/MM/YYYY HH24:MI') AS criado_em`,
      [titulo, autor || null, categoria || null, justificativa || null, req.usuario.id],
    );
    res.status(201).json({
      mensagem: "Sugestão enviada. Ela ficará pendente até a análise do administrador.",
      sugestao: criada.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: "Erro ao salvar a sugestão." });
  }
});

// Histórico de quem está logado. Não mostra a sugestão dos outros.
app.get("/api/minhas-sugestoes", autenticar, async (req, res) => {
  try {
    const lista = await pool.query(
      `SELECT id, titulo_livro, autor, categoria, justificativa, status, resposta_admin,
              to_char(criado_em, 'DD/MM/YYYY HH24:MI') AS criado_em
       FROM sugestoes WHERE usuario_id = $1
       ORDER BY criado_em DESC`,
      [req.usuario.id],
    );
    res.json({ sugestoes: lista.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: "Erro ao listar suas sugestões." });
  }
});

// Lista geral para o admin, com filtro por status.
app.get("/api/sugestoes", autenticar, somenteAdminMaster, async (req, res) => {
  const status = String(req.query.status || "").trim();
  const permitidos = ["pendente", "aprovada", "rejeitada"];
  if (status && !permitidos.includes(status)) {
    return res.status(400).json({ erro: "Status de filtro inválido." });
  }
  try {
    const lista = await pool.query(
      `SELECT s.id, s.titulo_livro, s.autor, s.categoria, s.justificativa, s.status,
              s.resposta_admin, u.nome_completo AS leitor,
              to_char(s.criado_em, 'DD/MM/YYYY HH24:MI') AS criado_em
       FROM sugestoes s
       JOIN usuarios u ON u.id = s.usuario_id
       WHERE ($1 = '' OR s.status = $1)
       ORDER BY s.criado_em DESC`,
      [status],
    );
    res.json({ sugestoes: lista.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: "Erro ao listar as sugestões." });
  }
});

// O admin aprova ou rejeita só enquanto a sugestão está pendente.
app.patch("/api/sugestoes/:id", autenticar, somenteAdminMaster, async (req, res) => {
  const status = req.body.status;
  const resposta = String(req.body.resposta_admin || "").trim();
  if (!["aprovada", "rejeitada"].includes(status)) {
    return res.status(400).json({ erro: "Informe se a sugestão foi aprovada ou rejeitada." });
  }
  try {
    const atualizada = await pool.query(
      `UPDATE sugestoes
       SET status = $1, resposta_admin = $2, atualizado_em = now()
       WHERE id = $3 AND status = 'pendente'
       RETURNING id, status, resposta_admin`,
      [status, resposta || null, req.params.id],
    );
    if (atualizada.rows.length === 0) {
      return res.status(400).json({ erro: "Sugestão não encontrada ou já analisada." });
    }
    res.json({
      mensagem: status === "aprovada" ? "Sugestão aprovada." : "Sugestão rejeitada.",
      sugestao: atualizada.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: "Erro ao analisar a sugestão." });
  }
});

// Contagens para a tela de relatório. Só o admin acessa.
app.get("/api/relatorio", autenticar, somenteAdminMaster, async (req, res) => {
  try {
    const consulta = async (sql) => (await pool.query(sql)).rows[0].total;
    res.json({
      relatorio: {
        leitoresAtivos: await consulta("SELECT COUNT(*)::int AS total FROM usuarios WHERE COALESCE(ativo, true) = true AND perfil = 'leitor'"),
        leitoresInativos: await consulta("SELECT COUNT(*)::int AS total FROM usuarios WHERE ativo = false"),
        obrasAtivas: await consulta("SELECT COUNT(*)::int AS total FROM obras WHERE situacao = 'ativa'"),
        sugestoesPendentes: await consulta("SELECT COUNT(*)::int AS total FROM sugestoes WHERE status = 'pendente'"),
        sugestoesAprovadas: await consulta("SELECT COUNT(*)::int AS total FROM sugestoes WHERE status = 'aprovada'"),
        sugestoesRejeitadas: await consulta("SELECT COUNT(*)::int AS total FROM sugestoes WHERE status = 'rejeitada'"),
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: "Erro ao gerar o relatório." });
  }
});

// Na subida, completa as tabelas usadas hoje e apaga tabelas antigas de empréstimo.
async function iniciar() {
  await pool.query(`
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS perfil varchar NOT NULL DEFAULT 'leitor'
  `);
  await pool.query(`
    DO $$ BEGIN
      ALTER TABLE usuarios
        ADD CONSTRAINT usuarios_perfil_check
        CHECK (perfil IN ('leitor', 'admin_master', 'administrador'));
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sessoes (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      usuario_id uuid NOT NULL REFERENCES usuarios(id),
      token_hash varchar NOT NULL UNIQUE,
      criado_em timestamptz DEFAULT now()
    )
  `);
  await pool.query("ALTER TABLE sessoes ADD COLUMN IF NOT EXISTS expira_em timestamptz");
  await pool.query(
    "UPDATE sessoes SET expira_em = now() + interval '8 hours' WHERE expira_em IS NULL",
  );
  await pool.query(`
    CREATE TABLE IF NOT EXISTS obras (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      titulo varchar NOT NULL,
      autor varchar NOT NULL,
      categoria varchar NOT NULL,
      quantidade integer NOT NULL CHECK (quantidade >= 0),
      situacao varchar NOT NULL DEFAULT 'ativa',
      criado_em timestamptz DEFAULT now()
    )
  `);
  await pool.query("ALTER TABLE obras ADD COLUMN IF NOT EXISTS capa varchar");
  await pool.query("ALTER TABLE obras ADD COLUMN IF NOT EXISTS descricao text");
  await pool.query("ALTER TABLE obras ADD COLUMN IF NOT EXISTS pdf varchar");

  // Empréstimo, reserva e notificação saíram do sistema.
  await pool.query("DROP TABLE IF EXISTS emprestimos_fisicos");
  await pool.query("DROP TABLE IF EXISTS reservas");
  await pool.query("DROP TABLE IF EXISTS emprestimos_digitais");
  await pool.query("DROP TABLE IF EXISTS notificacoes");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS codigos_senha (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      usuario_id uuid NOT NULL REFERENCES usuarios(id),
      codigo_hash varchar NOT NULL,
      expira_em timestamptz NOT NULL,
      criado_em timestamptz DEFAULT now()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sugestoes (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      titulo_livro varchar NOT NULL,
      autor varchar,
      categoria varchar,
      justificativa text,
      usuario_id uuid NOT NULL REFERENCES usuarios(id),
      status varchar NOT NULL DEFAULT 'pendente',
      resposta_admin text,
      criado_em timestamptz DEFAULT now(),
      atualizado_em timestamptz DEFAULT now(),
      CONSTRAINT sugestoes_status_check CHECK (status IN ('pendente', 'aprovada', 'rejeitada'))
    )
  `);

  await pool.query("CREATE INDEX IF NOT EXISTS idx_obras_titulo ON obras (titulo)");

  agendarBackup();

  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
  });
}

iniciar().catch((error) => {
  console.error("Falha ao iniciar o servidor:", error);
  process.exit(1);
});
