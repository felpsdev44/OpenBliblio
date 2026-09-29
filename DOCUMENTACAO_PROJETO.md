# Documentação do projeto — Biblioteca Pública Virtual

## 1. Introdução

A Biblioteca Pública Virtual é um sistema para consultar e ler livros pela internet, no computador. A pessoa cria uma conta, entra com e-mail e senha e vê o acervo. Se o livro estiver ativo, ela pode abrir a leitura na hora.

O problema que o sistema trata é simples: o acervo precisa ficar organizado, e o leitor precisa achar o livro e ler sem depender de empréstimo, reserva ou renovação. Quem cuida do acervo é um administrador.

## 2. Objetivo do sistema

### Objetivo geral

Permitir que um leitor cadastrado consulte o acervo e leia os livros disponíveis, e que um administrador cuide dos livros, dos leitores e das sugestões.

### Objetivos específicos

- Cadastrar o leitor e permitir a entrada no sistema.
- Permitir que o leitor veja e atualize os próprios dados.
- Mostrar o acervo, com busca por título, autor ou categoria.
- Deixar o administrador cadastrar, atualizar e retirar obras do acervo ativo.
- Abrir o PDF do livro para quem está logado, quando o arquivo existir.
- Receber sugestões de livros e deixar o administrador aprovar ou rejeitar.
- Mostrar um relatório simples com quantidades de leitores, obras e sugestões.
- Enviar um código por e-mail quando a pessoa esquecer a senha.

## 3. Descrição do sistema

O sistema tem duas partes. A tela fica no navegador. O servidor recebe os pedidos, confere quem está logado e grava os dados no PostgreSQL.

Quem ainda não entrou vê a tela de acesso. Nela dá para entrar, criar conta ou pedir um código para trocar a senha. Depois do login, a primeira tela é o acervo. No topo aparece quem está usando o sistema, no formato `usuário - Nome` ou `admin - Nome`.

A leitura é direta. Se a obra está ativa, o botão Ler agora abre o livro. Não há empréstimo, reserva nem renovação.

O leitor também pode sugerir um livro. A sugestão fica pendente até o administrador analisar. Aprovar a sugestão não cria a obra sozinho: o sistema abre o formulário de cadastro já preenchido, e o administrador precisa salvar.

## 4. Usuários do sistema

O banco aceita três valores no campo `perfil`: `leitor`, `admin_master` e `administrador`. Na prática, as telas usam dois papéis.

Toda conta nova é gravada como `leitor`. Não existe tela para transformar um leitor em administrador. O administrador é a conta que já está com o perfil `admin_master`. No projeto, essa conta é a do e-mail `felipe@gmail.com`. O valor `administrador` existe só na regra do banco. Nenhuma tela grava esse valor nem cria uma permissão diferente para ele. Se um registro com esse valor aparecesse na lista, a tela mostraria o rótulo Admin.

### Leitor

O leitor pode:

- criar a conta, entrar e sair;
- pedir o código de redefinição de senha;
- ver e atualizar o próprio nome, CPF, data de nascimento e e-mail;
- buscar obras e abrir a ficha;
- ler o livro;
- enviar uma sugestão e ver o próprio histórico.

Telas: acesso (entrar, cadastro e redefinir senha), acervo, perfil e sugestões.

O leitor não vê os botões de cadastrar ou remover obra, nem as telas de leitores e relatório.

### Administrador

O administrador faz o que o leitor faz no acervo e, além disso, pode:

- cadastrar, atualizar e remover obras do acervo ativo;
- colocar ou tirar capa e PDF;
- ver a lista de leitores, abrir o cadastro, atualizar os dados, inativar e reativar;
- ver todas as sugestões, filtrar, aprovar, rejeitar e escrever uma resposta;
- abrir o cadastro da obra a partir de uma sugestão aprovada;
- ver o relatório.

Telas: as mesmas do leitor, mais a gestão de leitores e o relatório.

Na tela de sugestões, o formulário de enviar sugestão aparece só para o leitor. O administrador vê a lista recebida.

O administrador não pode inativar a própria conta. O botão de inativar também não aparece quando o perfil do registro é `admin_master`.

## 5. Funcionalidades

### Cadastro de usuário

A pessoa informa nome completo, CPF, data de nascimento, e-mail e senha. A senha é pedida duas vezes. Se os dados passam na validação, a conta é criada como leitor ativo.

### Login

