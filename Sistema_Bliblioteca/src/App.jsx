// Escolhe a tela conforme o login e o perfil. Não há um endereço diferente para cada tela.
import { useEffect, useState } from 'react';
import Auth from './components/Auth';
import Introducao from './components/Introducao';
import PerfilLeitor from './components/PerfilLeitor';
import Acervo from './components/Acervo';
import Leitores from './components/Leitores';
import Sugestoes from './components/Sugestoes';
import Relatorio from './components/Relatorio';
import { api, sessaoAtual } from './api.js';

function App() {
  const [usuario, setUsuario] = useState(null);
  const [pronto, setPronto] = useState(false);
  const [area, setArea] = useState('acervo');
  const [sugestaoInicial, setSugestaoInicial] = useState(null);
  const [mostrarLogin, setMostrarLogin] = useState(false);

  // Quando a API avisa que a sessão acabou, volta para a tela de entrar.
  useEffect(() => {
    const encerrar = () => {
      setUsuario(null);
      setArea('acervo');
      setMostrarLogin(false);
    };
    window.addEventListener('sessao-encerrada', encerrar);
    return () => window.removeEventListener('sessao-encerrada', encerrar);
  }, []);

  useEffect(() => {
    const salva = sessaoAtual();
    if (!salva?.token) {
      setPronto(true);
      return;
    }

    // Confere se a sessão salva ainda vale. Se o servidor estiver fora, a pessoa continua logada.
    api('/api/eu')
      .then(async (response) => {
        if (response.status === 401 || response.status === 403) {
          localStorage.removeItem('usuario');
          setUsuario(null);
          return;
        }
        if (!response.ok) {
          setUsuario(salva);
          return;
        }
        const data = await response.json();
        const sessao = { ...data.usuario, token: salva.token };
        localStorage.setItem('usuario', JSON.stringify(sessao));
        setUsuario(sessao);
      })
      .catch(() => setUsuario(salva))
      .finally(() => setPronto(true));
  }, []);

  // Encerra a sessão no servidor e limpa o que estava salvo no navegador.
  const sair = async () => {
    try {
      await api('/api/sessao', { method: 'DELETE' });
    } catch (error) {
      console.error(error);
    }
    localStorage.removeItem('usuario');
    setUsuario(null);
    setArea('perfil');
    setMostrarLogin(false);
  };

  if (!pronto) {
    return null;
  }

  if (!usuario && !mostrarLogin) {
    return <Introducao onAcessar={() => setMostrarLogin(true)} />;
  }

  if (!usuario) {
    return (
      <Auth
        onLogin={(sessao) => { setUsuario(sessao); setArea('acervo'); }}
        onVoltar={() => setMostrarLogin(false)}
      />
    );
  }

  // Admin Master é o único perfil com as telas de gestão.
  const admin = usuario.perfil === 'admin_master';
  const onIr = (destino) => setArea(destino);
  // Leva título, autor e categoria da sugestão para o formulário de obra.
  const abrirCadastroDaSugestao = (item) => {
    setSugestaoInicial({
      titulo: item.titulo_livro || '',
      autor: item.autor || '',
      categoria: item.categoria || '',
    });
    setArea('acervo');
  };

  if (area === 'sugestoes') {
    return <Sugestoes usuario={usuario} admin={admin} onIr={onIr} onLogout={sair} onAprovar={abrirCadastroDaSugestao} />;
  }
  if (area === 'relatorio' && admin) {
    return <Relatorio usuario={usuario} onIr={onIr} onLogout={sair} />;
  }

  if (area === 'acervo') {
    return (
      <Acervo
        usuario={usuario}
        podeGerir={admin}
        onIr={onIr}
        onLogout={sair}
        sugestaoInicial={sugestaoInicial}
        onSugestaoUsada={() => setSugestaoInicial(null)}
      />
    );
  }

  if (area === 'leitores' && admin) {
    return (
      <Leitores
        usuario={usuario}
        onIr={onIr}
        onLogout={sair}
      />
    );
  }

  return (
    <PerfilLeitor
      usuario={usuario}
      usuarioId={usuario.id}
      onLogout={sair}
      onNomeAlterado={(nome) => setUsuario((atual) => ({ ...atual, nome }))}
      onIrAcervo={() => setArea('acervo')}
      onIrSugestoes={() => setArea('sugestoes')}
      onIrLeitores={admin ? () => setArea('leitores') : null}
      onIrRelatorio={admin ? () => setArea('relatorio') : null}
    />
  );
}

export default App;
