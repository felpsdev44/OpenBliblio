// Primeira tela do site, antes do login.
import './Auth.css';

export default function Introducao({ onAcessar }) {
  return (
    <div className="auth-container">
      <div className="auth-card intro-card">
        <div className="system-header">
          <h1 className="system-title">OpenBiblio</h1>
          <p className="system-subtitle">Biblioteca Pública Virtual</p>
        </div>

        <h2 className="intro-boas-vindas">Seja bem-vindo</h2>
        <p className="intro-texto">
          Sistema para gestão, disponibilização e acesso público virtual a acervos bibliográficos digitais.
        </p>

        <button type="button" className="submit-btn" onClick={onAcessar}>
          Acessar o sistema
        </button>
      </div>
    </div>
  );
}
