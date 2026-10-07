import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import ListaChamados from '../components/ListaChamados';
import ChatBox from '../components/ChatBox';
import { getChamadosColaborador, criarChamado } from '../api/endpoints';
import { useAuth } from '../context/AuthContext';

const PainelColaborador = () => {
  const { user, logout } = useAuth();
  const [chamados, setChamados] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [descricao, setDescricao] = useState('');
  const [prioridade, setPrioridade] = useState('Baixa');
  const [aba, setAba] = useState('novo');

  const carregarChamados = async () => {
    try {
      const res = await getChamadosColaborador();
      const data = res.data;
      setChamados(data);
      // O polling roda a cada 5s; preserve o chamado escolhido enquanto ele existir.
      setSelectedId((atual) => {
        if (atual && data.some((chamado) => chamado.id === atual)) return atual;
        return data[0]?.id ?? null;
      });
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    carregarChamados();
    const interval = setInterval(carregarChamados, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleNovoChamado = async (e) => {
    e.preventDefault();
    if (!descricao.trim()) return alert('Descreva o problema');
    try {
      await criarChamado({
        prioridade,
        descricao,
      });
      setDescricao('');
      carregarChamados();
      setAba('ativos');
    } catch (err) {
      const status = err.response?.status;
      const detalhe = err.response?.data?.detail;

      if (status === 401) {
        logout();
        alert('Sua sessão expirou. Entre novamente para abrir o chamado.');
        return;
      }

      alert(detalhe || 'Não foi possível criar o chamado. Tente novamente.');
    }
  };

  const chamadosAtivos = chamados.filter(c => c.status !== 'Resolvido');
  const chamadosHistorico = chamados.filter(c => c.status === 'Resolvido');
  const chamadosExibicao = aba === 'ativos' ? chamadosAtivos : chamadosHistorico;
  const chamadoSelecionadoEstaNaAba = chamadosExibicao.some((chamado) => chamado.id === selectedId);

  return (
    <Layout>
      <h1 className="page-title">Central de Atendimento</h1>
      <p className="page-subtitle">Abertura de chamados e acompanhamento</p>

      <div className="tabs">
        <button className={aba === 'novo' ? 'active' : ''} onClick={() => setAba('novo')}>＋ Novo Chamado</button>
        <button className={aba === 'ativos' ? 'active' : ''} onClick={() => setAba('ativos')}>💬 Conversas Ativas</button>
        <button className={aba === 'historico' ? 'active' : ''} onClick={() => setAba('historico')}>🗄️ Histórico</button>
      </div>

      {aba === 'novo' && (
        <div className="section-card">
          <form className="new-ticket-form" onSubmit={handleNovoChamado}>
            <fieldset className="priority-selector">
              <legend>Prioridade</legend>
              <div className="priority-options">
                {['Baixa', 'Média', 'Alta'].map((opcao) => (
                  <button
                    key={opcao}
                    type="button"
                    className={`priority-option priority-${opcao.toLowerCase()}${prioridade === opcao ? ' selected' : ''}`}
                    onClick={() => setPrioridade(opcao)}
                    aria-pressed={prioridade === opcao}
                  >
                    {opcao === 'Baixa' ? '● Baixa' : opcao === 'Média' ? '● Média' : '● Alta'}
                  </button>
                ))}
              </div>
            </fieldset>
            <label htmlFor="descricao-chamado">Descrição</label>
            <textarea
              id="descricao-chamado"
              className="ticket-description"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Descreva detalhadamente o ocorrido..."
              rows="4"
              style={{width:'100%', padding:'0.5rem', borderRadius:'8px', border:'1px solid #475569', background:'#0f172a', color:'#f1f5f9'}}
            />
            <button type="submit" className="btn-primary">Enviar para a T.I</button>
          </form>
        </div>
      )}

      {aba === 'ativos' && (
        <div className="chamados-container">
          <div className="lista">
            <ListaChamados
              chamados={chamadosAtivos}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          </div>
          <div className="detalhe">
            {chamadoSelecionadoEstaNaAba && <ChatBox chamadoId={selectedId} />}
          </div>
        </div>
      )}

      {aba === 'historico' && (
        <div className="chamados-container">
          <div className="lista">
            <ListaChamados
              chamados={chamadosHistorico}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          </div>
          <div className="detalhe">
            {chamadoSelecionadoEstaNaAba && <ChatBox chamadoId={selectedId} readonly />}
          </div>
        </div>
      )}
    </Layout>
  );
};

export default PainelColaborador;