A entrada usa e-mail e senha. O e-mail é comparado sem diferenciar maiúsculas e minúsculas. Se a conta estiver inativa, o login é recusado.

### Redefinição de senha

A pessoa informa o e-mail e pede um código. Se a conta existe e está ativa, o servidor manda um código de 6 dígitos. O código vale 15 minutos. Depois ela informa o código e a nova senha.

Se o e-mail não existe ou a conta está inativa, a tela mostra a mesma mensagem de sucesso e nenhum e-mail é enviado.

### Alteração de dados do leitor

O leitor altera os próprios dados na tela de perfil. O administrador também pode alterar os dados de um leitor na tela de gestão. A senha não é alterada nesses formulários. Para trocar a senha, o caminho é a redefinição por e-mail.

### Consulta de livros

O acervo lista as obras ativas. A busca olha título, autor e categoria. A lista mostra capa, título, autor e categoria. Obras retiradas do acervo não aparecem.

### Ficha do livro

Ao clicar em uma obra, a tela mostra capa, título, autor, categoria, descrição (se houver), data de cadastro e se existe PDF.

### Cadastro, edição e remoção de livros

Só o administrador faz isso. O cadastro pede título, autor e categoria. Descrição, capa e PDF são opcionais.

Remover a obra não apaga a linha do banco. O sistema marca a situação como `descartada` e apaga os arquivos da capa e do PDF. A obra deixa de aparecer na lista.

### Leitura

O botão Ler agora vale para leitor e administrador, desde que a obra esteja ativa. Se houver PDF, o arquivo é carregado e mostrado uma página por vez, com os botões Página anterior e Próxima página. Dá para fechar pelo botão Fechar ou pela tecla Escape.

Se a obra não tiver PDF, a tela de leitura abre uma página em branco.

### Sugestão de livro

O leitor envia título. Autor, categoria e justificativa são opcionais. A sugestão começa como pendente. O histórico mostra o status e a resposta do administrador, quando existir.

### Análise de sugestão

O administrador filtra por todas, pendentes, aprovadas ou rejeitadas. Em uma sugestão pendente, ele pode escrever uma resposta, aprovar ou rejeitar. Uma sugestão que já foi analisada não volta para pendente por essa tela.

Ao aprovar, o sistema muda o status e abre o formulário de cadastrar obra, com título, autor e categoria preenchidos. O administrador ainda precisa salvar. Nas sugestões que já estão aprovadas, o botão Cadastrar no acervo abre o mesmo formulário de novo.

### Gestão de leitores

O administrador vê a lista com nome, e-mail, status e perfil. Ao abrir um leitor, vê CPF, nascimento, e-mail, perfil e status. Pode atualizar os dados, inativar ou reativar. Inativar tira o acesso daquela conta.

### Relatório

O relatório mostra seis números: leitores ativos, leitores inativos, obras no acervo, sugestões pendentes, aprovadas e rejeitadas.

Leitor ativo, nesse relatório, é quem tem perfil `leitor` e está ativo. Leitor inativo é qualquer conta com status inativo.

### Quem está usando

Depois do login, as telas mostram o primeiro nome e o papel: usuário ou admin.

### Alto contraste

No menu das telas que usam o componente `Menu`, existe o botão Alto contraste. A escolha fica salva no navegador. A tela de login e a tela de perfil não têm esse botão. Se o contraste já estiver ligado, o visual continua valendo nelas.

### Backup diário

Quando o servidor sobe, e de hora em hora, ele tenta gravar um arquivo JSON do dia na pasta `backups`. Se o arquivo daquele dia já existe, ele não gera outro. Entram as tabelas `usuarios`, `obras` e `sugestoes`. A coluna da senha fica de fora.

## 6. Telas do sistema

O sistema não usa uma página diferente para cada endereço. O componente `App` guarda a área atual e troca o componente da tela. Por isso a barra de endereço do navegador não muda quando a pessoa vai do acervo para o perfil.

A ordem normal é: tela de acesso, depois acervo. Dali o menu leva para perfil, sugestões e, no caso do administrador, leitores e relatório.

### Acesso

Arquivo: `src/components/Auth.jsx`.

É a tela de quem não está logado. O título é Biblioteca Pública Virtual. Ela tem três modos.

Entrar na Conta: e-mail, senha, botão Entrar e o link Esqueceu a senha?. No rodapé, Cadastre-se.

