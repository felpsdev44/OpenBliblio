// Mostra e atualiza os dados de quem está logado.
import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { cpfValido, formatarCpf } from '../../cpf.js';
import QuemUsa from './QuemUsa';
import './Auth.css';

// O banco manda ano-mês-dia. Na tela eu mostro dia/mês/ano.
function formatarData(iso) {
  if (!iso) return '—';
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
}

export default function PerfilLeitor({ usuario, usuarioId, onLogout, onNomeAlterado, onIrAcervo, onIrSugestoes, onIrLeitores, onIrRelatorio }) {
  const [leitor, setLeitor] = useState(null);
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState(null);
  const [mensagem, setMensagem] = useState({ tipo: '', texto: '' });
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  // Busca o cadastro da pessoa que está logada.
  const carregar = async () => {
    setCarregando(true);
    try {
      const response = await api(`/api/leitores/${usuarioId}`);
      const data = await response.json();
      if (!response.ok) {
        setMensagem({ tipo: 'erro', texto: data.erro || 'Não foi possível carregar o perfil.' });
        return;
      }
      setLeitor(data.leitor);
      setForm({
        nome_completo: data.leitor.nome_completo,
        cpf: formatarCpf(data.leitor.cpf),
        data_nascimento: data.leitor.data_nascimento,
        email: data.leitor.email,
      });
    } catch (error) {
      console.error(error);
      setMensagem({ tipo: 'erro', texto: 'Não foi possível conectar ao servidor.' });
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregar();
  }, [usuarioId]);

  // Mesma máscara de CPF do cadastro.
  const handleChange = (e) => {
    const { name, value } = e.target;
    const proximo = name === 'cpf' ? formatarCpf(value) : value;
    setForm((prev) => ({ ...prev, [name]: proximo }));
  };

  // Atualiza nome, CPF, nascimento e e-mail. Senha não muda aqui.
  const salvar = async (e) => {
    e.preventDefault();
    setMensagem({ tipo: '', texto: '' });

    if (!cpfValido(form.cpf)) {
      setMensagem({ tipo: 'erro', texto: 'CPF inválido. Confira os números digitados.' });
      return;
    }

    setSalvando(true);
    try {
      const response = await api(`/api/leitores/${usuarioId}`, {
        method: 'PUT',
        body: JSON.stringify(form),
      });
      const data = await response.json();

      if (!response.ok) {
        setMensagem({ tipo: 'erro', texto: data.erro || 'Erro ao atualizar o leitor.' });
        return;
      }

      setLeitor(data.leitor);
      setForm({
        nome_completo: data.leitor.nome_completo,
        cpf: formatarCpf(data.leitor.cpf),
        data_nascimento: data.leitor.data_nascimento,
        email: data.leitor.email,
      });
      const salvo = JSON.parse(localStorage.getItem('usuario') || '{}');
      localStorage.setItem(
        'usuario',
        JSON.stringify({ ...salvo, nome: data.leitor.nome_completo, email: data.leitor.email }),
      );
      onNomeAlterado?.(data.leitor.nome_completo);
      setEditando(false);
      setMensagem({ tipo: 'sucesso', texto: data.mensagem });
    } catch (error) {
      console.error(error);
      setMensagem({ tipo: 'erro', texto: 'Não foi possível conectar ao servidor.' });
    } finally {
      setSalvando(false);
    }
  };

  // Descarta o que foi digitado e volta para os dados que estão no banco.
  const cancelar = () => {
    setForm({
      nome_completo: leitor.nome_completo,
      cpf: formatarCpf(leitor.cpf),
      data_nascimento: leitor.data_nascimento,
      email: leitor.email,
    });
    setEditando(false);
    setMensagem({ tipo: '', texto: '' });
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="system-header">
          <h1 className="system-title">Biblioteca Pública Virtual</h1>
          <p className="system-subtitle">Perfil do leitor</p>
          <QuemUsa usuario={usuario} />
        </div>

        {carregando && <p className="toggle-text">Carregando perfil...</p>}

        {!carregando && leitor && !editando && (
          <>
            <h2>Dados cadastrados</h2>
            <dl className="perfil-lista">
              <div>
                <dt>Nome completo</dt>
                <dd>{leitor.nome_completo}</dd>
              </div>
              <div>
                <dt>CPF</dt>
                <dd>{formatarCpf(leitor.cpf)}</dd>
              </div>
              <div>
                <dt>Data de nascimento</dt>
                <dd>{formatarData(leitor.data_nascimento)}</dd>
              </div>
              <div>
                <dt>E-mail</dt>
                <dd>{leitor.email}</dd>
              </div>
              <div>
                <dt>Status do perfil</dt>
                <dd>
                  <span className={leitor.ativo ? 'status-ativo' : 'status-inativo'}>
                    {leitor.ativo ? 'Ativo' : 'Inativo'}
                  </span>
                </dd>
              </div>
              <div>
                <dt>Cadastrado em</dt>
                <dd>{leitor.criado_em || '—'}</dd>
              </div>
            </dl>
          </>
        )}

        {!carregando && leitor && editando && (
          <>
            <h2>Atualizar dados</h2>
            <form onSubmit={salvar}>
              <div className="input-group">
                <label>Nome completo</label>
                <input
                  name="nome_completo"
                  value={form.nome_completo}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="input-group">
                <label>CPF</label>
                <input
                  name="cpf"
                  value={form.cpf}
                  onChange={handleChange}
                  maxLength="14"
                  required
                />
              </div>
              <div className="input-group">
                <label>Data de nascimento</label>
                <input
                  type="date"
                  name="data_nascimento"
                  value={form.data_nascimento}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="input-group">
                <label>E-mail</label>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  required
                />
              </div>
              <button type="submit" className="submit-btn" disabled={salvando}>
                {salvando ? 'Salvando...' : 'Salvar alterações'}
              </button>
              <button type="button" className="submit-btn secundario" onClick={cancelar}>
                Cancelar
              </button>
            </form>
          </>
        )}

        {mensagem.texto && (
          <p className={`auth-message ${mensagem.tipo}`} role="status">
            {mensagem.texto}
          </p>
        )}

        {!carregando && leitor && (
          <p className="toggle-text">
            {!editando && (
              <button type="button" className="toggle-btn" onClick={() => setEditando(true)}>
                Atualizar dados
              </button>
            )}
            <button type="button" className="toggle-btn" onClick={onIrAcervo}>
              Acervo
            </button>
            <button type="button" className="toggle-btn" onClick={onIrSugestoes}>
              Sugestões
            </button>
            {onIrLeitores && (
              <button type="button" className="toggle-btn" onClick={onIrLeitores}>
                Leitores
              </button>
            )}
            {onIrRelatorio && (
              <button type="button" className="toggle-btn" onClick={onIrRelatorio}>
                Relatório
              </button>
            )}
            <button type="button" className="toggle-btn" onClick={onLogout}>
              Sair
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
