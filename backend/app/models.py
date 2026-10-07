from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime

class ColaboradorLogin(BaseModel):
    email: str = Field(..., min_length=5, max_length=150)
    senha: str = Field(..., min_length=1, max_length=128)

class ColaboradorCadastro(BaseModel):
    nome: str = Field(..., min_length=3, max_length=150)
    email: str = Field(..., min_length=5, max_length=150)
    senha: str = Field(..., min_length=8, max_length=128)
    unidade: str = Field(..., min_length=2, max_length=100)
    setor: str = Field(..., min_length=2, max_length=100)

class TecnicoLogin(BaseModel):
    usuario: str
    senha: str

class TecnicoCreate(BaseModel):
    usuario: str
    nome_exibicao: str
    senha: str

class TecnicoUpdate(BaseModel):
    usuario: Optional[str] = None
    nome_exibicao: Optional[str] = None
    senha: Optional[str] = None

class ChamadoCreate(BaseModel):
    usuario_nome: Optional[str] = None
    setor: Optional[str] = None
    prioridade: Literal["Baixa", "Média", "Alta"] = "Baixa"
    descricao: str

class ChatMessage(BaseModel):
    mensagem: str

class MensagemResponse(BaseModel):
    id: int
    chamado_id: int
    autor_tipo: Literal["colaborador", "tecnico", "sistema"]
    autor_nome: Optional[str] = None
    conteudo: str
    criado_em: datetime
    tipo_conteudo: Literal["texto", "imagem"] = "texto"
    anexo_nome: Optional[str] = None
    anexo_mime: Optional[str] = None
    anexo_tamanho: Optional[int] = None

class ChamadoStatusUpdate(BaseModel):
    status: Literal["Aberto", "Em Atendimento", "Resolvido"]
    tecnico_responsavel: Optional[str] = None

class ChamadoTransferencia(BaseModel):
    tecnico_id: int

class ChamadoResponse(BaseModel):
    id: int
    usuario_nome: str
    colaborador_id: Optional[int] = None
    unidade: Optional[str] = None
    setor: str
    prioridade: str
    descricao: str
    status: str
    tecnico_responsavel: Optional[str]
    tecnico_responsavel_id: Optional[int] = None
    historico_chat: Optional[str]
    data_criacao: datetime
    data_atualizacao: datetime
