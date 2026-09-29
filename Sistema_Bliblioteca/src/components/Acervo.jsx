// Acervo: lista, ficha, cadastro e leitura do PDF.
import { useEffect, useRef, useState } from 'react';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { api, urlCapa } from '../api.js';
import Menu from './Menu';
import QuemUsa from './QuemUsa';
import './Auth.css';

GlobalWorkerOptions.workerSrc = workerUrl;

// Desenha uma página do PDF por vez.
// A tarefa de abertura é encerrada ao fechar; o documento do pdfjs 6 não tem destroy().
function PaginasPdf({ dados }) {
  const caixa = useRef(null);
  const pdfRef = useRef(null);
  const tarefaRef = useRef(null);
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [total, setTotal] = useState(0);
  const [erro, setErro] = useState('');

  useEffect(() => {
    let cancelado = false;
    setPaginaAtual(1);
    setErro('');
    const tarefa = getDocument({
      data: dados.slice(),
      wasmUrl: `${import.meta.env.BASE_URL}pdfjs-wasm/`,
    });
    tarefaRef.current = tarefa;
    tarefa.promise.then((pdf) => {
      if (cancelado) return;
      pdfRef.current = pdf;
      setTotal(pdf.numPages);
    }).catch(() => {
      if (!cancelado) setErro('Não foi possível mostrar o PDF.');
    });
    return () => {
      cancelado = true;
      pdfRef.current = null;
      const encerrar = tarefaRef.current?.destroy;
      if (typeof encerrar === 'function') {
        Promise.resolve(encerrar.call(tarefaRef.current)).catch(() => {});
      }
      tarefaRef.current = null;
    };
  }, [dados]);

  useEffect(() => {
    const destino = caixa.current;
    const pdf = pdfRef.current;
    if (!destino || !pdf || !paginaAtual) return undefined;
    let cancelado = false;
    let renderizacao = null;
    (async () => {
      const pagina = await pdf.getPage(paginaAtual);
      if (cancelado) return;
      const viewport = pagina.getViewport({ scale: 1.35 });
      const canvas = document.createElement('canvas');
      canvas.className = 'pdf-pagina';
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.setAttribute('aria-label', `Página ${paginaAtual}`);
      renderizacao = pagina.render({
        canvas,
        canvasContext: canvas.getContext('2d'),
        viewport,
      });
      await renderizacao.promise;
      if (cancelado) return;
      destino.replaceChildren(canvas);
    })().catch(() => {
      if (!cancelado && destino) destino.textContent = 'Não foi possível mostrar esta página.';
    });
    return () => {
      cancelado = true;
      if (typeof renderizacao?.cancel === 'function') {
        try {
          renderizacao.cancel();
        } catch {
          /* a leitura já foi fechada */
        }
      }
    };
  }, [paginaAtual, total]);

  return (
    <div className="pdf-leitura">
      <div className="pdf-controles">
        <button type="button" className="pdf-fechar" disabled={paginaAtual <= 1} onClick={() => setPaginaAtual((n) => n - 1)}>
          Página anterior
        </button>
        <span>{total ? `${paginaAtual} de ${total}` : 'Abrindo...'}</span>
        <button type="button" className="pdf-fechar" disabled={!total || paginaAtual >= total} onClick={() => setPaginaAtual((n) => n + 1)}>
          Próxima página
        </button>
      </div>
      {erro ? <p className="pdf-erro">{erro}</p> : <div ref={caixa} className="pdf-paginas" />}
    </div>
  );
}

const vazio = {
  titulo: '', autor: '', categoria: '', descricao: '',
  capaAtual: '', capaNova: '', removerCapa: false,
  temPdf: false, pdfArquivo: null, removerPdf: false,
};

// Se o livro não tem imagem, mostra a primeira letra do título.
function CapaLivro({ capa, titulo, grande = false }) {
  const classe = grande ? 'obra-capa grande' : 'obra-capa';
  if (capa) {
    return <img className={classe} src={urlCapa(capa)} alt={`Capa de ${titulo}`} />;
  }
  const letra = (titulo || '?').trim().charAt(0).toLocaleUpperCase('pt-BR') || '?';
  return <span className={`${classe} sem-imagem`} aria-hidden="true">{letra}</span>;
}

