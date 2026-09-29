// Números do acervo, dos leitores e das sugestões. Só o admin vê.
import { useEffect, useState } from 'react';
import { api } from '../api.js';
import Menu from './Menu';
import QuemUsa from './QuemUsa';
import './Auth.css';

const rotulos = {
  leitoresAtivos: 'Leitores ativos',
  leitoresInativos: 'Leitores inativos',
  obrasAtivas: 'Obras no acervo',
  sugestoesPendentes: 'Sugestões pendentes',
  sugestoesAprovadas: 'Sugestões aprovadas',
  sugestoesRejeitadas: 'Sugestões rejeitadas',
};

export default function Relatorio({ usuario, onIr, onLogout }) {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState('');

  // Busca as contagens assim que a tela abre.
  useEffect(() => {
    api('/api/relatorio')
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) setErro(data.erro || 'Erro ao gerar o relatório.');
        else setDados(data.relatorio);
      })
      .catch(() => setErro('Não foi possível conectar ao servidor.'));
  }, []);

  return (
    <div className="auth-container">
      <div className="auth-card larga">
        <div className="system-header">
          <h1 className="system-title">Biblioteca Pública Virtual</h1>
          <p className="system-subtitle">Relatório de gestão</p>
          <QuemUsa usuario={usuario} />
        </div>
        {erro && <p className="auth-message erro" role="status">{erro}</p>}
        {dados && (
          <dl className="perfil-lista">
            {Object.entries(rotulos).map(([chave, rotulo]) => (
              <div key={chave}><dt>{rotulo}</dt><dd>{dados[chave]}</dd></div>
            ))}
          </dl>
        )}
        <Menu admin onIr={onIr} onLogout={onLogout} />
      </div>
    </div>
  );
}
