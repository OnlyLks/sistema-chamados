from fastapi import APIRouter, HTTPException, Depends, Header, Query
from app.models import TecnicoCreate, TecnicoUpdate
from app.auth import extract_access_token, hash_password, verify_token
from app.database import get_db_connection
import mysql.connector

router = APIRouter(prefix="/tecnicos", tags=["tecnicos"])

def get_admin_user(authorization: str | None = Header(None), token: str | None = Header(None)):
    user = verify_token(extract_access_token(authorization, token))
    if not user or user.get("sub") != "tecnico" or not user.get("admin"):
        raise HTTPException(status_code=403, detail="Acesso restrito a administradores")
    return user

def get_tecnico_user(authorization: str | None = Header(None), token: str | None = Header(None)):
    user = verify_token(extract_access_token(authorization, token))
    if not user or user.get("sub") != "tecnico":
        raise HTTPException(status_code=403, detail="Acesso apenas para técnicos")
    return user

@router.get("/disponiveis")
def listar_tecnicos_disponiveis(user=Depends(get_tecnico_user)):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT id, usuario, nome_exibicao FROM usuarios_ti ORDER BY nome_exibicao")
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    return rows

@router.get("/auditoria/dashboard")
def dashboard_auditoria(
    data_inicio: str | None = Query(None),
    data_fim: str | None = Query(None),
    unidade: str | None = Query(None),
    setor: str | None = Query(None),
    tecnico_id: int | None = Query(None),
    user=Depends(get_admin_user),
):
    filtros = []
    params = []
    if data_inicio:
        filtros.append("DATE(c.data_criacao) >= %s")
        params.append(data_inicio)
    if data_fim:
        filtros.append("DATE(c.data_criacao) <= %s")
        params.append(data_fim)
    if unidade:
        filtros.append("c.unidade = %s")
        params.append(unidade)
    if setor:
        filtros.append("c.setor = %s")
        params.append(setor)
    if tecnico_id:
        filtros.append("c.tecnico_responsavel_id = %s")
        params.append(tecnico_id)
    where = f"WHERE {' AND '.join(filtros)}" if filtros else ""

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute(
        f"""SELECT COUNT(*) AS total,
                   SUM(c.status = 'Aberto') AS fila,
                   SUM(c.status = 'Em Atendimento') AS em_atendimento,
                   SUM(c.status = 'Resolvido') AS resolvidos
            FROM chamados c {where}""",
        params,
    )
    resumo = cursor.fetchone()
    cursor.execute(
        f"""SELECT COALESCE(c.tecnico_responsavel, 'Sem responsável') AS tecnico,
                   COUNT(*) AS resolvidos
            FROM chamados c {where}{' AND' if where else ' WHERE'} c.status = 'Resolvido'
            GROUP BY c.tecnico_responsavel
            ORDER BY resolvidos DESC, tecnico""",
        params,
    )
    por_tecnico = cursor.fetchall()
    cursor.execute(
        f"""SELECT COALESCE(c.unidade, 'Não informado') AS unidade,
                   COALESCE(c.setor, 'Não informado') AS setor,
                   COUNT(*) AS quantidade
            FROM chamados c {where}
            GROUP BY c.unidade, c.setor
            ORDER BY quantidade DESC, unidade, setor""",
        params,
    )
    por_origem = cursor.fetchall()
    cursor.execute("SELECT DISTINCT unidade FROM chamados WHERE unidade IS NOT NULL ORDER BY unidade")
    unidades = [item["unidade"] for item in cursor.fetchall()]
    cursor.execute("SELECT DISTINCT setor FROM chamados WHERE setor IS NOT NULL ORDER BY setor")
    setores = [item["setor"] for item in cursor.fetchall()]
    cursor.execute("SELECT id, nome_exibicao FROM usuarios_ti ORDER BY nome_exibicao")
    tecnicos = cursor.fetchall()
    cursor.execute(
        """SELECT a.criado_em, a.acao, a.autor_nome, a.detalhes, a.chamado_id
           FROM auditoria_chamados a
           ORDER BY a.criado_em DESC, a.id DESC LIMIT 30"""
    )
    eventos = cursor.fetchall()
    cursor.close()
    conn.close()
    return {"resumo": resumo, "por_tecnico": por_tecnico, "por_origem": por_origem, "filtros": {"unidades": unidades, "setores": setores, "tecnicos": tecnicos}, "eventos": eventos}

@router.get("/")
def listar_tecnicos(user=Depends(get_admin_user)):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT id, usuario, nome_exibicao FROM usuarios_ti WHERE usuario != 'admin' ORDER BY nome_exibicao")
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    return rows

@router.post("/")
def criar_tecnico(tecnico: TecnicoCreate, user=Depends(get_admin_user)):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "INSERT INTO usuarios_ti (usuario, nome_exibicao, senha_hash) VALUES (%s, %s, %s)",
            (tecnico.usuario.strip().lower(), tecnico.nome_exibicao.strip(), hash_password(tecnico.senha))
        )
        conn.commit()
        cursor.close()
        conn.close()
        return {"mensagem": "Técnico criado com sucesso"}
    except mysql.connector.IntegrityError:
        cursor.close()
        conn.close()
        raise HTTPException(status_code=400, detail="Usuário já existe")

@router.put("/{id}")
def atualizar_tecnico(id: int, update: TecnicoUpdate, user=Depends(get_admin_user)):
    conn = get_db_connection()
    cursor = conn.cursor()
    set_clause = []
    params = []
    if update.usuario:
        set_clause.append("usuario = %s")
        params.append(update.usuario.strip().lower())
    if update.nome_exibicao:
        set_clause.append("nome_exibicao = %s")
        params.append(update.nome_exibicao.strip())
    if update.senha:
        set_clause.append("senha_hash = %s")
        params.append(hash_password(update.senha))
    if not set_clause:
        cursor.close()
        conn.close()
        raise HTTPException(status_code=400, detail="Nenhum campo para atualizar")
    params.append(id)
    query = f"UPDATE usuarios_ti SET {', '.join(set_clause)} WHERE id = %s AND usuario != 'admin'"
    try:
        cursor.execute(query, params)
        conn.commit()
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Técnico não encontrado ou é admin")
        cursor.close()
        conn.close()
        return {"mensagem": "Técnico atualizado com sucesso"}
    except mysql.connector.IntegrityError:
        cursor.close()
        conn.close()
        raise HTTPException(status_code=400, detail="Usuário já existe")

@router.delete("/{id}")
def deletar_tecnico(id: int, user=Depends(get_admin_user)):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM usuarios_ti WHERE id = %s AND usuario != 'admin'", (id,))
    conn.commit()
    if cursor.rowcount == 0:
        cursor.close()
        conn.close()
        raise HTTPException(status_code=404, detail="Técnico não encontrado ou é admin")
    cursor.close()
    conn.close()
    return {"mensagem": "Técnico excluído"}
