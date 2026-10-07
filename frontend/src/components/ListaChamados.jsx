import React from 'react';

const ListaChamados = ({ chamados, onSelect, selectedId }) => {
  const getBadgeClass = (status) => {
    if (status === 'Aberto') return 'badge-aberto';
    if (status === 'Em Atendimento') return 'badge-atendimento';
    return 'badge-resolvido';
  };

  return (
    <div className="lista-chamados">
      {chamados.map((ch) => (
        <button
          key={ch.id}
          className={`item-chamado ${selectedId === ch.id ? 'ativo' : ''}`}
          onClick={() => onSelect(ch.id)}
        >
          <span className={`badge-status ${getBadgeClass(ch.status)}`}>{ch.status}</span>
          <span className="resumo">#{ch.id} - {ch.descricao.slice(0, 30)}...</span>
        </button>
      ))}
    </div>
  );
};

export default ListaChamados;