Criar nova Conta: nome completo, CPF, data de nascimento, e-mail, senha, confirmar senha e botão Cadastrar. No rodapé, Faça login.

Redefinir Senha: primeiro só o e-mail e o botão Enviar código. Depois aparecem o código, a nova senha, a confirmação e o botão Salvar Nova Senha. Também dá para pedir outro código ou voltar ao login.

Mensagens de erro e de sucesso aparecem no próprio cartão.

### Acervo

Arquivo: `src/components/Acervo.jsx`.

Subtítulo: Acervo de obras.

Na lista: campo Título, autor ou categoria, a lista de obras e, para o administrador, o botão Cadastrar obra.

Na ficha: dados do livro, botão Ler agora e Voltar à lista. O administrador também vê Atualizar obra e Remover do acervo. A remoção pede confirmação.

No cadastro e na edição: título, autor, categoria, descrição, arquivo de capa e arquivo de PDF. Dá para remover a capa ou o PDF antes de salvar. Botões Cadastrar ou Salvar alterações, e Cancelar.

Na leitura: uma camada por cima da ficha, com o título, Fechar, a página atual e os botões de página.

### Perfil

Arquivo: `src/components/PerfilLeitor.jsx`.

Subtítulo: Perfil do leitor.

Mostra nome, CPF, data de nascimento, e-mail, status e data de cadastro. O botão Atualizar dados abre o formulário com esses campos, menos status e data de cadastro. Salvar alterações grava. Cancelar volta para a visualização.

O rodapé tem Acervo, Sugestões e Sair. Para o administrador, também aparecem Leitores e Relatório. Essa tela não usa o menu completo, então o botão de alto contraste não está aqui.

### Sugestões

Arquivo: `src/components/Sugestoes.jsx`.

Para o leitor, o subtítulo é Minhas sugestões. O formulário pede título, autor, categoria e justificativa. O botão é Enviar sugestão. Abaixo fica o histórico.

Para o administrador, o subtítulo é Sugestões de livros. Não há formulário de envio. Há um filtro de status e a lista, com o nome de quem sugeriu. Nas pendentes: campo de resposta, Aprovar e Rejeitar. Nas aprovadas: Cadastrar no acervo.

### Leitores

Arquivo: `src/components/Leitores.jsx`.

Subtítulo: Gestão de leitores. Só o administrador chega nessa tela pelo menu.

A lista é clicável. No detalhe: CPF, nascimento, e-mail, perfil e status. Botões: Atualizar dados, Inativar leitor ou Reativar leitor, e Voltar à lista. A inativação pede confirmação. O formulário de atualização tem nome, CPF, data de nascimento e e-mail.

### Relatório

Arquivo: `src/components/Relatorio.jsx`.

Subtítulo: Relatório de gestão. Mostra os seis números descritos na funcionalidade de relatório. Só o administrador acessa pelo menu.

## 7. Tecnologias utilizadas

**React**  
Monta as telas no navegador. A versão usada no projeto é a 19.

**React DOM**  
Coloca a aplicação React na página, dentro do elemento `root`.

**Vite**  
Sobe o frontend em desenvolvimento e também serve para gerar a versão de build. O comando de desenvolvimento é `npm run dev`.

**Node.js**  
Executa o servidor. O arquivo principal é `server.js`.

**Express**  
Recebe as rotas da API. A versão declarada é a 5.

**PostgreSQL**  
Banco de dados do projeto. O nome usado na configuração é `bliblioteca_virtual`.

**pg**  
Biblioteca que liga o Node.js ao PostgreSQL. O arquivo `db.js` cria um pool de conexões.

**bcryptjs**  
Gera e confere o hash da senha. É essa biblioteca que o `server.js` importa.

**dotenv**  
Lê o arquivo `.env` e disponibiliza as variáveis para o servidor.

**cors**  
Permite que o frontend, em outra porta, chame a API.

**nodemailer**  
Envia o e-mail com o código de redefinição de senha pelo SMTP do Gmail (`smtp.gmail.com`, porta 587).

**pdfjs-dist**  
Mostra o PDF na tela de leitura, página por página. A versão declarada é a 6.3.

**crypto**  
Módulo do próprio Node.js. Gera o token da sessão e o código numérico, e calcula o hash guardado no banco.

O pacote `bcrypt` aparece no `package.json` da pasta raiz, mas nenhum arquivo do projeto importa essa biblioteca. O código usa o `bcryptjs`.