export default function Acervo({ usuario, onIr, onLogout, podeGerir, sugestaoInicial, onSugestaoUsada }) {
  const [tela, setTela] = useState('lista');
  const [obras, setObras] = useState([]);
  const [obra, setObra] = useState(null);
  const [form, setForm] = useState(vazio);
  const [mensagem, setMensagem] = useState({ tipo: '', texto: '' });
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [confirmarRemocao, setConfirmarRemocao] = useState(false);
  const [busca, setBusca] = useState('');
  const [leitura, setLeitura] = useState(null);

  const pedidoBusca = useRef(0);

  // Busca o acervo. Se a pessoa digitou de novo, a resposta velha é ignorada.
  const carregarLista = async (termo = '') => {
    const pedido = ++pedidoBusca.current;
    setCarregando(true);
    try {
      const response = await api(`/api/obras?q=${encodeURIComponent(termo)}`);
      const data = await response.json();
      if (pedido !== pedidoBusca.current) return;
      if (!response.ok) {
        setMensagem({ tipo: 'erro', texto: data.erro || 'Erro ao listar as obras.' });
        return;
      }
      setObras(data.obras);
    } catch (error) {
      console.error(error);
      if (pedido === pedidoBusca.current) {
        setMensagem({ tipo: 'erro', texto: 'Não foi possível conectar ao servidor.' });
      }
    } finally {
      if (pedido === pedidoBusca.current) setCarregando(false);
    }
  };

  // Espera um pouco para não buscar a cada tecla. Resposta atrasada é ignorada.
  useEffect(() => {
    const timer = setTimeout(() => {
      carregarLista(busca);
    }, 300);
    return () => clearTimeout(timer);
  }, [busca]);

  useEffect(() => {
    if (!sugestaoInicial) return;
    setForm({
      ...vazio,
      titulo: sugestaoInicial.titulo,
      autor: sugestaoInicial.autor,
      categoria: sugestaoInicial.categoria,
    });
    setObra(null);
    setTela('cadastro');
    setMensagem({
      tipo: 'sucesso',
      texto: 'Sugestão aprovada. Confira os dados e salve a obra no acervo.',
    });
    onSugestaoUsada?.();
  }, [sugestaoInicial]);

  useEffect(() => {
    if (!leitura) return undefined;
    const fechar = (evento) => {
      if (evento.key === 'Escape') fecharLeitura();
    };
    window.addEventListener('keydown', fechar);
    return () => window.removeEventListener('keydown', fechar);
  }, [leitura]);

  // Abre a ficha de um livro.
  const abrirDetalhe = async (id) => {
    setMensagem({ tipo: '', texto: '' });
    setConfirmarRemocao(false);
    try {
      const response = await api(`/api/obras/${id}`);
      const data = await response.json();
      if (!response.ok) {
        setMensagem({ tipo: 'erro', texto: data.erro || 'Erro ao abrir a obra.' });
        return;
      }
      setObra(data.obra);
      setTela('detalhe');
    } catch (error) {
      console.error(error);
      setMensagem({ tipo: 'erro', texto: 'Não foi possível conectar ao servidor.' });
    }
  };

  // Formulário vazio para um livro novo.
  const abrirCadastro = () => {
    setForm(vazio);
    setMensagem({ tipo: '', texto: '' });
    setTela('cadastro');
  };

  // Preenche o formulário com o que o livro já tem.
  const abrirEdicao = () => {
    setForm({
      titulo: obra.titulo,
      autor: obra.autor,
      categoria: obra.categoria,
      descricao: obra.descricao || '',
      capaAtual: obra.capa || '',
      capaNova: '',
      removerCapa: false,
      temPdf: Boolean(obra.tem_pdf),
      pdfArquivo: null,
      removerPdf: false,
    });
    setMensagem({ tipo: '', texto: '' });
    setTela('edicao');
  };

  // Atualiza título, autor, categoria e descrição.
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  // Só aceita JPG, PNG ou WebP, até 1,5 MB.
  const escolherCapa = (e) => {
    const arquivo = e.target.files?.[0];
    e.target.value = '';
    if (!arquivo) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(arquivo.type)) {
      setMensagem({ tipo: 'erro', texto: 'Use uma imagem JPG, PNG ou WebP.' });
      return;
    }
    if (arquivo.size > 1_500_000) {
      setMensagem({ tipo: 'erro', texto: 'A capa deve ter no máximo 1,5 MB.' });
      return;
    }
    const leitor = new FileReader();
    leitor.onload = () => {
      setForm((prev) => ({ ...prev, capaNova: String(leitor.result), removerCapa: false }));
      setMensagem({ tipo: '', texto: '' });
    };
    leitor.readAsDataURL(arquivo);
  };

  // O PDF é opcional e tem limite de 15 MB.
  const escolherPdf = (e) => {
    const arquivo = e.target.files?.[0];
    e.target.value = '';
    if (!arquivo) return;
    const ehPdf = arquivo.type === 'application/pdf' || arquivo.name.toLowerCase().endsWith('.pdf');
    if (!ehPdf) {
      setMensagem({ tipo: 'erro', texto: 'Anexe um arquivo PDF.' });
      return;
    }
    if (arquivo.size > 15_000_000) {
      setMensagem({ tipo: 'erro', texto: 'O PDF deve ter no máximo 15 MB.' });
      return;
    }
    setForm((prev) => ({ ...prev, pdfArquivo: arquivo, removerPdf: false }));
    setMensagem({ tipo: '', texto: '' });
  };

  // Salva os dados do livro e, se tiver arquivo, anexa o PDF em seguida.
  const salvar = async (e) => {
    e.preventDefault();
    setMensagem({ tipo: '', texto: '' });
    setSalvando(true);

    const payload = {
      titulo: form.titulo,
      autor: form.autor,
      categoria: form.categoria,
      descricao: form.descricao,
    };
    if (form.removerCapa) payload.capa = '';
    else if (form.capaNova) payload.capa = form.capaNova;
    const editando = tela === 'edicao';

    try {
      const response = await api(editando ? `/api/obras/${obra.id}` : '/api/obras', {
        method: editando ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        setMensagem({ tipo: 'erro', texto: data.erro || 'Erro ao salvar a obra.' });
        return;
      }
      let obraSalva = data.obra;
      let avisoPdf = '';
      if (form.removerPdf && !form.pdfArquivo) {
        const pdfRes = await api(`/api/obras/${obraSalva.id}/pdf`, { method: 'DELETE' });
        const pdfData = await pdfRes.json();
        if (!pdfRes.ok) avisoPdf = pdfData.erro || 'Não foi possível remover o PDF.';
        else obraSalva = pdfData.obra;
      } else if (form.pdfArquivo) {
        const pdfRes = await api(`/api/obras/${obraSalva.id}/pdf`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/pdf' },
          body: form.pdfArquivo,
        });
        const pdfData = await pdfRes.json().catch(() => ({}));
        if (!pdfRes.ok) avisoPdf = pdfData.erro || 'A obra foi salva, mas o PDF não foi anexado.';
        else obraSalva = pdfData.obra;
      }
      setObra(obraSalva);
      setMensagem({
        tipo: avisoPdf ? 'erro' : 'sucesso',
        texto: avisoPdf || data.mensagem,
      });
      setTela('detalhe');
      carregarLista(busca);
    } catch (error) {
      console.error(error);
      setMensagem({ tipo: 'erro', texto: 'Não foi possível conectar ao servidor.' });
    } finally {
      setSalvando(false);
    }
  };

  // Tira o livro da lista. Ele não é apagado do banco, só sai do acervo ativo.
  const remover = async () => {
    setSalvando(true);
    try {
      const response = await api(`/api/obras/${obra.id}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) {
        setMensagem({ tipo: 'erro', texto: data.erro || 'Erro ao remover a obra.' });
        return;
      }
      setObra(null);
      setConfirmarRemocao(false);
      setTela('lista');
      setMensagem({ tipo: 'sucesso', texto: data.mensagem });
      carregarLista(busca);
    } catch (error) {
      console.error(error);
      setMensagem({ tipo: 'erro', texto: 'Não foi possível conectar ao servidor.' });
    } finally {
      setSalvando(false);
    }
  };

  // Fecha o leitor e libera o arquivo que estava na memória.
  const fecharLeitura = () => {
    setLeitura((atual) => {
      if (atual?.url) URL.revokeObjectURL(atual.url);
      return null;
    });
  };

  // Abre a leitura na hora. Sem PDF, a tela mostra uma página em branco.
  const lerAgora = async () => {
    fecharLeitura();
    try {
      const response = await api(`/api/obras/${obra.id}/leitura`);
      const data = await response.json();
      if (!response.ok) {
        setMensagem({ tipo: 'erro', texto: data.erro || 'Não foi possível abrir a leitura.' });
        return;
      }
      if (data.leitura.temPdf) {
        const arquivo = await api(`/api/obras/${obra.id}/arquivo`);
        if (!arquivo.ok) {
          const erro = await arquivo.json().catch(() => ({}));
          setMensagem({ tipo: 'erro', texto: erro.erro || 'Não foi possível abrir o PDF.' });
          return;
        }
        const buffer = await arquivo.arrayBuffer();
        setMensagem({ tipo: '', texto: '' });
        setLeitura({ ...data.leitura, dados: new Uint8Array(buffer) });
        return;
      }
      setMensagem({ tipo: '', texto: '' });
      setLeitura(data.leitura);
    } catch (error) {
      console.error(error);
      setMensagem({ tipo: 'erro', texto: 'Não foi possível conectar ao servidor.' });
    }
  };

  // Volta para a busca sem salvar.
  const voltarLista = () => {
    setTela('lista');
    setConfirmarRemocao(false);
    setMensagem({ tipo: '', texto: '' });
  };

  return (
    <div className="auth-container">
      <div className="auth-card larga">
        <div className="system-header">
          <h1 className="system-title">Biblioteca Pública Virtual</h1>
          <p className="system-subtitle">Acervo de obras</p>
          <QuemUsa usuario={usuario} />
        </div>

        {tela === 'lista' && (
          <>
            <h2>Buscar obra</h2>
            <div className="input-group">
              <label htmlFor="busca-obra">Título, autor ou categoria</label>
              <input
                id="busca-obra"
                value={busca}
                placeholder="Digite para buscar"
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
            {podeGerir && (
              <button type="button" className="submit-btn" onClick={abrirCadastro}>
                Cadastrar obra
              </button>
            )}
            {carregando && <p className="toggle-text">Carregando acervo...</p>}
            {!carregando && obras.length === 0 && (
              <p className="toggle-text">Nenhuma obra no acervo ativo.</p>
            )}
            <div className="obra-lista">
              {obras.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="obra-item com-capa"
                  onClick={() => abrirDetalhe(item.id)}
                >
                  <CapaLivro capa={item.capa} titulo={item.titulo} />
                  <span className="obra-dados">
                    <strong>{item.titulo}</strong>
                    <span>{item.autor}</span>
                    <span>{item.categoria}</span>
                  </span>
                </button>
              ))}
            </div>
          </>
        )}

        {(tela === 'cadastro' || tela === 'edicao') && (
          <>
            <h2>{tela === 'cadastro' ? 'Cadastrar obra' : 'Atualizar obra'}</h2>
            <form onSubmit={salvar}>
              <div className="input-group">
                <label>Título</label>
                <input name="titulo" value={form.titulo} onChange={handleChange} required />
              </div>
              <div className="input-group">
                <label>Autor</label>
                <input name="autor" value={form.autor} onChange={handleChange} required />
              </div>
              <div className="input-group">
                <label>Categoria</label>
                <input name="categoria" value={form.categoria} onChange={handleChange} required />
              </div>
              <div className="input-group">
                <label htmlFor="descricao-obra">Descrição (opcional)</label>
                <textarea
                  id="descricao-obra"
                  name="descricao"
                  value={form.descricao}
                  onChange={handleChange}
                  rows={4}
                  placeholder="Uma informação a mais sobre o livro"
                />
              </div>
              <div className="input-group">
                <label htmlFor="capa-obra">Capa do livro (opcional)</label>
                <CapaLivro
                  capa={form.capaNova || (!form.removerCapa ? form.capaAtual : '')}
                  titulo={form.titulo || 'Livro'}
                  grande
                />
                <input id="capa-obra" type="file" accept="image/jpeg,image/png,image/webp" onChange={escolherCapa} />
                {(form.capaNova || (form.capaAtual && !form.removerCapa)) && (
                  <button
                    type="button"
                    className="submit-btn secundario"
                    onClick={() => setForm((prev) => ({ ...prev, capaNova: '', removerCapa: true }))}
                  >
                    Remover capa
                  </button>
                )}
              </div>
              <div className="input-group">
                <label htmlFor="pdf-obra">PDF do livro (opcional)</label>
                <p className="toggle-text">
                  {form.pdfArquivo
                    ? form.pdfArquivo.name
                    : form.temPdf && !form.removerPdf
                      ? 'PDF já anexado'
                      : 'Nenhum PDF anexado'}
                </p>
                <input id="pdf-obra" type="file" accept="application/pdf,.pdf" onChange={escolherPdf} />
                {(form.pdfArquivo || (form.temPdf && !form.removerPdf)) && (
                  <button
                    type="button"
                    className="submit-btn secundario"
                    onClick={() => setForm((prev) => ({ ...prev, pdfArquivo: null, removerPdf: true }))}
                  >
                    Remover PDF
                  </button>
                )}
              </div>
              <button type="submit" className="submit-btn" disabled={salvando}>
                {salvando ? 'Salvando...' : tela === 'cadastro' ? 'Cadastrar' : 'Salvar alterações'}
              </button>
              <button type="button" className="submit-btn secundario" onClick={voltarLista}>
                Cancelar
              </button>
            </form>
          </>
        )}

        {tela === 'detalhe' && obra && (
          <>
            <h2>{obra.titulo}</h2>
            <CapaLivro capa={obra.capa} titulo={obra.titulo} grande />
            <dl className="perfil-lista">
              <div>
                <dt>Autor</dt>
                <dd>{obra.autor}</dd>
              </div>
              <div>
                <dt>Categoria</dt>
                <dd>{obra.categoria}</dd>
              </div>
              {obra.descricao && (
                <div className="descricao-linha">
                  <dt>Descrição</dt>
                  <dd>{obra.descricao}</dd>
                </div>
              )}
              <div>
                <dt>Cadastrada em</dt>
                <dd>{obra.criado_em || '—'}</dd>
              </div>
              <div>
                <dt>PDF</dt>
                <dd>{obra.tem_pdf ? 'Anexado' : 'Sem arquivo'}</dd>
              </div>
            </dl>

            {podeGerir && (
              <button type="button" className="submit-btn" onClick={abrirEdicao}>
                Atualizar obra
              </button>
            )}

            {podeGerir && !confirmarRemocao && (
              <button
                type="button"
                className="submit-btn perigo"
                onClick={() => setConfirmarRemocao(true)}
              >
                Remover do acervo
              </button>
            )}

            {confirmarRemocao && (
              <>
                <p className="auth-message erro" role="status">
                  Remover esta obra do acervo ativo? O registro deixa de aparecer na biblioteca.
                </p>
                <button type="button" className="submit-btn perigo" disabled={salvando} onClick={remover}>
                  {salvando ? 'Removendo...' : 'Confirmar remoção'}
                </button>
                <button
                  type="button"
                  className="submit-btn secundario"
                  onClick={() => setConfirmarRemocao(false)}
                >
                  Cancelar
                </button>
              </>
            )}

            <button type="button" className="submit-btn" onClick={lerAgora}>
              Ler agora
            </button>
            <button type="button" className="submit-btn secundario" onClick={voltarLista}>
              Voltar à lista
            </button>
          </>
        )}

        {mensagem.texto && (
          <p className={`auth-message ${mensagem.tipo}`} role="status">
            {mensagem.texto}
          </p>
        )}

        <Menu admin={podeGerir} onIr={onIr} onLogout={onLogout} />
      </div>
      {leitura && (
        <div className="pdf-leitor" role="dialog" aria-modal="true" aria-label={`Leitura de ${leitura.titulo}`}>
          <div className="pdf-barra">
            <strong>{leitura.titulo}{leitura.autor ? ` — ${leitura.autor}` : ''}</strong>
            <button type="button" className="pdf-fechar" onClick={fecharLeitura}>
              Fechar
            </button>
          </div>
          <div
            className="pdf-area"
            onCopy={(e) => e.preventDefault()}
            onCut={(e) => e.preventDefault()}
            onContextMenu={(e) => e.preventDefault()}
          >
            {leitura.dados ? (
              <PaginasPdf dados={leitura.dados} />
            ) : (
              <article className="pdf-pagina" aria-label="Página em branco de exemplo" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
