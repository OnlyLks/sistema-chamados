import React, { useEffect, useRef, useState } from 'react';
import { baixarAnexo, enviarAnexo, enviarMensagem, getChamadoDetalhe, listarMensagens } from '../api/endpoints';
import { getChatWebSocketUrl } from '../api/client';

const obterTipoLegado = (mensagem) => {
  if (mensagem.includes('Sistema:')) return 'sistema';
  if (mensagem.includes('TI (') || mensagem.includes('Suporte:')) return 'tecnico';
  return 'colaborador';
};

const ChatBox = ({ chamadoId, readonly = false }) => {
  const [mensagens, setMensagens] = useState([]);
  const [input, setInput] = useState('');
  const [arquivoSelecionado, setArquivoSelecionado] = useState(null);
  const [anexoUrls, setAnexoUrls] = useState({});
  const socketRef = useRef(null);
  const arquivoInputRef = useRef(null);
  const mensagensRef = useRef(null);
  const deveRolarRef = useRef(true);
  const anexoUrlsRef = useRef({});

  useEffect(() => {
    setAnexoUrls({});
    anexoUrlsRef.current = {};
    setArquivoSelecionado(null);
    return () => {
      Object.values(anexoUrlsRef.current).forEach((url) => URL.revokeObjectURL(url));
      anexoUrlsRef.current = {};
    };
  }, [chamadoId]);

  useEffect(() => {
    let cancelado = false;
    const carregarAnexos = async () => {
      const pendentes = mensagens.filter(
        (mensagem) => mensagem.tipo_conteudo === 'imagem' && !anexoUrlsRef.current[mensagem.id],
      );
      for (const mensagem of pendentes) {
        try {
          const resposta = await baixarAnexo(chamadoId, mensagem.id);
          const url = URL.createObjectURL(resposta.data);
          if (cancelado) {
            URL.revokeObjectURL(url);
            return;
          }
          anexoUrlsRef.current[mensagem.id] = url;
          setAnexoUrls({ ...anexoUrlsRef.current });
        } catch (err) {
          console.error(err);
        }
      }
    };
    carregarAnexos();
    return () => { cancelado = true; };
  }, [mensagens, chamadoId]);

  useEffect(() => {
    const container = mensagensRef.current;
    if (!container || !deveRolarRef.current) return undefined;

    const frame = window.requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [mensagens]);

  const carregarChat = async () => {
    try {
      const [detalhe, mensagensNovas] = await Promise.all([
        getChamadoDetalhe(chamadoId),
        listarMensagens(chamadoId),
      ]);
      const historicoLegado = (detalhe.data.historico_chat || '')
        .split('\n')
        .filter((linha) => linha.trim())
        .map((conteudo, indice) => ({
          id: `legado-${indice}`,
          autor_tipo: obterTipoLegado(conteudo),
          conteudo,
          legado: true,
        }));
      setMensagens([...historicoLegado, ...mensagensNovas.data]);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    let desmontado = false;
    let reconexao;

    const conectar = () => {
      const socket = new WebSocket(getChatWebSocketUrl(chamadoId));
      socketRef.current = socket;

      socket.onmessage = (evento) => {
        const dados = JSON.parse(evento.data);
        if (dados.tipo !== 'mensagem') return;
        setMensagens((atuais) => (
          atuais.some((mensagem) => mensagem.id === dados.mensagem.id)
            ? atuais
            : [...atuais, dados.mensagem]
        ));
      };

      socket.onclose = () => {
        if (!desmontado) reconexao = window.setTimeout(conectar, 3000);
      };
    };

    carregarChat();
    conectar();

    return () => {
      desmontado = true;
      window.clearTimeout(reconexao);
      socketRef.current?.close();
    };
  }, [chamadoId]);

  const enviar = async () => {
    if (readonly || (!input.trim() && !arquivoSelecionado)) return;
    try {
      if (arquivoSelecionado) {
        await enviarAnexo(chamadoId, arquivoSelecionado, input);
        setArquivoSelecionado(null);
        if (arquivoInputRef.current) arquivoInputRef.current.value = '';
      } else {
        await enviarMensagem(chamadoId, input.trim());
      }
      setInput('');
      // A mensagem enviada pelo próprio usuário deve ficar visível imediatamente.
      deveRolarRef.current = true;
      const container = mensagensRef.current;
      if (container) {
        window.requestAnimationFrame(() => {
          container.scrollTop = container.scrollHeight;
        });
      }
      if (socketRef.current?.readyState !== WebSocket.OPEN) carregarChat();
    } catch (err) {
      alert(err.response?.data?.detail || 'Erro ao enviar mensagem');
    }
  };

  const selecionarArquivo = (evento) => {
    const arquivo = evento.target.files?.[0] || null;
    if (!arquivo) return;
    if (arquivo.size > 10 * 1024 * 1024) {
      alert('A imagem deve ter no máximo 10 MB');
      evento.target.value = '';
      return;
    }
    setArquivoSelecionado(arquivo);
  };

  const exibirMensagem = (mensagem) => {
    if (mensagem.legado) return mensagem.conteudo;
    const hora = new Date(mensagem.criado_em).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
    const remetente = mensagem.autor_tipo === 'sistema'
      ? 'Sistema'
      : mensagem.autor_tipo === 'tecnico'
        ? `TI (${mensagem.autor_nome})`
        : mensagem.autor_nome;
    return `[${hora}] ${remetente}: ${mensagem.conteudo}`;
  };

  return (
    <div className="chat-box">
      <div
        className="chat-messages"
        ref={mensagensRef}
        onScroll={(evento) => {
          const container = evento.currentTarget;
          const distanciaDoFim = container.scrollHeight - container.scrollTop - container.clientHeight;
          deveRolarRef.current = distanciaDoFim <= 64;
        }}
      >
        {mensagens.map((mensagem) => (
          <div key={mensagem.id} className={`chat-message ${mensagem.autor_tipo}`}>
            {mensagem.tipo_conteudo === 'imagem' && (
              anexoUrls[mensagem.id]
                ? <a href={anexoUrls[mensagem.id]} target="_blank" rel="noreferrer"><img className="chat-attachment" src={anexoUrls[mensagem.id]} alt={mensagem.anexo_nome || 'Imagem anexada'} /></a>
                : <span className="chat-attachment-loading">Carregando imagem...</span>
            )}
            {exibirMensagem(mensagem)}
          </div>
        ))}
      </div>
      {!readonly && (
        <div className="chat-input">
          <label className="chat-attach-button" title="Adicionar imagem">
            📎
            <input ref={arquivoInputRef} type="file" accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp" onChange={selecionarArquivo} />
          </label>
          <div className="chat-compose">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Digite sua mensagem..."
              onKeyDown={(e) => e.key === 'Enter' && enviar()}
            />
            {arquivoSelecionado && <span className="chat-selected-file" title={arquivoSelecionado.name}>📎 {arquivoSelecionado.name}</span>}
          </div>
          <button onClick={enviar} disabled={!input.trim() && !arquivoSelecionado}>Enviar</button>
        </div>
      )}
    </div>
  );
};

export default ChatBox;
