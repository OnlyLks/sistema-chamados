from fastapi import APIRouter, HTTPException, Depends, Header, Query, WebSocket, WebSocketDisconnect, File, Form, UploadFile
from fastapi.responses import FileResponse
from app.models import ChamadoCreate, ChamadoStatusUpdate, ChamadoTransferencia, ChatMessage, ChamadoResponse, MensagemResponse
from app.database import get_db_connection
from app.auth import extract_access_token, verify_token
from datetime import datetime
from typing import List
from pathlib import Path
from uuid import uuid4
import anyio
import mysql.connector

router = APIRouter(prefix="/chamados", tags=["chamados"])

MAX_ANEXO_BYTES = 10 * 1024 * 1024
ANEXOS_DIR = Path(__file__).resolve().parents[2] / "uploads" / "chat"
TIPOS_ANEXO = {
    ".png": ("image/png", b"\x89PNG\r\n\x1a\n"),
    ".jpg": ("image/jpeg", b"\xff\xd8\xff"),
    ".jpeg": ("image/jpeg", b"\xff\xd8\xff"),
    ".webp": ("image/webp", b"RIFF"),
}

class ChatConnectionManager:
    def __init__(self):
        self.active_connections: dict[int, list[WebSocket]] = {}

    async def connect(self, chamado_id: int, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.setdefault(chamado_id, []).append(websocket)

    def disconnect(self, chamado_id: int, websocket: WebSocket):
        connections = self.active_connections.get(chamado_id, [])
        if websocket in connections:
            connections.remove(websocket)
        if not connections:
            self.active_connections.pop(chamado_id, None)

    async def broadcast(self, chamado_id: int, mensagem: dict):
        disconnected = []
        for websocket in self.active_connections.get(chamado_id, []):
            try:
                await websocket.send_json({"tipo": "mensagem", "mensagem": mensagem})
            except RuntimeError:
                disconnected.append(websocket)
        for websocket in disconnected:
            self.disconnect(chamado_id, websocket)

chat_manager = ChatConnectionManager()

def get_current_user(authorization: str | None = Header(None), token: str | None = Header(None)):
    payload = verify_token(extract_access_token(authorization, token))
    if not payload:
        raise HTTPException(status_code=401, detail="Token inválido")
    return payload

def pode_acessar_chamado(chamado_id: int, user: dict) -> bool:
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT usuario_nome, colaborador_id FROM chamados WHERE id = %s", (chamado_id,))
    chamado = cursor.fetchone()
    cursor.close()
    conn.close()
    if not chamado:
        return False
    if user.get("sub") == "tecnico":
        return True
    if chamado["colaborador_id"] is not None:
        return chamado["colaborador_id"] == user.get("id")
    return chamado["usuario_nome"] == user.get("nome")

def criar_mensagem(
    cursor,
    chamado_id: int,
    autor_tipo: str,
    autor_nome: str | None,
    conteudo: str,
    tipo_conteudo: str = "texto",
    anexo_nome: str | None = None,
    anexo_mime: str | None = None,
    anexo_tamanho: int | None = None,
    anexo_arquivo: str | None = None,
) -> dict:
    criado_em = datetime.now()
    cursor.execute(
        """INSERT INTO mensagens
           (chamado_id, autor_tipo, autor_nome, conteudo, criado_em,
            tipo_conteudo, anexo_nome, anexo_mime, anexo_tamanho, anexo_arquivo)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
        (chamado_id, autor_tipo, autor_nome, conteudo, criado_em,
         tipo_conteudo, anexo_nome, anexo_mime, anexo_tamanho, anexo_arquivo),
    )
    return {
        "id": cursor.lastrowid,
        "chamado_id": chamado_id,
        "autor_tipo": autor_tipo,
        "autor_nome": autor_nome,
        "conteudo": conteudo,
        "criado_em": criado_em.isoformat(),
        "tipo_conteudo": tipo_conteudo,
        "anexo_nome": anexo_nome,
        "anexo_mime": anexo_mime,
        "anexo_tamanho": anexo_tamanho,
    }

def registrar_auditoria(cursor, chamado_id: int, acao: str, user: dict, detalhes: str | None = None):
    cursor.execute(
        """INSERT INTO auditoria_chamados (chamado_id, acao, autor_tipo, autor_id, autor_nome, detalhes)
           VALUES (%s, %s, %s, %s, %s, %s)""",
        (chamado_id, acao, user.get("sub"), user.get("id"), user.get("nome_exibicao") or user.get("nome") or user.get("usuario"), detalhes),
    )

def tecnico_pode_gerenciar(chamado: dict, user: dict) -> bool:
    """Somente o responsável pelo chamado ou um administrador pode atuar nele."""
    return (
        user.get("sub") == "tecnico"
        and (user.get("admin") is True or chamado.get("tecnico_responsavel_id") == user.get("id"))
    )

def obter_tecnico(cursor, tecnico_id: int) -> dict:
    cursor.execute("SELECT id, nome_exibicao FROM usuarios_ti WHERE id = %s", (tecnico_id,))
    tecnico = cursor.fetchone()
    if not tecnico:
        raise HTTPException(status_code=404, detail="Técnico de destino não encontrado")
    return tecnico

@router.post("/", response_model=dict)
def criar_chamado(chamado: ChamadoCreate, user=Depends(get_current_user)):
    if user.get("sub") != "colaborador" or not user.get("id"):
        raise HTTPException(status_code=403, detail="Apenas colaboradores podem abrir chamados")

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        """INSERT INTO chamados (usuario_nome, colaborador_id, unidade, setor, prioridade, descricao, status)
           VALUES (%s, %s, %s, %s, %s, %s, 'Aberto')""",
        (user["nome"], user["id"], user.get("unidade", "Não informado"), user.get("setor", "Não informado"), chamado.prioridade, chamado.descricao)
    )
    conn.commit()
    new_id = cursor.lastrowid
    registrar_auditoria(cursor, new_id, "criado", user, "Chamado aberto pelo colaborador")
    cursor.close()
    conn.close()
    return {"id": new_id, "mensagem": "Chamado criado com sucesso"}

@router.get("/colaborador", response_model=List[ChamadoResponse])
def listar_chamados_colaborador(user=Depends(get_current_user)):
    if user.get("sub") != "colaborador":
        raise HTTPException(status_code=403, detail="Acesso apenas para colaboradores")
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    if user.get("id"):
        cursor.execute("SELECT * FROM chamados WHERE colaborador_id = %s ORDER BY id DESC", (user["id"],))
    else:
        cursor.execute("SELECT * FROM chamados WHERE usuario_nome = %s ORDER BY id DESC", (user.get("nome"),))
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    return rows

@router.get("/ativos", response_model=List[ChamadoResponse])
def listar_ativos_tecnicos(user=Depends(get_current_user)):
    if user.get("sub") != "tecnico":
        raise HTTPException(status_code=403, detail="Acesso apenas para técnicos")
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute(
        "SELECT * FROM chamados WHERE status = 'Em Atendimento' ORDER BY id DESC"
    )
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    return rows

@router.get("/fila", response_model=List[ChamadoResponse])
def listar_fila_tecnicos(user=Depends(get_current_user)):
    if user.get("sub") != "tecnico":
        raise HTTPException(status_code=403, detail="Acesso apenas para técnicos")
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM chamados WHERE status = 'Aberto' ORDER BY id ASC")
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    return rows

@router.get("/historico", response_model=List[ChamadoResponse])
def listar_historico_tecnicos(user=Depends(get_current_user)):
    if user.get("sub") != "tecnico":
        raise HTTPException(status_code=403, detail="Acesso apenas para técnicos")
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute(
        "SELECT * FROM chamados WHERE status = 'Resolvido' ORDER BY id DESC"
    )
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    return rows

@router.get("/{id}/mensagens", response_model=List[MensagemResponse])
def listar_mensagens(id: int, user=Depends(get_current_user)):
    if not pode_acessar_chamado(id, user):
        raise HTTPException(status_code=403, detail="Não autorizado")
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute(
        """SELECT id, chamado_id, autor_tipo, autor_nome, conteudo, criado_em,
                  tipo_conteudo, anexo_nome, anexo_mime, anexo_tamanho
           FROM mensagens WHERE chamado_id = %s ORDER BY criado_em ASC, id ASC""",
        (id,),
    )
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    return rows


def validar_permissao_mensagem(id: int, user: dict, row: dict):
    if user.get("sub") == "colaborador" and not pode_acessar_chamado(id, user):
        raise HTTPException(status_code=403, detail="Não autorizado")
    if row["status"] == "Resolvido":
        raise HTTPException(status_code=409, detail="Não é possível enviar mensagens para um chamado finalizado")
    if user.get("sub") == "tecnico":
        if row["status"] != "Em Atendimento":
            raise HTTPException(status_code=409, detail="Assuma o chamado antes de enviar mensagens")
        if not tecnico_pode_gerenciar(row, user):
            raise HTTPException(status_code=403, detail="Somente o técnico responsável pode responder este chamado")


def dados_autor(user: dict):
    if user.get("sub") == "colaborador":
        return "colaborador", user.get("nome")
    return "tecnico", user.get("nome_exibicao") or user.get("usuario")

@router.websocket("/{id}/ws")
async def websocket_chat(websocket: WebSocket, id: int, token: str = Query(...)):
    user = verify_token(token)
    if not user or not pode_acessar_chamado(id, user):
        await websocket.close(code=1008)
        return

    await chat_manager.connect(id, websocket)
    try:
        while True:
            # Mantém a conexão aberta; envio de mensagens continua passando pela API autenticada.
            await websocket.receive_text()
    except WebSocketDisconnect:
        chat_manager.disconnect(id, websocket)

@router.get("/{id}", response_model=ChamadoResponse)
def obter_chamado(id: int, user=Depends(get_current_user)):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM chamados WHERE id = %s", (id,))
    row = cursor.fetchone()
    cursor.close()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Chamado não encontrado")
    if user.get("sub") == "colaborador" and not pode_acessar_chamado(id, user):
        raise HTTPException(status_code=403, detail="Não autorizado")
    return row

@router.put("/{id}/assumir")
def assumir_chamado(id: int, user=Depends(get_current_user)):
    if user.get("sub") != "tecnico":
        raise HTTPException(status_code=403, detail="Apenas técnicos podem assumir chamados")

    tecnico = user.get("nome_exibicao") or user.get("usuario")
    tecnico_id = user.get("id")
    if not tecnico_id:
        raise HTTPException(status_code=401, detail="Token técnico inválido")
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT id FROM chamados WHERE id = %s AND status = 'Aberto'", (id,))
    chamado = cursor.fetchone()
    if not chamado:
        cursor.close()
        conn.close()
        raise HTTPException(status_code=409, detail="Este chamado já foi assumido ou finalizado")

    cursor.execute(
        """UPDATE chamados
           SET status = 'Em Atendimento', tecnico_responsavel = %s, tecnico_responsavel_id = %s
           WHERE id = %s AND status = 'Aberto'""",
        (tecnico, tecnico_id, id),
    )
    if cursor.rowcount == 0:
        conn.rollback()
        cursor.close()
        conn.close()
        raise HTTPException(status_code=409, detail="Este chamado acabou de ser assumido por outro técnico")
    mensagem = criar_mensagem(cursor, id, "sistema", "Sistema", f"{tecnico} assumiu seu chamado.")
    registrar_auditoria(cursor, id, "assumido", user, f"Responsável: {tecnico}")
    conn.commit()
    cursor.close()
    conn.close()
    anyio.from_thread.run(chat_manager.broadcast, id, mensagem)
    return {"mensagem": "Chamado assumido com sucesso"}

@router.put("/{id}/status")
def atualizar_status(id: int, update: ChamadoStatusUpdate, user=Depends(get_current_user)):
    if user.get("sub") != "tecnico":
        raise HTTPException(status_code=403, detail="Apenas técnicos podem alterar status")
    if update.status != "Resolvido":
        raise HTTPException(status_code=400, detail="Use o fluxo de assumir chamado para iniciar um atendimento")

    tecnico = user.get("nome_exibicao") or user.get("usuario")
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute(
        """SELECT id, tecnico_responsavel_id FROM chamados
           WHERE id = %s AND status = 'Em Atendimento'""",
        (id,),
    )
    chamado = cursor.fetchone()
    if not chamado:
        cursor.close()
        conn.close()
        raise HTTPException(status_code=409, detail="O chamado não está em atendimento")
    if not tecnico_pode_gerenciar(chamado, user):
        cursor.close()
        conn.close()
        raise HTTPException(status_code=403, detail="Somente o técnico responsável pode finalizar este chamado")

    cursor.execute("UPDATE chamados SET status = 'Resolvido' WHERE id = %s AND status = 'Em Atendimento'", (id,))
    mensagem = criar_mensagem(cursor, id, "sistema", "Sistema", f"Seu chamado foi finalizado por {tecnico}.")
    registrar_auditoria(cursor, id, "finalizado", user)
    conn.commit()
    cursor.close()
    conn.close()
    anyio.from_thread.run(chat_manager.broadcast, id, mensagem)
    return {"mensagem": f"Status atualizado para {update.status}"}

@router.put("/{id}/devolver-fila")
def devolver_para_fila(id: int, user=Depends(get_current_user)):
    if user.get("sub") != "tecnico":
        raise HTTPException(status_code=403, detail="Apenas técnicos podem devolver chamados à fila")

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute(
        """SELECT id, tecnico_responsavel_id FROM chamados
           WHERE id = %s AND status = 'Em Atendimento'""",
        (id,),
    )
    chamado = cursor.fetchone()
    if not chamado:
        cursor.close()
        conn.close()
        raise HTTPException(status_code=409, detail="O chamado não está em atendimento")
    if not tecnico_pode_gerenciar(chamado, user):
        cursor.close()
        conn.close()
        raise HTTPException(status_code=403, detail="Somente o responsável pode devolver este chamado à fila")

    tecnico = user.get("nome_exibicao") or user.get("usuario")
    cursor.execute(
        """UPDATE chamados
           SET status = 'Aberto', tecnico_responsavel = NULL, tecnico_responsavel_id = NULL
           WHERE id = %s""",
        (id,),
    )
    mensagem = criar_mensagem(cursor, id, "sistema", "Sistema", f"{tecnico} devolveu seu chamado para a fila de espera.")
    registrar_auditoria(cursor, id, "devolvido_fila", user)
    conn.commit()
    cursor.close()
    conn.close()
    anyio.from_thread.run(chat_manager.broadcast, id, mensagem)
    return {"mensagem": "Chamado devolvido para a fila"}

@router.put("/{id}/transferir")
def transferir_chamado(id: int, transferencia: ChamadoTransferencia, user=Depends(get_current_user)):
    if user.get("sub") != "tecnico":
        raise HTTPException(status_code=403, detail="Apenas técnicos podem transferir chamados")

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute(
        """SELECT id, tecnico_responsavel_id FROM chamados
           WHERE id = %s AND status = 'Em Atendimento'""",
        (id,),
    )
    chamado = cursor.fetchone()
    if not chamado:
        cursor.close()
        conn.close()
        raise HTTPException(status_code=409, detail="O chamado não está em atendimento")
    if not tecnico_pode_gerenciar(chamado, user):
        cursor.close()
        conn.close()
        raise HTTPException(status_code=403, detail="Somente o responsável pode transferir este chamado")
    if transferencia.tecnico_id == chamado["tecnico_responsavel_id"]:
        cursor.close()
        conn.close()
        raise HTTPException(status_code=400, detail="Este técnico já é o responsável pelo chamado")

    destino = obter_tecnico(cursor, transferencia.tecnico_id)
    origem = user.get("nome_exibicao") or user.get("usuario")
    cursor.execute(
        """UPDATE chamados SET tecnico_responsavel = %s, tecnico_responsavel_id = %s
           WHERE id = %s AND status = 'Em Atendimento'""",
        (destino["nome_exibicao"], destino["id"], id),
    )
    mensagem = criar_mensagem(
        cursor, id, "sistema", "Sistema",
        f"{origem} transferiu seu chamado para {destino['nome_exibicao']}.",
    )
    registrar_auditoria(cursor, id, "transferido", user, f"Destino: {destino['nome_exibicao']}")
    conn.commit()
    cursor.close()
    conn.close()
    anyio.from_thread.run(chat_manager.broadcast, id, mensagem)
    return {"mensagem": "Chamado transferido com sucesso"}

@router.put("/{id}/reabrir")
def reabrir_chamado(id: int, user=Depends(get_current_user)):
    if user.get("sub") != "tecnico":
        raise HTTPException(status_code=403, detail="Apenas técnicos podem reabrir chamados")

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute(
        """SELECT id, tecnico_responsavel, tecnico_responsavel_id FROM chamados
           WHERE id = %s AND status = 'Resolvido'""",
        (id,),
    )
    chamado = cursor.fetchone()
    if not chamado:
        cursor.close()
        conn.close()
        raise HTTPException(status_code=409, detail="O chamado não está finalizado")
    if not tecnico_pode_gerenciar(chamado, user):
        cursor.close()
        conn.close()
        raise HTTPException(status_code=403, detail="Somente o responsável pode reabrir este chamado")

    tecnico = user.get("nome_exibicao") or user.get("usuario")
    cursor.execute("UPDATE chamados SET status = 'Em Atendimento' WHERE id = %s", (id,))
    mensagem = criar_mensagem(cursor, id, "sistema", "Sistema", f"{tecnico} reabriu seu chamado.")
    registrar_auditoria(cursor, id, "reaberto", user)
    conn.commit()
    cursor.close()
    conn.close()
    anyio.from_thread.run(chat_manager.broadcast, id, mensagem)
    return {"mensagem": "Chamado reaberto com sucesso"}

@router.post("/{id}/chat")
def adicionar_mensagem(id: int, msg: ChatMessage, user=Depends(get_current_user)):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute(
        """SELECT usuario_nome, status, tecnico_responsavel_id FROM chamados
           WHERE id = %s""",
        (id,),
    )
    row = cursor.fetchone()
    if not row:
        cursor.close()
        conn.close()
        raise HTTPException(status_code=404, detail="Chamado não encontrado")
    try:
        validar_permissao_mensagem(id, user, row)
    except HTTPException:
        cursor.close()
        conn.close()
        raise
    autor_tipo, autor_nome = dados_autor(user)
    mensagem = criar_mensagem(cursor, id, autor_tipo, autor_nome, msg.mensagem.strip())
    conn.commit()
    cursor.close()
    conn.close()
    anyio.from_thread.run(chat_manager.broadcast, id, mensagem)
    return {"mensagem": "Mensagem adicionada", "dados": mensagem}


@router.post("/{id}/chat/anexo", response_model=MensagemResponse)
async def adicionar_anexo(
    id: int,
    arquivo: UploadFile = File(...),
    mensagem_texto: str = Form(default=""),
    user=Depends(get_current_user),
):
    nome_original = Path(arquivo.filename or "").name
    extensao = Path(nome_original).suffix.lower()
    if extensao not in TIPOS_ANEXO:
        raise HTTPException(status_code=415, detail="Tipo de arquivo não permitido. Use PNG, JPG, JPEG ou WEBP")

    conteudo_arquivo = await arquivo.read(MAX_ANEXO_BYTES + 1)
    if len(conteudo_arquivo) > MAX_ANEXO_BYTES:
        raise HTTPException(status_code=413, detail="A imagem deve ter no máximo 10 MB")

    mime, assinatura = TIPOS_ANEXO[extensao]
    assinatura_valida = conteudo_arquivo.startswith(assinatura)
    if extensao == ".webp":
        assinatura_valida = (
            conteudo_arquivo.startswith(b"RIFF")
            and len(conteudo_arquivo) >= 12
            and conteudo_arquivo[8:12] == b"WEBP"
        )
    if not assinatura_valida:
        raise HTTPException(status_code=415, detail="O conteúdo do arquivo não corresponde à extensão informada")

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute(
        """SELECT usuario_nome, status, tecnico_responsavel_id
           FROM chamados WHERE id = %s""",
        (id,),
    )
    row = cursor.fetchone()
    if not row:
        cursor.close()
        conn.close()
        raise HTTPException(status_code=404, detail="Chamado não encontrado")
    try:
        validar_permissao_mensagem(id, user, row)
    except HTTPException:
        cursor.close()
        conn.close()
        raise

    ANEXOS_DIR.mkdir(parents=True, exist_ok=True)
    nome_armazenado = f"{uuid4().hex}{extensao}"
    caminho = ANEXOS_DIR / nome_armazenado
    caminho.write_bytes(conteudo_arquivo)
    autor_tipo, autor_nome = dados_autor(user)

    try:
        mensagem = criar_mensagem(
            cursor,
            id,
            autor_tipo,
            autor_nome,
            mensagem_texto.strip() or f"Imagem: {nome_original}",
            tipo_conteudo="imagem",
            anexo_nome=nome_original,
            anexo_mime=mime,
            anexo_tamanho=len(conteudo_arquivo),
            anexo_arquivo=nome_armazenado,
        )
        conn.commit()
    except Exception:
        conn.rollback()
        caminho.unlink(missing_ok=True)
        raise
    finally:
        cursor.close()
        conn.close()

    await chat_manager.broadcast(id, mensagem)
    return mensagem


@router.get("/{id}/mensagens/{mensagem_id}/anexo")
def baixar_anexo(id: int, mensagem_id: int, user=Depends(get_current_user)):
    if not pode_acessar_chamado(id, user):
        raise HTTPException(status_code=403, detail="Não autorizado")

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute(
        """SELECT anexo_arquivo, anexo_nome, anexo_mime
           FROM mensagens WHERE id = %s AND chamado_id = %s AND tipo_conteudo = 'imagem'""",
        (mensagem_id, id),
    )
    anexo = cursor.fetchone()
    cursor.close()
    conn.close()
    if not anexo or not anexo["anexo_arquivo"]:
        raise HTTPException(status_code=404, detail="Anexo não encontrado")

    caminho = ANEXOS_DIR / Path(anexo["anexo_arquivo"]).name
    if not caminho.is_file():
        raise HTTPException(status_code=404, detail="Arquivo do anexo não encontrado")
    return FileResponse(caminho, media_type=anexo["anexo_mime"], filename=anexo["anexo_nome"])