Não há ORM. As consultas são SQL escritas nas rotas.

## 8. Estrutura do projeto

A pasta do trabalho tem dois níveis.

```text
Sistema_Bliblioteca/
  package.json          dependências do servidor
  package-lock.json
  node_modules/
  DOCUMENTACAO_PROJETO.md
  Sistema_Bliblioteca/  aplicação
    server.js
    db.js
    cpf.js
    backup.js
    .env
    package.json        dependências do frontend
    index.html
    vite.config.js
    src/
    public/
    capas/
    pdfs/
    backups/
```

`src/` guarda a interface.

- `src/main.jsx`: inicia o React e restaura o alto contraste, se estiver salvo.
- `src/App.jsx`: decide qual tela mostrar.
- `src/api.js`: chama a API nas telas que já exigem login.
- `src/components/`: cada tela e os componentes `Menu` e `QuemUsa`.
- `src/components/Auth.css`: o estilo usado pelas telas.

Não existe pasta `pages/` nem pasta `services/`.

`public/` guarda o ícone, os arquivos WASM usados pelo leitor de PDF e dois SVG (`diagrama-classes.svg` e `caso-de-uso-biblioteca.svg`). Esses SVG não são abertos por nenhuma tela do sistema.

`capas/` guarda as imagens de capa. `pdfs/` guarda os arquivos dos livros. As duas pastas estão no `.gitignore`.

`backups/` guarda o JSON diário.

O `README.md` que está dentro da aplicação é o texto padrão do template React + Vite. Ele não descreve a biblioteca.

## 9. Frontend

O frontend é uma aplicação React de uma página só. O `index.html` carrega `src/main.jsx`, e esse arquivo renderiza o `App`.

O `App` começa conferindo se existe uma sessão salva no `localStorage`, na chave `usuario`. Se existir, ele pergunta ao servidor em `/api/eu` se o token ainda vale. Enquanto essa resposta não chega, a tela fica vazia. Se o token estiver vencido ou a conta estiver inativa, a sessão local é apagada e aparece a tela de acesso. Se o servidor estiver fora do ar, a sessão salva é mantida.

Depois do login, a área inicial é o acervo. A troca de tela é feita pelo estado `area`, com os valores `acervo`, `perfil`, `sugestoes`, `leitores` e `relatorio`. As duas últimas só abrem se o perfil for `admin_master`.

O componente `Menu` leva para perfil, acervo, sugestões, leitores, relatório e saída. Também liga o alto contraste. O `QuemUsa` mostra o papel e o primeiro nome.

A comunicação com o servidor, depois do login, passa por `src/api.js`. O endereço está fixo em `http://localhost:3001`. A função `api` envia o token no cabeçalho `Authorization`. A tela de acesso não usa esse arquivo: ela chama o mesmo endereço com `fetch` direto, porque o login, o cadastro e a recuperação de senha ainda não têm token.

Validações feitas na tela, antes de enviar:

- cadastro: senha com pelo menos 6 caracteres, senhas iguais, CPF válido e data de nascimento que não esteja no futuro;
- redefinição: senha com pelo menos 6 caracteres e senhas iguais;
- perfil e gestão de leitores: CPF válido;
- capa: JPG, PNG ou WebP, até 1,5 MB;
- PDF: arquivo PDF, até 15 MB.

Os campos obrigatórios dos formulários também usam o `required` do HTML. O CPF é formatado enquanto a pessoa digita, no padrão `000.000.000-00`.

A busca do acervo espera 300 milissegundos depois da digitação e ignora uma resposta antiga se a pessoa já digitou de novo.

## 10. Backend

O backend está concentrado em `server.js`. Não há pastas de controller ou service. Três arquivos ajudam o servidor:

- `db.js`: conexão com o PostgreSQL;
- `cpf.js`: validação e formatação do CPF;
- `backup.js`: backup diário.

Ao iniciar, o servidor ajusta o banco: cria tabelas que ainda não existem, adiciona colunas que faltam e remove, se ainda existirem, tabelas antigas de empréstimo, reserva e notificação. A tabela `usuarios` não é criada por esse código. Ela precisa já existir. O servidor só garante a coluna `perfil`.

A API sobe na porta definida em `PORT`. No `.env` do projeto, essa porta é 3001.

### Rotas públicas

