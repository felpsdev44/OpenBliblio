// Tela de sugestões. O leitor envia um livro; o admin aprova ou rejeita.
import { useEffect, useState } from 'react';
import { api } from '../api.js';
import Menu from './Menu';
import QuemUsa from './QuemUsa';
import './Auth.css';

const rotulo = { pendente: 'Pendente', aprovada: 'Aprovada', rejeitada: 'Rejeitada' };

export default function Sugestoes({ usuario, admin, onIr, onLogout, onAprovar }) {
  const [sugestoes, setSugestoes] = useState([]);
  const [filtro, setFiltro] = useState('');
  const [form, setForm] = useState({ titulo_livro: '', autor: '', categoria: '', justificativa: '' });
  const [respostas, setRespostas] = useState({});
  const [mensagem, setMensagem] = useState({ tipo: '', texto: '' });
  const [enviando, setEnviando] = useState(false);

  // O admin vê todas as sugestões. O leitor vê só as dele.
  const carregar = async (status = filtro) => {
    try {
      const caminho = admin
        ? `/api/sugestoes${status ? `?status=${status}` : ''}`
        : '/api/minhas-sugestoes';
      const response = await api(caminho);
      const data = await response.json();
      if (!response.ok) {
        setMensagem({ tipo: 'erro', texto: data.erro || 'Erro ao carregar sugestões.' });
        return;
      }
      setSugestoes(data.sugestoes);
    } catch (error) {
      console.error(error);
      setMensagem({ tipo: 'erro', texto: 'Não foi possível conectar ao servidor.' });
    }
  };

  useEffect(() => {
    carregar('');
  }, [admin]);

  // Grava a sugestão do leitor. Ela começa pendente.
  const enviar = async (e) => {
    e.preventDefault();
    setEnviando(true);
    try {
      const response = await api('/api/sugestoes', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      const data = await response.json();
      setMensagem({ tipo: response.ok ? 'sucesso' : 'erro', texto: data.mensagem || data.erro });
      if (response.ok) {
        setForm({ titulo_livro: '', autor: '', categoria: '', justificativa: '' });
        carregar();
      }
    } catch (error) {
      console.error(error);
      setMensagem({ tipo: 'erro', texto: 'Não foi possível conectar ao servidor.' });
    } finally {
      setEnviando(false);
    }
  };

  // Aprova ou rejeita. A resposta escrita é opcional.
  const analisar = async (id, status) => {
    try {
      const response = await api(`/api/sugestoes/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, resposta_admin: respostas[id] || '' }),
      });
      const data = await response.json();
      if (!response.ok) {
        setMensagem({ tipo: 'erro', texto: data.erro || 'Erro ao analisar a sugestão.' });
        return;
      }
      // Aprovar não cria o livro. Abre o formulário do acervo para o admin salvar.
      if (status === 'aprovada' && onAprovar) {
        const item = sugestoes.find((sugestao) => sugestao.id === id);
        onAprovar(item || { titulo_livro: '' });
        return;
      }
      setMensagem({ tipo: 'sucesso', texto: data.mensagem });
      carregar();
    } catch (error) {
      console.error(error);
      setMensagem({ tipo: 'erro', texto: 'Não foi possível conectar ao servidor.' });
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card larga">
        <div className="system-header">
          <h1 className="system-title">Biblioteca Pública Virtual</h1>
          <p className="system-subtitle">{admin ? 'Sugestões de livros' : 'Minhas sugestões'}</p>
          <QuemUsa usuario={usuario} />
        </div>

        {!admin && (
          <>
            <h2>Sugerir livro</h2>
            <form onSubmit={enviar}>
              <div className="input-group">
                <label htmlFor="titulo-sugestao">Título do livro</label>
                <input id="titulo-sugestao" value={form.titulo_livro} required onChange={(e) => setForm({ ...form, titulo_livro: e.target.value })} />
              </div>
              <div className="input-group">
                <label htmlFor="autor-sugestao">Autor (opcional)</label>
                <input id="autor-sugestao" value={form.autor} onChange={(e) => setForm({ ...form, autor: e.target.value })} />
              </div>
              <div className="input-group">
                <label htmlFor="categoria-sugestao">Categoria (opcional)</label>
                <input id="categoria-sugestao" value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} />
              </div>
              <div className="input-group">
                <label htmlFor="justificativa-sugestao">Justificativa (opcional)</label>
                <input id="justificativa-sugestao" value={form.justificativa} onChange={(e) => setForm({ ...form, justificativa: e.target.value })} />
              </div>
              <button type="submit" className="submit-btn" disabled={enviando}>
                {enviando ? 'Enviando...' : 'Enviar sugestão'}
              </button>
            </form>
          </>
        )}

        <h2>{admin ? 'Sugestões recebidas' : 'Histórico'}</h2>
        {admin && (
          <div className="input-group">
            <label htmlFor="filtro-status">Filtrar por status</label>
            <select id="filtro-status" value={filtro} onChange={(e) => { setFiltro(e.target.value); carregar(e.target.value); }}>
              <option value="">Todas</option>
              <option value="pendente">Pendentes</option>
              <option value="aprovada">Aprovadas</option>
              <option value="rejeitada">Rejeitadas</option>
            </select>
          </div>
        )}

        {sugestoes.length === 0 && <p className="toggle-text">Nenhuma sugestão.</p>}
        {sugestoes.map((item) => (
          <div key={item.id} className="obra-item">
            <strong>{item.titulo_livro}</strong>
            <span>{item.autor || 'Autor não informado'}{item.leitor ? ` · ${item.leitor}` : ''}</span>
            <span>{item.categoria || 'Sem categoria'} · {item.criado_em}</span>
            {item.justificativa && <span>{item.justificativa}</span>}
            <span className={item.status === 'rejeitada' ? 'status-inativo' : 'status-ativo'}>{rotulo[item.status]}</span>
            {item.resposta_admin && <span>Resposta: {item.resposta_admin}</span>}
            {admin && item.status === 'aprovada' && (
              <button type="button" className="toggle-btn" onClick={() => onAprovar?.(item)}>
                Cadastrar no acervo
              </button>
            )}
            {admin && item.status === 'pendente' && (
              <>
                <input
                  aria-label={`Resposta para ${item.titulo_livro}`}
                  placeholder="Resposta ao leitor (opcional)"
                  value={respostas[item.id] || ''}
                  onChange={(e) => setRespostas({ ...respostas, [item.id]: e.target.value })}
                />
                <button type="button" className="toggle-btn" onClick={() => analisar(item.id, 'aprovada')}>Aprovar</button>
                <button type="button" className="toggle-btn" onClick={() => analisar(item.id, 'rejeitada')}>Rejeitar</button>
              </>
            )}
          </div>
        ))}

        {mensagem.texto && <p className={`auth-message ${mensagem.tipo}`} role="status">{mensagem.texto}</p>}
        <Menu admin={admin} onIr={onIr} onLogout={onLogout} />
      </div>
    </div>
  );
}
