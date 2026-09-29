// Tela de quem ainda não entrou: login, cadastro e troca de senha por código.
import { useState } from 'react';
import './Auth.css';
import { cpfValido, formatarCpf } from '../../cpf.js';

export default function Auth({ onLogin, onVoltar }) {
  // Estados possíveis para a tela: 'login', 'cadastro' ou 'esqueci-senha'
  const [tela, setTela] = useState('login');
  const [codigoEnviado, setCodigoEnviado] = useState(false);
  const [mensagem, setMensagem] = useState({ tipo: '', texto: '' });
  const [enviando, setEnviando] = useState(false);

  const [formData, setFormData] = useState({
    nome: '',
    cpf: '',
    dataNascimento: '',
    email: '',
    codigo: '',
    senha: '',
    confirmarSenha: '',
  });

  // Mostra erro ou sucesso no próprio cartão da tela.
  const mostrarMensagem = (tipo, texto) => setMensagem({ tipo, texto });

  // Troca entre entrar, cadastrar e esqueci a senha, limpando o aviso anterior.
  const trocarTela = (novaTela) => {
    setTela(novaTela);
    setCodigoEnviado(false);
    setMensagem({ tipo: '', texto: '' });
  };

  // CPF ganha a máscara. Os outros campos vão como foram digitados.
  const handleChange = (e) => {
    const { name, value } = e.target;
    const proximo = name === 'cpf' ? formatarCpf(value) : value;
    setFormData((prev) => ({ ...prev, [name]: proximo }));
  };

  // Um formulário só. O que acontece depende de qual modo está aberto.
  const handleSubmit = async (e) => {
    e.preventDefault();
    setMensagem({ tipo: '', texto: '' });

    // 1. FLUXO DE RECUPERAÇÃO DE SENHA
    if (tela === 'esqueci-senha' && !codigoEnviado) {
      setEnviando(true);
      try {
        const response = await fetch('http://localhost:3001/api/esqueci-senha', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: formData.email }),
        });
        const data = await response.json();
        if (response.ok) {
          setCodigoEnviado(true);
          mostrarMensagem('sucesso', data.mensagem);
        } else {
          mostrarMensagem('erro', data.erro || 'Não foi possível enviar o código.');
        }
      } catch (error) {
        console.error('Erro de conexão:', error);
        mostrarMensagem('erro', 'Erro ao conectar com o servidor.');
      } finally {
        setEnviando(false);
      }
      return;
    }

    if (tela === 'esqueci-senha' && codigoEnviado) {
      if (formData.senha.trim().length < 6) {
        mostrarMensagem('erro', 'A senha deve ter pelo menos 6 caracteres.');
        return;
      }
      if (formData.senha !== formData.confirmarSenha) {
        mostrarMensagem('erro', 'As senhas não coincidem!');
        return;
      }

      setEnviando(true);
      try {
        const response = await fetch('http://localhost:3001/api/redefinir-senha', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: formData.email,
            codigo: formData.codigo,
            novaSenha: formData.senha,
          }),
        });
        const data = await response.json();
        if (response.ok) {
          setTela('login');
          setCodigoEnviado(false);
          setFormData((prev) => ({ ...prev, codigo: '', senha: '', confirmarSenha: '' }));
          mostrarMensagem('sucesso', data.mensagem);
        } else {
          mostrarMensagem('erro', data.erro || 'Erro ao alterar a senha.');
        }
      } catch (error) {
        console.error('Erro de conexão:', error);
        mostrarMensagem('erro', 'Erro ao conectar com o servidor.');
      } finally {
        setEnviando(false);
      }
      return;
    }

    // 2. FLUXO DE CADASTRO
    if (tela === 'cadastro') {
      if (formData.senha.trim().length < 6) {
        mostrarMensagem('erro', 'A senha deve ter pelo menos 6 caracteres.');
        return;
      }
      if (formData.senha !== formData.confirmarSenha) {
        mostrarMensagem('erro', 'As senhas não coincidem!');
        return;
      }

      if (!cpfValido(formData.cpf)) {
        mostrarMensagem('erro', 'CPF inválido. Confira os números digitados.');
        return;
      }

      if (formData.dataNascimento > new Date().toISOString().slice(0, 10)) {
        mostrarMensagem('erro', 'A data de nascimento não pode ser no futuro.');
        return;
      }

      setEnviando(true);
      try {
        const response = await fetch('http://localhost:3001/api/cadastro', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nome_completo: formData.nome,
            cpf: formData.cpf,
            data_nascimento: formData.dataNascimento,
            email: formData.email,
            senha: formData.senha,
          }),
        });

        const data = await response.json();

        if (response.ok) {
          setTela('login');
          setFormData((prev) => ({ ...prev, senha: '', confirmarSenha: '' }));
          mostrarMensagem('sucesso', 'Cadastro realizado com sucesso! Agora você pode entrar.');
        } else {
          mostrarMensagem('erro', data.erro || 'Erro ao realizar cadastro.');
        }
      } catch (error) {
        console.error('Erro de conexão:', error);
        mostrarMensagem('erro', 'Não foi possível conectar ao servidor.');
      } finally {
        setEnviando(false);
      }
      return;
    }

    // 3. FLUXO DE LOGIN
    if (tela === 'login') {
      setEnviando(true);
      try {
        const response = await fetch('http://localhost:3001/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: formData.email,
            senha: formData.senha,
          }),
        });

        const data = await response.json();

        if (response.ok) {
          const sessao = { ...data.usuario, token: data.token };
          localStorage.setItem('usuario', JSON.stringify(sessao));
          onLogin(sessao);
        } else {
          mostrarMensagem('erro', data.erro || 'E-mail ou senha incorretos.');
        }
      } catch (error) {
        console.error('Erro de conexão:', error);
        mostrarMensagem('erro', 'Não foi possível conectar ao servidor.');
      } finally {
        setEnviando(false);
      }
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="system-header">
          <h1 className="system-title">OpenBiblio</h1>
          <p className="system-subtitle">Acesse sua conta para continuar</p>
        </div>

        <h2>
          {tela === 'login' && 'Entrar na Conta'}
          {tela === 'cadastro' && 'Criar nova Conta'}
          {tela === 'esqueci-senha' && 'Redefinir Senha'}
        </h2>

        <form onSubmit={handleSubmit}>
          {/* Campos específicos do Cadastro */}
          {tela === 'cadastro' && (
            <>
              <div className="input-group">
                <label>Nome Completo</label>
                <input
                  type="text"
                  name="nome"
                  value={formData.nome}
                  onChange={handleChange}
                  placeholder="Seu nome completo"
                  required
                />
              </div>

              <div className="input-row">
                <div className="input-group">
                  <label>CPF</label>
                  <input
                    type="text"
                    name="cpf"
                    value={formData.cpf}
                    onChange={handleChange}
                    placeholder="000.000.000-00"
                    maxLength="14"
                    required
                  />
                </div>

                <div className="input-group">
                  <label>Data de Nascimento</label>
                  <input
                    type="date"
                    name="dataNascimento"
                    value={formData.dataNascimento}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>
            </>
          )}

          {/* Campo de E-mail (exibido em todas as telas) */}
          <div className="input-group">
            <label>E-mail</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="seu@email.com"
              required
            />
          </div>

          {tela === 'esqueci-senha' && codigoEnviado && (
            <div className="input-group">
              <label htmlFor="codigo-senha">Código recebido no e-mail</label>
              <input
                id="codigo-senha"
                name="codigo"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={formData.codigo}
                onChange={handleChange}
                placeholder="000000"
                maxLength="6"
                required
              />
            </div>
          )}

          {(tela !== 'esqueci-senha' || codigoEnviado) && (
          <div className="input-group">
            <label>{tela === 'esqueci-senha' ? 'Nova Senha' : 'Senha'}</label>
            <input
              type="password"
              name="senha"
              value={formData.senha}
              onChange={handleChange}
              placeholder="••••••••"
              required
            />
          </div>
          )}

          {/* Confirmação de Senha (Cadastro e Esqueci-Senha) */}
          {(tela === 'cadastro' || (tela === 'esqueci-senha' && codigoEnviado)) && (
            <div className="input-group">
              <label>Confirmar {tela === 'esqueci-senha' ? 'Nova Senha' : 'Senha'}</label>
              <input
                type="password"
                name="confirmarSenha"
                value={formData.confirmarSenha}
                onChange={handleChange}
                placeholder="••••••••"
                required
              />
            </div>
          )}

          {/* Link Esqueci Minha Senha apenas na tela de Login */}
          {tela === 'login' && (
            <div style={{ textAlign: 'right', marginBottom: '15px' }}>
              <button
                type="button"
                className="toggle-btn"
                onClick={() => trocarTela('esqueci-senha')}
                style={{ fontSize: '0.85rem' }}
              >
                Esqueceu a senha?
              </button>
            </div>
          )}

          {mensagem.texto && (
            <p className={`auth-message ${mensagem.tipo}`} role="status">
              {mensagem.texto}
            </p>
          )}

          <button type="submit" className="submit-btn" disabled={enviando}>
            {enviando
              ? 'Aguarde...'
              : tela === 'login'
                ? 'Entrar'
                : tela === 'cadastro'
                  ? 'Cadastrar'
                  : codigoEnviado
                    ? 'Salvar Nova Senha'
                    : 'Enviar código'}
          </button>
        </form>

        {/* Alternadores de Tela no Rodapé */}
        <p className="toggle-text">
          {tela === 'login' && (
            <>
              Ainda não tem conta?{' '}
              <button type="button" className="toggle-btn" onClick={() => trocarTela('cadastro')}>
                Cadastre-se
              </button>
              {onVoltar && (
                <span className="intro-voltar-linha">
                  <button type="button" className="toggle-btn" onClick={onVoltar}>
                    Voltar à introdução
                  </button>
                </span>
              )}
            </>
          )}

          {tela === 'cadastro' && (
            <>
              Já tem uma conta?{' '}
              <button type="button" className="toggle-btn" onClick={() => trocarTela('login')}>
                Faça login
              </button>
            </>
          )}

          {tela === 'esqueci-senha' && (
            <>
              {codigoEnviado && (
                <>
                  <button type="button" className="toggle-btn" onClick={() => { setCodigoEnviado(false); setMensagem({ tipo: '', texto: '' }); }}>
                    Enviar outro código
                  </button>
                  {' · '}
                </>
              )}
              Lembrou a senha?{' '}
              <button type="button" className="toggle-btn" onClick={() => trocarTela('login')}>
                Voltar para o Login
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}