- `GET /api`: nome do sistema e lista de alguns recursos.
- `GET /api/saude`: testa se o banco responde.
- `POST /api/cadastro`: cria o leitor.
- `POST /api/login`: entra e devolve o token.
- `POST /api/esqueci-senha`: gera e envia o código.
- `POST /api/redefinir-senha`: troca a senha se o código ainda vale.
- `GET /capas/...`: entrega a imagem da capa. Essa pasta é pública.

### Rotas que exigem login

- `GET /api/eu`: devolve os dados públicos de quem está logado.
- `DELETE /api/sessao`: encerra a sessão atual.
- `GET /api/leitores/:id`: o próprio leitor ou o administrador.
- `PUT /api/leitores/:id`: atualiza nome, CPF, nascimento e e-mail. O perfil não é alterado por essa rota.
- `GET /api/obras`: lista o acervo ativo, com busca opcional em `q`.
- `GET /api/obras/:id`: ficha de uma obra ativa.
- `GET /api/obras/:id/leitura`: confere se o livro pode ser lido.
- `GET /api/obras/:id/arquivo`: envia o PDF. O arquivo não fica em pasta pública.
- `POST /api/sugestoes`: grava uma sugestão.
- `GET /api/minhas-sugestoes`: histórico de quem está logado.

### Rotas só do Admin Master

- `GET /api/leitores`: lista os usuários.
- `PATCH /api/leitores/:id/status`: ativa ou inativa.
- `POST /api/obras`: cadastra obra.
- `PUT /api/obras/:id`: atualiza obra.
- `DELETE /api/obras/:id`: marca a obra como descartada.
- `PUT /api/obras/:id/pdf`: anexa o PDF.
- `DELETE /api/obras/:id/pdf`: remove o PDF.
- `GET /api/sugestoes`: lista as sugestões, com filtro opcional.
- `PATCH /api/sugestoes/:id`: aprova ou rejeita uma sugestão pendente.
- `GET /api/relatorio`: devolve os números do relatório.

A conferência de login está na função `autenticar`. A conferência de administrador está em `somenteAdminMaster`, que aceita apenas o perfil `admin_master`.

## 11. Banco de dados

O banco é PostgreSQL, no computador local, porta 5433, com o nome `bliblioteca_virtual`. A conexão usa as variáveis `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS` e `DB_NAME`.

Não há ORM. O `pg` executa o SQL.

### usuarios

Guarda as contas.

| Campo | Função |
| --- | --- |
| id | identificador UUID |
| nome_completo | nome da pessoa |
| cpf | só os números, valor único |
| data_nascimento | data |
| email | valor único |
| senha_hash | senha transformada pelo bcryptjs |
| ativo | verdadeiro ou falso; o padrão é ativo |
| criado_em | data de criação |
| perfil | `leitor`, `admin_master` ou `administrador`; o padrão é `leitor` |

### sessoes

Guarda o acesso de quem entrou. O campo `usuario_id` aponta para `usuarios`. O `token_hash` é único. `expira_em` marca o fim da sessão, 8 horas depois da criação.

### codigos_senha

Guarda o hash do código de redefinição e a data em que ele vence. Também aponta para `usuarios`.

### obras

Guarda os livros.

| Campo | Função |
| --- | --- |
| id | identificador UUID |
| titulo | título |
| autor | autor |
| categoria | categoria |
| quantidade | número inteiro, zero ou maior; no cadastro o servidor grava 1 |
| situacao | `ativa` ou, depois da remoção, `descartada` |
| criado_em | data de cadastro |
| capa | caminho da imagem, por exemplo `/capas/nome.jpg` |
| pdf | caminho do arquivo, por exemplo `/pdfs/nome.pdf` |
| descricao | texto opcional |

A coluna `quantidade` não aparece nas telas. Existe um índice em `titulo`.

A obra não tem ligação com a tabela de usuários. O banco não registra quem cadastrou o livro.

### sugestoes

Guarda o pedido de um leitor. O campo `usuario_id` aponta para `usuarios`.

Os campos são: título (`titulo_livro`), autor, categoria, justificativa, status, resposta do administrador, data de criação e data de atualização. O status só pode ser `pendente`, `aprovada` ou `rejeitada`.

## 12. Fluxo do sistema

### Cadastro

1. A pessoa abre o sistema e escolhe Cadastre-se.
2. Preenche nome, CPF, nascimento, e-mail e senha.
3. A tela confere senha, CPF e data.
4. Os dados vão para `POST /api/cadastro`.
5. O servidor confere de novo, recusa e-mail repetido e grava a senha como hash.
6. A conta entra como leitor. A tela volta para o login.

