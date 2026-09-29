// Validação de CPF usada no cadastro e na atualização do leitor.
// Fica só com os números. Ponto e traço da máscara não vão para o banco.
export function somenteDigitos(cpf) {
  return String(cpf ?? "").replace(/\D/g, "");
}

// Mostra o CPF no formato 000.000.000-00 enquanto a pessoa digita.
export function formatarCpf(cpf) {
  const digitos = somenteDigitos(cpf).slice(0, 11);
  if (digitos.length <= 3) return digitos;
  if (digitos.length <= 6) return `${digitos.slice(0, 3)}.${digitos.slice(3)}`;
  if (digitos.length <= 9) {
    return `${digitos.slice(0, 3)}.${digitos.slice(3, 6)}.${digitos.slice(6)}`;
  }
  return `${digitos.slice(0, 3)}.${digitos.slice(3, 6)}.${digitos.slice(6, 9)}-${digitos.slice(9)}`;
}

// Confere os dois dígitos do CPF. Uma sequência com todos os números iguais é inválida.
export function cpfValido(cpf) {
  const digitos = somenteDigitos(cpf);
  if (!/^\d{11}$/.test(digitos)) return false;
  if (/^(\d)\1{10}$/.test(digitos)) return false;

  // Conta oficial do dígito: multiplica, soma e tira o resto.
  const digito = (base, pesoInicial) => {
    let soma = 0;
    for (let i = 0; i < base.length; i += 1) {
      soma += Number(base[i]) * (pesoInicial - i);
    }
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  const primeiro = digito(digitos.slice(0, 9), 10);
  const segundo = digito(digitos.slice(0, 10), 11);
  return primeiro === Number(digitos[9]) && segundo === Number(digitos[10]);
}
