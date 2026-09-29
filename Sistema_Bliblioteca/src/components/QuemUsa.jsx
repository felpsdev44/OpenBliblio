// Mostra quem está logado, por exemplo "usuário - Felipe" ou "admin - Felipe".
// Usa só o primeiro nome, com a inicial maiúscula.
function nomeCurto(nome) {
  const parte = String(nome || '').trim().split(/\s+/)[0] || '';
  if (!parte) return '';
  const minuscula = parte.toLocaleLowerCase('pt-BR');
  return minuscula.charAt(0).toLocaleUpperCase('pt-BR') + minuscula.slice(1);
}

// Leitor aparece como "usuário". Qualquer outro perfil aparece como "admin".
function rotuloQuemUsa(usuario) {
  const papel = usuario?.perfil === 'leitor' ? 'usuário' : 'admin';
  return `${papel} - ${nomeCurto(usuario?.nome)}`;
}

export default function QuemUsa({ usuario }) {
  if (!usuario?.nome) return null;
  return (
    <p className="quem-usa" aria-live="polite">
      {rotuloQuemUsa(usuario)}
    </p>
  );
}