### Login

1. A pessoa informa e-mail e senha.
2. O servidor procura o e-mail e compara a senha com o hash.
3. Se a conta está ativa, ele cria uma sessão de 8 horas e devolve um token.
4. O navegador guarda o token no `localStorage`.
5. A tela do acervo é aberta.

### Leitura

1. A pessoa entra no acervo e abre uma obra.
2. Clica em Ler agora.
3. O servidor confere se a obra está ativa e se a conta está ativa.
4. Se existe PDF, o navegador baixa o arquivo pela rota autenticada.
5. O pdfjs mostra uma página por vez.
6. Fechar volta para a ficha do livro.

### Sugestão e cadastro da obra

1. O leitor preenche a sugestão e envia.
2. O registro fica pendente.
3. O administrador aprova ou rejeita.
4. Se aprovar, a tela de cadastrar obra abre com os dados da sugestão.
5. O administrador completa o que quiser e salva.
6. A obra passa a aparecer no acervo ativo.

### Inativação

1. O administrador abre o leitor e confirma a inativação.
2. O servidor marca `ativo` como falso e apaga as sessões daquela conta.
3. Se a pessoa ainda estiver com o sistema aberto, a próxima chamada autenticada recebe a recusa e a tela volta para o login.
4. O administrador pode reativar depois.

## 13. Regras do sistema

- Sem login, as telas do acervo, do perfil, das sugestões, dos leitores e do relatório não abrem.
- Conta nova é sempre `leitor`. O cadastro não aceita escolher perfil.
- O e-mail `felipe@gmail.com` não pode ser usado em um cadastro novo, em qualquer combinação de maiúsculas. Outro usuário também não pode trocar o próprio e-mail para esse endereço.
- E-mail e CPF não podem se repetir.
- A senha do cadastro e da redefinição precisa ter pelo menos 6 caracteres, sem contar espaços nas pontas.
- O CPF precisa ter 11 números e passar na conta dos dígitos verificadores. Sequências com todos os números iguais são recusadas. No banco ficam só os dígitos.
- No cadastro, a data de nascimento não pode ser futura e precisa estar no formato de data. Na atualização do perfil, a tela e a rota exigem a data, mas não repetem a regra da data futura.
- No cadastro, o servidor também exige nome, e-mail com formato válido e senha. Na atualização, exige nome, e-mail e data preenchidos, e CPF válido.
- Login com e-mail ou senha errados recebe a mesma mensagem. Conta inativa não entra.
- A sessão dura 8 horas. Depois disso o token deixa de valer.
- Só o perfil `admin_master` cadastra, altera e remove obras, anexa PDF, lista leitores, muda status, analisa sugestões e vê o relatório.
- O leitor vê e altera só o próprio cadastro.
- O administrador não inativa a própria conta.
- Inativar uma conta apaga as sessões dela.
- A listagem de obras mostra apenas `situacao = ativa`.
- Título, autor e categoria são obrigatórios na obra. Descrição, capa e PDF não são.
- A capa aceita JPG, PNG e WebP, até 1,5 MB. O servidor confere o tipo pelo conteúdo do arquivo.
- O PDF aceita até 15 MB e precisa ter a marca `%PDF-` no começo do arquivo.
- Aprovar ou rejeitar só funciona enquanto a sugestão está pendente.
- Aprovar não grava a obra. A obra só existe depois do cadastro no acervo.
- O código de senha vale 15 minutos. Um novo código para a mesma conta só é gerado depois de 1 minuto.
- Se o e-mail do código não está configurado, a rota responde que o envio ainda não está configurado.
- Ao trocar a senha, os códigos e as sessões daquela conta são apagados.
- No cadastro da obra, o servidor grava `quantidade` como 1. A tela não usa esse número.
- Remover a obra muda a situação para `descartada` e apaga capa e PDF do disco.

## 14. Segurança

A senha não é gravada em texto. O bcryptjs gera o `senha_hash`. No login, a comparação é feita com esse hash.

O token da sessão é aleatório. No banco fica só o hash SHA-256 dele. O navegador envia o token original no cabeçalho `Authorization: Bearer`. Cada rota protegida confere esse token, a data de expiração e se a conta continua ativa.

