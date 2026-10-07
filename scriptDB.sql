-- ============================================================
--  Script de criação/atualização do banco de dados
--  Execute no MySQL Workbench antes de iniciar o sistema
-- ============================================================

CREATE DATABASE IF NOT EXISTS sistema_chamados
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE sistema_chamados;

-- ── Tabela principal de chamados ──────────────────────────────
CREATE TABLE IF NOT EXISTS chamados (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    usuario_nome        VARCHAR(150)    NOT NULL,
    colaborador_id      INT             DEFAULT NULL,
    unidade             VARCHAR(100)    DEFAULT NULL,
    setor               VARCHAR(80)     NOT NULL,
    prioridade          ENUM('Baixa','Média','Alta') NOT NULL DEFAULT 'Baixa',
    descricao           TEXT            NOT NULL,
    status              ENUM('Aberto','Em Atendimento','Resolvido') NOT NULL DEFAULT 'Aberto',
    tecnico_responsavel VARCHAR(100)    DEFAULT NULL,
    tecnico_responsavel_id INT           DEFAULT NULL,
    historico_chat      LONGTEXT        DEFAULT NULL,
    data_criacao        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    data_atualizacao    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE chamados ADD COLUMN IF NOT EXISTS tecnico_responsavel_id INT DEFAULT NULL;
ALTER TABLE chamados ADD COLUMN IF NOT EXISTS colaborador_id INT DEFAULT NULL;
ALTER TABLE chamados ADD COLUMN IF NOT EXISTS unidade VARCHAR(100) DEFAULT NULL;
ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS unidade VARCHAR(100) NOT NULL DEFAULT '';
ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS setor VARCHAR(100) NOT NULL DEFAULT '';

-- ── Tabela de usuários de T.I ─────────────────────────────────
CREATE TABLE IF NOT EXISTS usuarios_ti (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    usuario         VARCHAR(60)  NOT NULL UNIQUE,
    nome_exibicao   VARCHAR(100) NOT NULL,
    senha_hash      VARCHAR(255) NOT NULL,          -- bcrypt ou hash legado SHA-256
    data_cadastro   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Contas dos colaboradores ─────────────────────────────────
CREATE TABLE IF NOT EXISTS colaboradores (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    nome            VARCHAR(150) NOT NULL,
    email           VARCHAR(150) NOT NULL UNIQUE,
    unidade         VARCHAR(100) NOT NULL,
    setor           VARCHAR(100) NOT NULL,
    senha_hash      VARCHAR(255) NOT NULL,
    data_cadastro   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    data_atualizacao DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS auditoria_chamados (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    chamado_id  INT NOT NULL,
    acao        VARCHAR(40) NOT NULL,
    autor_tipo  VARCHAR(20) NOT NULL,
    autor_id    INT DEFAULT NULL,
    autor_nome  VARCHAR(150) DEFAULT NULL,
    detalhes    VARCHAR(255) DEFAULT NULL,
    criado_em   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_auditoria_chamado FOREIGN KEY (chamado_id) REFERENCES chamados(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Atualiza instalações existentes para aceitar hashes bcrypt.
ALTER TABLE usuarios_ti MODIFY senha_hash VARCHAR(255) NOT NULL;

-- Mensagens individuais: substitui o armazenamento de conversas em um único texto.
CREATE TABLE IF NOT EXISTS mensagens (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    chamado_id  INT NOT NULL,
    autor_tipo  ENUM('colaborador', 'tecnico', 'sistema') NOT NULL,
    autor_nome  VARCHAR(150) DEFAULT NULL,
    conteudo    TEXT NOT NULL,
    criado_em   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_mensagens_chamado
        FOREIGN KEY (chamado_id) REFERENCES chamados(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Índices para performance ──────────────────────────────────
CREATE INDEX idx_chamados_status ON chamados (status);
CREATE INDEX idx_chamados_tecnico ON chamados (tecnico_responsavel);
CREATE INDEX idx_chamados_tecnico_id ON chamados (tecnico_responsavel_id);
CREATE INDEX idx_chamados_usuario ON chamados (usuario_nome);
CREATE INDEX idx_chamados_colaborador_id ON chamados (colaborador_id);
CREATE INDEX idx_chamados_unidade_setor ON chamados (unidade, setor);
CREATE INDEX idx_chamados_data ON chamados (data_criacao);
CREATE INDEX idx_mensagens_chamado_data ON mensagens (chamado_id, criado_em, id);
CREATE INDEX idx_auditoria_chamado_data ON auditoria_chamados (chamado_id, criado_em);

-- Inserir usuário admin (GERE UMA SENHA HASH)
INSERT IGNORE INTO usuarios_ti (usuario, nome_exibicao, senha_hash)
VALUES (
    'admin',
    'Administrador T.I',
    'SENHA GERADA AQUI'
);

SELECT 'Banco configurado com sucesso!' AS status;
SELECT TABLE_NAME, TABLE_ROWS FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'sistema_chamados';
