import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { listarTecnicos, criarTecnico, atualizarTecnico, deletarTecnico } from '../api/endpoints';

const AdminTecnicos = () => {
  const [tecnicos, setTecnicos] = useState([]);
  const [novoUsuario, setNovoUsuario] = useState('');
  const [novoNome, setNovoNome] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [editando, setEditando] = useState(null);
  const [editUsuario, setEditUsuario] = useState('');
  const [editNome, setEditNome] = useState('');
  const [editSenha, setEditSenha] = useState('');

  const carregar = async () => {
    try {
      const res = await listarTecnicos();
      setTecnicos(res.data);
    } catch (err) {
      alert('Erro ao carregar técnicos');
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  const handleCriar = async (e) => {
    e.preventDefault();
    if (!novoUsuario || !novoNome || !novaSenha) {
      alert('Preencha todos os campos');
      return;
    }
    try {
      await criarTecnico({ usuario: novoUsuario, nome_exibicao: novoNome, senha: novaSenha });
      setNovoUsuario('');
      setNovoNome('');
      setNovaSenha('');
      carregar();
    } catch (err) {
      alert('Erro ao criar técnico');
    }
  };

  const handleAtualizar = async (id) => {
    if (!editUsuario || !editNome) {
      alert('Preencha usuário e nome de exibição');
      return;
    }
    try {
      const data = {
        usuario: editUsuario,
        nome_exibicao: editNome,
      };
      if (editSenha) data.senha = editSenha;
      await atualizarTecnico(id, data);
      setEditando(null);
      carregar();
    } catch (err) {
      alert('Erro ao atualizar');
    }
  };

  const handleDeletar = async (id) => {
    if (window.confirm('Excluir definitivamente?')) {
      try {
        await deletarTecnico(id);
        carregar();
      } catch (err) {
        alert('Erro ao excluir');
      }
    }
  };

  return (
    <Layout>
      <h1 className="page-title">Controle de Agentes Técnicos</h1>
      <p className="page-subtitle">Cadastre, edite ou remova técnicos</p>

      <div className="section-card">
        <h3>➕ Cadastrar Novo Técnico</h3>
        <form className="user-form" onSubmit={handleCriar}>
           <input
            type="text"
            placeholder="Nome de Exibição"
            value={novoNome}
            onChange={(e) => setNovoNome(e.target.value)}
          />
          <input
            type="text"
            placeholder="Login"
            value={novoUsuario}
            onChange={(e) => setNovoUsuario(e.target.value)}
          />
          <input
            type="password"
            placeholder="Senha"
            value={novaSenha}
            onChange={(e) => setNovaSenha(e.target.value)}
          />
          <button type="submit" className="btn-primary">Cadastrar</button>
        </form>
      </div>

      <div className="section-card">
        <h3>✏️ Gerenciar Técnicos</h3>
        <ul className="lista-tecnicos">
          {tecnicos.map((tec) => (
            <li key={tec.id}>
              {editando === tec.id ? (
                <div className="technician-edit-form">
                  <input
                    type="text"
                    value={editUsuario}
                    onChange={(e) => setEditUsuario(e.target.value)}
                    placeholder="Usuário"
                  />
                  <input
                    type="text"
                    value={editNome}
                    onChange={(e) => setEditNome(e.target.value)}
                    placeholder="Nome"
                  />
                  <input
                    type="password"
                    value={editSenha}
                    onChange={(e) => setEditSenha(e.target.value)}
                    placeholder="Nova senha (opcional)"
                  />
                  <button className="btn-save" onClick={() => handleAtualizar(tec.id)}>Salvar</button>
                  <button className="btn-cancel" onClick={() => setEditando(null)}>Cancelar</button>
                </div>
              ) : (
                <>
                  <span className="technician-name">{tec.nome_exibicao} <small>({tec.usuario})</small></span>
                  <button className="btn-edit" onClick={() => {
                    setEditando(tec.id);
                    setEditUsuario(tec.usuario);
                    setEditNome(tec.nome_exibicao);
                    setEditSenha('');
                  }}>Editar</button>
                  <button className="btn-delete" onClick={() => handleDeletar(tec.id)}>Excluir</button>
                </>
              )}
            </li>
          ))}
        </ul>
      </div>
    </Layout>
  );
};

export default AdminTecnicos;