O código de redefinição também é guardado como hash. A resposta de “esqueci a senha” não diz se o e-mail existe.

As rotas de administração recusam quem não tem o perfil `admin_master`. O leitor não consulta o cadastro de outra pessoa.

Os dados que entram nas consultas SQL vão por parâmetros (`$1`, `$2`), não concatenados na frase SQL.

O PDF não é servido como arquivo público. A capa é. Quem souber o caminho `/capas/...` consegue abrir a imagem sem login.

Na área de leitura, o navegador bloqueia copiar, recortar e o menu do botão direito. Isso não impede captura de tela.

O CORS está liberado sem uma lista de sites permitidos. O endereço da API está fixo em localhost, então o uso previsto é na mesma máquina.

O backup diário não copia `senha_hash`. Ele copia o restante das tabelas, inclusive o CPF.

As senhas do banco e do e-mail ficam no arquivo `.env`. Esse arquivo não está citado no `.gitignore`.

## 15. Instalação e execução

### Pré-requisitos

- Node.js instalado.
- PostgreSQL em execução.
- O banco `bliblioteca_virtual` criado, com a tabela `usuarios` já existente, nos campos descritos na seção do banco.

As outras tabelas são criadas ou ajustadas quando o servidor inicia.

### Dependências

Na pasta raiz do projeto, onde está o `package.json` do servidor:

```bash
npm install
```

Na pasta interna `Sistema_Bliblioteca`, onde está o `package.json` do frontend:

```bash
npm install
```

### Arquivo de ambiente

O arquivo `.env` fica na pasta interna, junto de `server.js`. As variáveis usadas são:

```text
DB_HOST=localhost
DB_PORT=5433
DB_USER=postgres
DB_PASS=senha_do_postgres
DB_NAME=bliblioteca_virtual
PORT=3001
MAIL_USER=email_que_envia_o_codigo
MAIL_PASS=senha_de_app_do_gmail
```

`MAIL_USER` e `MAIL_PASS` são da conta Gmail que envia o código. Sem essas duas, o restante do sistema sobe, mas a rota de esqueci a senha responde que o e-mail não está configurado.

A senha do banco e a senha do e-mail não devem ser copiadas para este documento nem para um repositório público.

### Subir o backend

Na pasta interna, onde está o `server.js`:

```bash
node server.js
```

O servidor fica na porta 3001. Essa parte não recarrega sozinha: se `server.js` mudar, é preciso parar o processo e rodar o comando de novo.

### Subir o frontend

Em outro terminal, na mesma pasta interna:

```bash
npm run dev
```

O Vite mostra o endereço local. No uso normal deste projeto, a tela abre em `http://localhost:5173/`.

Os dois processos precisam estar no ar ao mesmo tempo. O Vite entrega a tela na porta 5173. O JavaScript dessa tela chama a API direto na porta 3001. O `vite.config.js` não faz ponte entre as duas.

## 16. Considerações finais

O sistema entrega o fluxo de uma biblioteca digital pequena: conta, login, acervo, ficha do livro e leitura do PDF. O administrador completa esse fluxo com o cadastro das obras, a análise das sugestões, a situação dos leitores e um relatório com contagens.

A leitura não passa por empréstimo. O livro ativo abre para quem está autenticado. A sugestão de livro fica separada do acervo até alguém salvar a obra no formulário.

## 17. Possíveis melhorias

- Tirar o endereço `http://localhost:3001` do código e ler esse endereço de uma configuração, para o sistema poder rodar em outra máquina.
- Repetir, na atualização do perfil, as mesmas conferências de e-mail e de data de nascimento que já existem no cadastro.
- Incluir o botão de alto contraste também na tela de acesso e na tela de perfil.
- Decidir o que fazer com a coluna `quantidade`, já que a tela não usa esse valor.
- O valor `administrador` pode sair da regra do banco, se não for usado, para não parecer um terceiro tipo de usuário.
- O título da aba do navegador ainda é `sistema_bliblioteca`, que veio do template. Dá para trocar para o nome da biblioteca.
- O pacote `bcrypt`, listado na pasta raiz, pode ser removido se continuar sem uso.
- Incluir o `.env` no `.gitignore`, para senha de banco e senha de e-mail não irem junto com o código.
- Na leitura, cancelar de fato a página anterior quando a pessoa troca de página muito rápido. Hoje a página antiga ainda pode terminar de desenhar por cima da nova.
