from fastapi import APIRouter, HTTPException
from app.models import ColaboradorCadastro, ColaboradorLogin, TecnicoLogin
from app.auth import create_access_token, hash_password, verify_password
from app.database import get_db_connection
import mysql.connector

router = APIRouter(prefix="/auth", tags=["autenticação"])

@router.post("/login-colaborador")
def login_colaborador(data: ColaboradorLogin):
    email = data.email.strip().lower()
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute(
        "SELECT id, nome, email, unidade, setor, senha_hash FROM colaboradores WHERE email = %s",
        (email,),
    )
    colaborador = cursor.fetchone()
    cursor.close()
    conn.close()

    if not colaborador or not verify_password(data.senha, colaborador["senha_hash"]):
        raise HTTPException(status_code=401, detail="E-mail ou senha inválidos")

    token = create_access_token(
        data={"sub": "colaborador", "id": colaborador["id"], "nome": colaborador["nome"], "email": colaborador["email"], "unidade": colaborador["unidade"], "setor": colaborador["setor"]}
    )
    return {"access_token": token, "token_type": "bearer", "id": colaborador["id"], "nome": colaborador["nome"], "email": colaborador["email"], "unidade": colaborador["unidade"], "setor": colaborador["setor"]}

@router.post("/cadastro-colaborador", status_code=201)
def cadastrar_colaborador(data: ColaboradorCadastro):
    email = data.email.strip().lower()
    if "@" not in email or email.startswith("@") or email.endswith("@"):
        raise HTTPException(status_code=400, detail="Informe um e-mail válido")

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "INSERT INTO colaboradores (nome, email, unidade, setor, senha_hash) VALUES (%s, %s, %s, %s, %s)",
            (data.nome.strip(), email, data.unidade.strip(), data.setor.strip(), hash_password(data.senha)),
        )
        conn.commit()
        return {"mensagem": "Cadastro realizado com sucesso"}
    except mysql.connector.IntegrityError:
        raise HTTPException(status_code=400, detail="Este e-mail já está cadastrado")
    finally:
        cursor.close()
        conn.close()

@router.post("/login-tecnico")
def login_tecnico(data: TecnicoLogin):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    cursor.execute(
        "SELECT id, usuario, nome_exibicao, senha_hash FROM usuarios_ti WHERE usuario = %s",
        (data.usuario.strip(),)
    )
    user = cursor.fetchone()
    
    # Fecha a conexão com o banco antes de verificar ou dar erro
    cursor.close()
    conn.close()

    if not user:
        raise HTTPException(status_code=401, detail="Usuário ou senha inválidos")
    
    if not verify_password(data.senha, user["senha_hash"]):
        raise HTTPException(status_code=401, detail="Usuário ou senha inválidos")

    token = create_access_token(
        data={
            "sub": "tecnico",
            "id": user["id"],
            "usuario": user["usuario"],
            "nome_exibicao": user["nome_exibicao"],
            "admin": user["usuario"].lower() == "admin"
        }
    )
    return {
        "access_token": token,
        "token_type": "bearer",
        "id": user["id"],
        "usuario": user["usuario"],
        "nome_exibicao": user["nome_exibicao"],
        "admin": user["usuario"].lower() == "admin",
    }
