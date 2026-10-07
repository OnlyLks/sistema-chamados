import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import ListaChamados from '../components/ListaChamados';
import ChatBox from '../components/ChatBox';
import { assumirChamado, atualizarStatus, devolverChamadoParaFila, getChamadosAtivos, getChamadosFila, getChamadosHistorico, listarTecnicosDisponiveis, reabrirChamado, transferirChamado } from '../api/endpoints';
import { useAuth } from '../context/AuthContext';

const PainelTecnico = () => {
  const { user } = useAuth();
  const [chamadosFila, setChamadosFila] = useState([]);
  const [chamadosAtivos, setChamadosAtivos] = useState([]);
  const [chamadosHistorico, setChamadosHistorico] = useState([]);
  const [tecnicos, setTecnicos] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [aba, setAba] = useState('fila');
  const [tecnicoDestinoId, setTecnicoDestinoId] = useState('');

  const carregarDados = async () => {
    try {
      const resFila = await getChamadosFila();
      setChamadosFila(resFila.data);
      const resAtivos = await getChamadosAtivos();
      setChamadosAtivos(resAtivos.data);
      const resHist = await getChamadosHistorico();
      setChamadosHistorico(resHist.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    carregarDados();
    listarTecnicosDisponiveis()
      .then((res) => setTecnicos(res.data))
      .catch((err) => console.error(err));
    const interval = setInterval(carregarDados, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleResolver = async (id) => {
    if (window.confirm('Marcar como resolvido?')) {
      try {
        await atualizarStatus(id, 'Resolvido', user.nome_exibicao);
        setSelectedId(null);
        carregarDados();
      } catch (err) {
        alert('Erro ao resolver chamado');
      }
    }
  };

  const handleAssumir = async (id) => {
    try {
      await assumirChamado(id);
      setSelectedId(null);
      setAba('ativos');
      carregarDados();
    } catch (err) {
      alert(err.response?.data?.detail || 'Não foi possível assumir este chamado');
      carregarDados();
    }
  };

  const executarAcao = async (acao, mensagemErro, proximaAba = null) => {
    try {
      await acao();
      setSelectedId(null);
      setTecnicoDestinoId('');
      if (proximaAba) setAba(proximaAba);
      carregarDados();
    } catch (err) {
      alert(err.response?.data?.detail || mensagemErro);
    }
  };

  const handleTransferir = () => {
    if (!tecnicoDestinoId) {
      alert('Selecione o técnico de destino');
      return;
    }
    executarAcao(
      () => transferirChamado(selectedId, Number(tecnicoDestinoId)),
      'Não foi possível transferir o chamado',
    );
  };

  const chamadosExibicao = aba === 'fila'
    ? chamadosFila
    : aba === 'ativos'
      ? chamadosAtivos
      : chamadosHistorico;
  const chamadoSelecionadoEstaNaAba = chamadosExibicao.some((chamado) => chamado.id === selectedId);
  const chamadoSelecionado = chamadosExibicao.find((chamado) => chamado.id === selectedId);
  const podeGerenciarSelecionado = user.admin || chamadoSelecionado?.tecnico_responsavel_id === user.id;

  const trocarAba = (novaAba) => {
    setAba(novaAba);
    setSelectedId(null);
    setTecnicoDestinoId('');
  };

  return (
    <Layout>
      <h1 className="page-title">Atendimentos</h1>
      <p className="page-subtitle">Gerencie chamados de todas as filiais</p>

      <div className="tabs">
        <button className={aba === 'fila' ? 'active' : ''} onClick={() => trocarAba('fila')}>⏳ Fila de Espera</button>
        <button className={aba === 'ativos' ? 'active' : ''} onClick={() => trocarAba('ativos')}>⚡ Em Andamento</button>
        <button className={aba === 'historico' ? 'active' : ''} onClick={() => trocarAba('historico')}>🗄️ Finalizados</button>
      </div>

      <div className="chamados-container">
        <div className="lista">
          <ListaChamados
            chamados={chamadosExibicao}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </div>
        <div className="detalhe">
          {chamadoSelecionadoEstaNaAba && (
            <>
              {aba === 'fila' && (
                <button className="btn-assumir" onClick={() => handleAssumir(selectedId)}>
                  ▶ Assumir chamado
                </button>
              )}
              {aba === 'ativos' && podeGerenciarSelecionado && (
                <div className="ticket-actions">
                  <button className="btn-resolver" onClick={() => handleResolver(selectedId)}>
                    ✅ Marcar como Resolvido
                  </button>
                  <button
                    className="btn-return-queue"
                    onClick={() => executarAcao(
                      () => devolverChamadoParaFila(selectedId),
                      'Não foi possível devolver o chamado para a fila',
                      'fila',
                    )}
                  >
                    ↩ Devolver para fila
                  </button>
                  <div className="transfer-ticket">
                    <select value={tecnicoDestinoId} onChange={(e) => setTecnicoDestinoId(e.target.value)}>
                      <option value="">Transferir para...</option>
                      {tecnicos
                        .filter((tecnico) => tecnico.id !== chamadoSelecionado?.tecnico_responsavel_id)
                        .map((tecnico) => (
                          <option key={tecnico.id} value={tecnico.id}>{tecnico.nome_exibicao}</option>
                        ))}
                    </select>
                    <button className="btn-transfer" onClick={handleTransferir}>Transferir</button>
                  </div>
                </div>
              )}
              {aba === 'historico' && podeGerenciarSelecionado && (
                <button
                  className="btn-reopen"
                  onClick={() => executarAcao(
                    () => reabrirChamado(selectedId),
                    'Não foi possível reabrir o chamado',
                    'ativos',
                  )}
                >
                  ↻ Reabrir chamado
                </button>
              )}
              <ChatBox chamadoId={selectedId} readonly={aba !== 'ativos' || !podeGerenciarSelecionado} />
            </>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default PainelTecnico;
