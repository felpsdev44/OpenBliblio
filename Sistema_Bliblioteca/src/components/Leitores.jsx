// Gestão de leitores. Só o admin abre esta tela.
import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { cpfValido, formatarCpf } from '../../cpf.js';
import Menu from './Menu';
import QuemUsa from './QuemUsa';
import './Auth.css';

// Converte a data do banco para dia/mês/ano.
function formatarData(iso) {
  if (!iso) return '—';
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
}

// Na lista, admin_master e administrador aparecem só como Admin.
function rotuloPerfil(perfil) {
  if (perfil === 'leitor') return 'Leitor';
  if (perfil === 'admin_master' || perfil === 'administrador') return 'Admin';
  return perfil || '—';
}

export default function Leitores({ usuario, onIr, onLogout }) {
  const [leitores, setLeitores] = useState([]);
  const [selecionado, setSelecionado] = useState(null);
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState(null);
  const [mensagem, setMensagem] = useState({ tipo: '', texto: '' });
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [confirmar, setConfirmar] = useState(false);

  // Lista todo mundo cadastrado.
  const carregar = async () => {
    setCarregando(true);
    try {
      const response = await api('/api/leitores');
      const data = await response.json();
      if (!response.ok) {
        setMensagem({ tipo: 'erro', texto: data.erro || 'Erro ao listar leitores.' });
        return;
      }
      setLeitores(data.leitores);
    } catch (error) {
      console.error(error);
      setMensagem({ tipo: 'erro', texto: 'Não foi possível conectar ao servidor.' });
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  // Abre o cadastro de um leitor para ver ou editar.
  const abrir = async (id) => {
    setMensagem({ tipo: '', texto: '' });
    setConfirmar(false);
    setEditando(false);
    try {
      const response = await api(`/api/leitores/${id}`);
      const data = await response.json();
      if (!response.ok) {
        setMensagem({ tipo: 'erro', texto: data.erro || 'Erro ao abrir o leitor.' });
        return;
      }
      setSelecionado(data.leitor);
      setForm({
        nome_completo: data.leitor.nome_completo,
        cpf: formatarCpf(data.leitor.cpf),
        data_nascimento: data.leitor.data_nascimento,
        email: data.leitor.email,
      });
    } catch (error) {
      console.error(error);
      setMensagem({ tipo: 'erro', texto: 'Não foi possível conectar ao servidor.' });
    }
  };

  // O admin pode corrigir os dados de outra pessoa. O CPF passa pela mesma validação.
  const salvar = async (e) => {
    e.preventDefault();
    if (!cpfValido(form.cpf)) {
      setMensagem({ tipo: 'erro', texto: 'CPF inválido. Confira os números digitados.' });
      return;
    }
    setSalvando(true);
    try {
      const response = await api(`/api/leitores/${selecionado.id}`, {
        method: 'PUT',
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) {
        setMensagem({ tipo: 'erro', texto: data.erro || 'Erro ao atualizar o leitor.' });
        return;
      }
      setSelecionado(data.leitor);
      setEditando(false);
      setMensagem({ tipo: 'sucesso', texto: data.mensagem });
      carregar();
    } catch (error) {
      console.error(error);
      setMensagem({ tipo: 'erro', texto: 'Não foi possível conectar ao servidor.' });
    } finally {
      setSalvando(false);
    }
  };

  // Inativar bloqueia o login. Reativar devolve o acesso.
  const alterarStatus = async (ativo) => {
    setSalvando(true);
    try {
      const response = await api(`/api/leitores/${selecionado.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ ativo }),
      });
      const data = await response.json();
      if (!response.ok) {
        setMensagem({ tipo: 'erro', texto: data.erro || 'Erro ao alterar o status.' });
        return;
      }
      setSelecionado((prev) => ({ ...prev, ativo: data.leitor.ativo }));
      setConfirmar(false);
      setMensagem({ tipo: 'sucesso', texto: data.mensagem });
      carregar();
    } catch (error) {
      console.error(error);
      setMensagem({ tipo: 'erro', texto: 'Não foi possível conectar ao servidor.' });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card larga">
        <div className="system-header">
          <h1 className="system-title">Biblioteca Pública Virtual</h1>
          <p className="system-subtitle">Gestão de leitores</p>
          <QuemUsa usuario={usuario} />
        </div>

        {!selecionado && (
          <>
            <h2>Leitores cadastrados</h2>
            {carregando && <p className="toggle-text">Carregando leitores...</p>}
            <div className="obra-lista">
              {leitores.map((item) => (
                <button key={item.id} type="button" className="obra-item" onClick={() => abrir(item.id)}>
                  <strong>{item.nome_completo}</strong>
                  <span>{item.email}</span>
                  <span className={item.ativo ? 'status-ativo' : 'status-inativo'}>
                    {item.ativo ? 'Ativo' : 'Inativo'} · {rotuloPerfil(item.perfil)}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}

        {selecionado && !editando && (
          <>
            <h2>{selecionado.nome_completo}</h2>
            <dl className="perfil-lista">
              <div><dt>CPF</dt><dd>{formatarCpf(selecionado.cpf)}</dd></div>
              <div><dt>Nascimento</dt><dd>{formatarData(selecionado.data_nascimento)}</dd></div>
              <div><dt>E-mail</dt><dd>{selecionado.email}</dd></div>
              <div><dt>Perfil</dt><dd>{rotuloPerfil(selecionado.perfil)}</dd></div>
              <div>
                <dt>Status</dt>
                <dd>
                  <span className={selecionado.ativo ? 'status-ativo' : 'status-inativo'}>
                    {selecionado.ativo ? 'Ativo' : 'Inativo'}
                  </span>
                </dd>
              </div>
            </dl>
            <button type="button" className="submit-btn" onClick={() => setEditando(true)}>
              Atualizar dados
            </button>
            {selecionado.perfil !== 'admin_master' && selecionado.ativo && !confirmar && (
              <button type="button" className="submit-btn perigo" onClick={() => setConfirmar(true)}>
                Inativar leitor
              </button>
            )}
            {confirmar && (
              <>
                <p className="auth-message erro" role="status">
                  Inativar este leitor? Ele não conseguirá mais entrar.
                </p>
                <button type="button" className="submit-btn perigo" disabled={salvando} onClick={() => alterarStatus(false)}>
                  {salvando ? 'Inativando...' : 'Confirmar inativação'}
                </button>
              </>
            )}
            {selecionado.perfil !== 'admin_master' && !selecionado.ativo && (
              <button type="button" className="submit-btn" disabled={salvando} onClick={() => alterarStatus(true)}>
                {salvando ? 'Reativando...' : 'Reativar leitor'}
              </button>
            )}
            <button type="button" className="submit-btn secundario" onClick={() => { setSelecionado(null); setConfirmar(false); }}>
              Voltar à lista
            </button>
          </>
        )}

        {selecionado && editando && (
          <form onSubmit={salvar}>
            <h2>Atualizar leitor</h2>
            <div className="input-group">
              <label>Nome completo</label>
              <input name="nome_completo" value={form.nome_completo} onChange={(e) => setForm({ ...form, nome_completo: e.target.value })} required />
            </div>
            <div className="input-group">
              <label>CPF</label>
              <input name="cpf" value={form.cpf} maxLength="14" onChange={(e) => setForm({ ...form, cpf: formatarCpf(e.target.value) })} required />
            </div>
            <div className="input-group">
              <label>Data de nascimento</label>
              <input type="date" name="data_nascimento" value={form.data_nascimento} onChange={(e) => setForm({ ...form, data_nascimento: e.target.value })} required />
            </div>
            <div className="input-group">
              <label>E-mail</label>
              <input type="email" name="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </div>
            <button type="submit" className="submit-btn" disabled={salvando}>
              {salvando ? 'Salvando...' : 'Salvar alterações'}
            </button>
            <button type="button" className="submit-btn secundario" onClick={() => setEditando(false)}>
              Cancelar
            </button>
          </form>
        )}

        {mensagem.texto && (
          <p className={`auth-message ${mensagem.tipo}`} role="status">{mensagem.texto}</p>
        )}

        <Menu admin onIr={onIr} onLogout={onLogout} />
      </div>
    </div>
  );
}
