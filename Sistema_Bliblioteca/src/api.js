// Chamadas do site para a API. O endereço está fixo nesta máquina.
export const API = 'http://localhost:3001';

// Monta o endereço da imagem. Capa nova ainda está no navegador; capa salva fica no servidor.
export function urlCapa(capa) {
  if (!capa) return '';
  if (capa.startsWith('data:') || capa.startsWith('http')) return capa;
  return `${API}${capa}`;
}

// Lê o login que ficou salvo no navegador.
export function sessaoAtual() {
  const salvo = localStorage.getItem('usuario');
  return salvo ? JSON.parse(salvo) : null;
}

// Coloca o token em toda chamada que precisa de login.
export function cabecalhos() {
  const sessao = sessaoAtual();
  return {
    'Content-Type': 'application/json',
    ...(sessao?.token ? { Authorization: `Bearer ${sessao.token}` } : {}),
  };
}

// Faz a chamada para o servidor e trata sessão vencida.
export function api(caminho, opcoes = {}) {
  return fetch(`${API}${caminho}`, {
    ...opcoes,
    headers: { ...cabecalhos(), ...(opcoes.headers || {}) },
  }).then(async (response) => {
    // Sessão vencida ou conta inativada tira a pessoa do sistema.
    // Um 403 de "só o admin pode" não desloga.
    if (response.status === 401 || response.status === 403) {
      const data = await response.clone().json().catch(() => ({}));
      const erro = String(data.erro || '');
      const inativo = erro.includes('inativo') || erro.includes('bloqueado');
      if (response.status === 401 || inativo) {
        localStorage.removeItem('usuario');
        window.dispatchEvent(new Event('sessao-encerrada'));
      }
    }
    return response;
  });
}
