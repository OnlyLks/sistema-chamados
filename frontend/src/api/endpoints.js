import api from './client';

// Auth
export const loginColaborador = (email, senha) =>
  api.post('/auth/login-colaborador', { email, senha });

export const cadastrarColaborador = (data) =>
  api.post('/auth/cadastro-colaborador', data);

export const loginTecnico = (usuario, senha) =>
  api.post('/auth/login-tecnico', { usuario, senha });

// Chamados - colaborador
export const getChamadosColaborador = () =>
  api.get('/chamados/colaborador');

export const criarChamado = (data) =>
  api.post('/chamados/', data);

// Chamados - técnico
export const getChamadosAtivos = () =>
  api.get('/chamados/ativos');

export const getChamadosFila = () =>
  api.get('/chamados/fila');

export const getChamadosHistorico = () =>
  api.get('/chamados/historico');

export const getChamadoDetalhe = (id) =>
  api.get(`/chamados/${id}`);

export const listarMensagens = (id) =>
  api.get(`/chamados/${id}/mensagens`);

export const atualizarStatus = (id, status, tecnico_responsavel = null) =>
  api.put(`/chamados/${id}/status`, { status, tecnico_responsavel });

export const assumirChamado = (id) =>
  api.put(`/chamados/${id}/assumir`);

export const devolverChamadoParaFila = (id) =>
  api.put(`/chamados/${id}/devolver-fila`);

export const transferirChamado = (id, tecnicoId) =>
  api.put(`/chamados/${id}/transferir`, { tecnico_id: tecnicoId });

export const reabrirChamado = (id) =>
  api.put(`/chamados/${id}/reabrir`);

export const enviarMensagem = (id, mensagem) =>
  api.post(`/chamados/${id}/chat`, { mensagem });

export const enviarAnexo = (id, arquivo, mensagem = '') => {
  const dados = new FormData();
  dados.append('arquivo', arquivo);
  if (mensagem.trim()) dados.append('mensagem_texto', mensagem.trim());
  return api.post(`/chamados/${id}/chat/anexo`, dados);
};

export const baixarAnexo = (id, mensagemId) =>
  api.get(`/chamados/${id}/mensagens/${mensagemId}/anexo`, { responseType: 'blob' });

// Técnicos (admin)
export const listarTecnicos = () =>
  api.get('/tecnicos/');

export const listarTecnicosDisponiveis = () =>
  api.get('/tecnicos/disponiveis');

export const getDashboardAuditoria = (filtros) =>
  api.get('/tecnicos/auditoria/dashboard', { params: filtros });

export const criarTecnico = (data) =>
  api.post('/tecnicos/', data);

export const atualizarTecnico = (id, data) =>
  api.put(`/tecnicos/${id}`, data);

export const deletarTecnico = (id) =>
  api.delete(`/tecnicos/${id}`);
