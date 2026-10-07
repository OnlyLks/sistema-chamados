-- ============================================================
-- Sistema de Chamados Interno
-- Estrutura limpa do banco de dados
-- MySQL 8.0+ / MariaDB compatível
-- ============================================================

CREATE DATABASE IF NOT EXISTS sistema_chamados
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE sistema_chamados;

-- Técnicos e administrador do sistema
CREATE TABLE IF NOT EXISTS usuarios_ti (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    usuario       VARCHAR(60) NOT NULL UNIQUE,
    nome_exibicao VARCHAR(100) NOT NULL,
    senha_hash    VARCHAR(255) NOT NULL,
    data_cadastro DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Colaboradores que abrem chamados
CREATE TABLE IF NOT EXISTS colaboradores (
    id               INT AUTO_INCREMENT PRIMARY KEY,
    nome             VARCHAR(150) NOT NULL,
    email            VARCHAR(150) NOT NULL UNIQUE,
    unidade          VARCHAR(100) NOT NULL,
    setor            VARCHAR(100) NOT NULL,
    senha_hash       VARCHAR(255) NOT NULL,
    data_cadastro    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    data_atualizacao DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                      ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Chamados abertos pelos colaboradores
CREATE TABLE IF NOT EXISTS chamados (
    id                     INT AUTO_INCREMENT PRIMARY KEY,
    usuario_nome           VARCHAR(150) NOT NULL,
    colaborador_id         INT DEFAULT NULL,
    unidade                VARCHAR(100) DEFAULT NULL,
    setor                  VARCHAR(100) NOT NULL,
    prioridade             ENUM('Baixa', 'Média', 'Alta')
                           NOT NULL DEFAULT 'Baixa',
    descricao              TEXT NOT NULL,
    status                 ENUM('Aberto', 'Em Atendimento', 'Resolvido')
                           NOT NULL DEFAULT 'Aberto',
    tecnico_responsavel    VARCHAR(100) DEFAULT NULL,
    tecnico_responsavel_id INT DEFAULT NULL,
    historico_chat         LONGTEXT DEFAULT NULL,
    data_criacao           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    data_atualizacao       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                           ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_chamado_colaborador
        FOREIGN KEY (colaborador_id)
        REFERENCES colaboradores(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_chamado_tecnico
        FOREIGN KEY (tecnico_responsavel_id)
        REFERENCES usuarios_ti(id)
        ON DELETE SET NULL,

    INDEX idx_chamados_status (status),
    INDEX idx_chamados_tecnico (tecnico_responsavel),
    INDEX idx_chamados_tecnico_id (tecnico_responsavel_id),
    INDEX idx_chamados_usuario (usuario_nome),
    INDEX idx_chamados_colaborador_id (colaborador_id),
    INDEX idx_chamados_unidade_setor (unidade, setor),
    INDEX idx_chamados_data (data_criacao)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Histórico de ações realizadas nos chamados
CREATE TABLE IF NOT EXISTS auditoria_chamados (
    id         BIGINT AUTO_INCREMENT PRIMARY KEY,
    chamado_id INT NOT NULL,
    acao       VARCHAR(40) NOT NULL,
    autor_tipo VARCHAR(20) NOT NULL,
    autor_id   INT DEFAULT NULL,
    autor_nome VARCHAR(150) DEFAULT NULL,
    detalhes   VARCHAR(255) DEFAULT NULL,
    criado_em  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_auditoria_chamado
        FOREIGN KEY (chamado_id)
        REFERENCES chamados(id)
        ON DELETE CASCADE,

    INDEX idx_auditoria_chamado_data (chamado_id, criado_em)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Mensagens e anexos do chat de cada chamado
CREATE TABLE IF NOT EXISTS mensagens (
    id             BIGINT AUTO_INCREMENT PRIMARY KEY,
    chamado_id     INT NOT NULL,
    autor_tipo     ENUM('colaborador', 'tecnico', 'sistema') NOT NULL,
    autor_nome     VARCHAR(150) DEFAULT NULL,
    conteudo       TEXT NOT NULL,
    criado_em      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    tipo_conteudo  ENUM('texto', 'imagem') NOT NULL DEFAULT 'texto',
    anexo_nome     VARCHAR(255) DEFAULT NULL,
    anexo_mime     VARCHAR(100) DEFAULT NULL,
    anexo_tamanho  INT UNSIGNED DEFAULT NULL,
    anexo_arquivo  VARCHAR(255) DEFAULT NULL,

    CONSTRAINT fk_mensagens_chamado
        FOREIGN KEY (chamado_id)
        REFERENCES chamados(id)
        ON DELETE CASCADE,

    INDEX idx_mensagens_chamado_data (chamado_id, criado_em, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Inserir usuário admin (GERE UMA SENHA HASH)
INSERT IGNORE INTO usuarios_ti (usuario, nome_exibicao, senha_hash)
VALUES (
    'admin',
    'Administrador T.I',
    'SENHA GERADA AQUI'
);

SELECT 'Banco sistema_chamados criado com sucesso.' AS status;
