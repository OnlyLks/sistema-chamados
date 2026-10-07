import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { loginTecnico } from '../api/endpoints';
import { useNavigate } from 'react-router-dom';
import logo from '../assets/logo.png';

const LoginTecnico = () => {
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await loginTecnico(usuario, senha);
      const userData = {
        tipo: 'tecnico',
        id: res.data.id,
        usuario: usuario,
        nome_exibicao: res.data.nome_exibicao,
        admin: res.data.admin,
      };
      login(res.data.access_token, userData);
      navigate('/tecnico');
    } catch (err) {
      alert('Usuário ou senha inválidos');
    }
  };

  return (
    <div className="login-page">
      <div className="login-wrapper">
        <div className="login-logo">
          <img className="login-brand-logo" src={logo} alt="Nome" />
          <h1>Nome T.I</h1>
          <p>Insira suas credenciais técnicas</p>
        </div>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Usuário"
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Senha"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            required
          />
          <button type="submit" className="btn-primary">Entrar no Sistema</button>
        </form>
        <p style={{textAlign:'center', marginTop:'1rem', fontSize:'0.8rem'}}>
          <a href="/" style={{color:'#94a3b8'}}>← Voltar para colaborador</a>
        </p>
      </div>
    </div>
  );
};

export default LoginTecnico;
