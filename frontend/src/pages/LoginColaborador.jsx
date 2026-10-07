import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { cadastrarColaborador, loginColaborador } from '../api/endpoints';
import { useNavigate } from 'react-router-dom';
import logo from '../assets/logo.png';

const LoginColaborador = () => {
  const [modoCadastro, setModoCadastro] = useState(false);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmacaoSenha, setConfirmacaoSenha] = useState('');
  const [unidade, setUnidade] = useState('Loja 1');
  const [setor, setSetor] = useState('');
  const [enviando, setEnviando] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const alternarModo = () => {
    setModoCadastro((atual) => !atual);
    setSenha('');
    setConfirmacaoSenha('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (modoCadastro && senha !== confirmacaoSenha) {
      alert('As senhas não coincidem');
      return;
    }

    setEnviando(true);
    try {
      if (modoCadastro) {
        await cadastrarColaborador({ nome, email, senha, unidade, setor });
        alert('Cadastro realizado. Agora entre com seu e-mail e senha.');
        setModoCadastro(false);
        setSenha('');
        setConfirmacaoSenha('');
        return;
      }

      const res = await loginColaborador(email, senha);
      login(res.data.access_token, {
        tipo: 'colaborador',
        id: res.data.id,
        nome: res.data.nome,
        email: res.data.email,
        nome_exibicao: res.data.nome,
      });
      navigate('/colaborador');
    } catch (err) {
      alert(err.response?.data?.detail || (modoCadastro ? 'Não foi possível concluir o cadastro' : 'E-mail ou senha inválidos'));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-wrapper">
        <div className="login-logo">
          <img className="login-brand-logo" src={logo} alt="Exemplo" />
          <h1>{modoCadastro ? 'Crie sua conta' : 'Portal do Colaborador'}</h1>
          <p>{modoCadastro ? 'Cadastre-se para acessar o sistema de chamados' : 'Entre para abrir ou acompanhar chamados'}</p>
        </div>

        <form onSubmit={handleSubmit}>
          {modoCadastro && (
            <input type="text" placeholder="Seu nome completo" value={nome} onChange={(e) => setNome(e.target.value)} minLength="3" required />
          )}
          <input type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
          <input type="password" placeholder="Senha" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete={modoCadastro ? 'new-password' : 'current-password'} minLength={modoCadastro ? '8' : undefined} required />
          {modoCadastro && (
            <>
              <select value={unidade} onChange={(e) => setUnidade(e.target.value)} required>
                <option>Loja 1</option><option>Loja 2</option><option>Loja 3</option><option>Loja 4</option><option>Loja 5</option><option>Loja 6</option><option>Escritório</option>
              </select>
              <select value={setor} onChange={(e) => setSetor(e.target.value)} required>
                <option value="">Selecione o setor</option><option>Gerência</option><option>Responsável Técnico</option><option>Supervisão de Loja</option><option>Supervisão de Caixa</option><option>Conferência</option><option>Transferência</option><option>Devolução</option><option>Perfumaria</option><option>Caixa</option><option>Balcão</option><option>Suplementos</option><option>Compras</option><option>Administrativo</option>
              </select>
              <input type="password" placeholder="Confirme sua senha" value={confirmacaoSenha} onChange={(e) => setConfirmacaoSenha(e.target.value)} autoComplete="new-password" minLength="8" required />
            </>
          )}
          <button type="submit" className="btn-primary" disabled={enviando}>
            {enviando ? 'Aguarde...' : modoCadastro ? 'Cadastrar' : 'Entrar no portal'}
          </button>
        </form>

        <button type="button" className="btn-login-secondary" onClick={alternarModo} disabled={enviando}>
          {modoCadastro ? 'Já tenho cadastro — entrar' : 'Ainda não tenho cadastro — criar conta'}
        </button>
        <p className="login-link"><a href="/login-tecnico">Acesso T.I</a></p>
      </div>
    </div>
  );
};

export default LoginColaborador;
