import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { getDashboardAuditoria } from '../api/endpoints';

const AuditoriaAdmin = () => {
  const [dados, setDados] = useState(null);
  const [filtros, setFiltros] = useState({ data_inicio: '', data_fim: '', unidade: '', setor: '', tecnico_id: '' });

  const carregar = async () => {
    try {
      const filtrosAtivos = Object.fromEntries(Object.entries(filtros).filter(([, valor]) => valor !== ''));
      const res = await getDashboardAuditoria(filtrosAtivos);
      setDados(res.data);
    } catch (err) {
      alert(err.response?.data?.detail || 'Erro ao carregar auditoria');
    }
  };

  useEffect(() => { carregar(); }, []);
  const atualizarFiltro = (campo, valor) => setFiltros((atual) => ({ ...atual, [campo]: valor }));

  return (
    <Layout>
      <h1 className="page-title">Auditoria e indicadores</h1>
      <p className="page-subtitle">Acompanhe origem, distribuição e resolução dos chamados.</p>

      <div className="section-card dashboard-filters">
        <div><label>De</label><input type="date" value={filtros.data_inicio} onChange={(e) => atualizarFiltro('data_inicio', e.target.value)} /></div>
        <div><label>Até</label><input type="date" value={filtros.data_fim} onChange={(e) => atualizarFiltro('data_fim', e.target.value)} /></div>
        <div><label>Unidade</label><select value={filtros.unidade} onChange={(e) => atualizarFiltro('unidade', e.target.value)}><option value="">Todas</option>{dados?.filtros.unidades.map((item) => <option key={item}>{item}</option>)}</select></div>
        <div><label>Setor</label><select value={filtros.setor} onChange={(e) => atualizarFiltro('setor', e.target.value)}><option value="">Todos</option>{dados?.filtros.setores.map((item) => <option key={item}>{item}</option>)}</select></div>
        <div><label>Técnico</label><select value={filtros.tecnico_id} onChange={(e) => atualizarFiltro('tecnico_id', e.target.value)}><option value="">Todos</option>{dados?.filtros.tecnicos.map((item) => <option key={item.id} value={item.id}>{item.nome_exibicao}</option>)}</select></div>
        <button className="btn-filter" onClick={carregar}>Aplicar filtros</button>
      </div>

      {dados && <>
        <div className="dashboard-cards">
          <div><span>Total</span><strong>{dados.resumo.total || 0}</strong></div>
          <div><span>Na fila</span><strong>{dados.resumo.fila || 0}</strong></div>
          <div><span>Em atendimento</span><strong>{dados.resumo.em_atendimento || 0}</strong></div>
          <div><span>Resolvidos</span><strong>{dados.resumo.resolvidos || 0}</strong></div>
        </div>
        <div className="dashboard-grid">
          <div className="section-card"><h3>Resolvidos por técnico</h3><table><thead><tr><th>Técnico</th><th>Resolvidos</th></tr></thead><tbody>{dados.por_tecnico.map((item) => <tr key={item.tecnico}><td>{item.tecnico}</td><td>{item.resolvidos}</td></tr>)}</tbody></table></div>
          <div className="section-card"><h3>Origem dos chamados</h3><table><thead><tr><th>Unidade</th><th>Setor</th><th>Qtd.</th></tr></thead><tbody>{dados.por_origem.map((item) => <tr key={`${item.unidade}-${item.setor}`}><td>{item.unidade}</td><td>{item.setor}</td><td>{item.quantidade}</td></tr>)}</tbody></table></div>
        </div>
        <div className="section-card audit-events-card">
          <h3>Últimos eventos auditados</h3>
          <div className="audit-events-scroll" role="region" aria-label="Lista de últimos eventos auditados" tabIndex="0">
            <table>
              <thead><tr><th>Data</th><th>Chamado</th><th>Ação</th><th>Responsável</th><th>Detalhes</th></tr></thead>
              <tbody>{dados.eventos.map((item, index) => <tr key={`${item.chamado_id}-${item.criado_em}-${index}`}><td>{new Date(item.criado_em).toLocaleString('pt-BR')}</td><td>#{item.chamado_id}</td><td>{item.acao.replace('_', ' ')}</td><td>{item.autor_nome}</td><td>{item.detalhes || '—'}</td></tr>)}</tbody>
            </table>
          </div>
        </div>
      </>}
    </Layout>
  );
};

export default AuditoriaAdmin;
