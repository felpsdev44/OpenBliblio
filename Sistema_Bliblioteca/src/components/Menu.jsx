// Menu das telas internas. Leitores e relatório só aparecem para o admin.
export default function Menu({ admin, onIr, onLogout }) {
  // Liga ou desliga o contraste e guarda a escolha no navegador.
  const alternarContraste = () => {
    const ativo = document.documentElement.classList.toggle('alto-contraste');
    localStorage.setItem('alto-contraste', ativo ? '1' : '0');
  };

  return (
    <p className="toggle-text">
      <button type="button" className="toggle-btn" onClick={alternarContraste}>
        Alto contraste
      </button>
      <button type="button" className="toggle-btn" onClick={() => onIr('perfil')}>Perfil</button>
      <button type="button" className="toggle-btn" onClick={() => onIr('acervo')}>Acervo</button>
      <button type="button" className="toggle-btn" onClick={() => onIr('sugestoes')}>Sugestões</button>
      {admin && (
        <>
          <button type="button" className="toggle-btn" onClick={() => onIr('leitores')}>Leitores</button>
          <button type="button" className="toggle-btn" onClick={() => onIr('relatorio')}>Relatório</button>
        </>
      )}
      <button type="button" className="toggle-btn" onClick={onLogout}>Sair</button>
    </p>
  );
}
