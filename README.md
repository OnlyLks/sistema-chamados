# Sistema de Chamados Interno

Aplicação web para abertura, acompanhamento e gerenciamento de chamados técnicos internos.

## Funcionalidades

- Cadastro e autenticação de colaboradores;
- Autenticação de técnicos e administrador;
- Abertura, atendimento, transferência e finalização de chamados;
- Chat em tempo real por WebSocket;
- Envio de imagens `.png`, `.jpg`, `.jpeg` e `.webp` de até 10 MB;
- Gestão de técnicos;
- Auditoria de ações;
- Painel de chamados ativos e histórico;
- Tema claro e escuro.

## Tecnologias

### Frontend

- React;
- Vite;
- React Router;
- Axios.

### Backend

- Python 3.14;
- FastAPI;
- Uvicorn;
- WebSocket;
- Pydantic;
- python-jose;
- bcrypt;
- MySQL Connector.

### Infraestrutura

- Ubuntu Server;
- MySQL;
- Caddy;
- systemd.

## Arquitetura

```text
Navegador → Caddy → FastAPI → MySQL
```

O Caddy entrega o frontend compilado e encaminha as requisições `/api` ao backend FastAPI. O backend permanece restrito ao próprio servidor, em `127.0.0.1:8000`.

## Requisitos

- Ubuntu Server 26.04 LTS ou versão compatível;
- Python 3.14;
- MySQL 8.0+ ou MariaDB compatível;
- Node.js 20 ou superior;
- npm;
- Caddy;
- Git.

## Instalação no Ubuntu Server

Atualize o sistema e instale as dependências:

```bash
sudo apt update
sudo apt upgrade -y

sudo apt install -y \
  python3.14 \
  python3.14-venv \
  python3.14-dev \
  python3-pip \
  mysql-server \
  nodejs \
  npm \
  git \
  curl \
  ufw
```

Crie o usuário que executará o backend:

```bash
sudo adduser chamados
```

Clone o projeto:

```bash
sudo mkdir -p /opt/sistema-chamados
sudo chown chamados:chamados /opt/sistema-chamados

sudo -u chamados git clone \
  https://github.com/OnlyLks/sistema-chamados-interno.git \
  /opt/sistema-chamados
```

## Configuração do backend

Acesse a pasta do backend:

```bash
cd /opt/sistema-chamados/backend
```

Crie o ambiente virtual:

```bash
sudo -u chamados python3.14 -m venv venv
```

Instale as dependências:

```bash
sudo -u chamados venv/bin/python -m pip install --upgrade pip
sudo -u chamados venv/bin/python -m pip install -r requirements.txt
```

Crie o arquivo de configuração:

```bash
sudo -u chamados cp .env.example .env
sudo -u chamados nano .env
```

Exemplo de configuração:

```env
APP_ENV=production

DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=sistema_chamados
DB_USER=sistema_chamados_app
DB_PASSWORD=SUBSTITUA_POR_UMA_SENHA_FORTE

JWT_SECRET=SUBSTITUA_POR_UMA_CHAVE_ALEATORIA_DE_NO_MINIMO_64_CARACTERES
JWT_SECRET_PREVIOUS=
ACCESS_TOKEN_EXPIRE_MINUTES=480

CORS_ORIGINS=http://chamados.exemplo.local
TRUSTED_HOSTS=chamados.exemplo.local,localhost,127.0.0.1
```

Proteja o arquivo de configuração:

```bash
sudo chown chamados:chamados .env
sudo chmod 600 .env
```

## Banco de dados

Crie o banco e todas as tabelas:

```bash
sudo mysql < /opt/sistema-chamados/database/scriptDB.sql
```

Crie um usuário exclusivo para a aplicação:

```bash
sudo mysql
```

No console MySQL:

```sql
CREATE USER 'sistema_chamados_app'@'127.0.0.1'
IDENTIFIED BY 'SUBSTITUA_POR_UMA_SENHA_FORTE';

GRANT SELECT, INSERT, UPDATE, DELETE
ON sistema_chamados.*
TO 'sistema_chamados_app'@'127.0.0.1';

FLUSH PRIVILEGES;
EXIT;
```

A senha desse usuário deve ser a mesma informada em `DB_PASSWORD` no arquivo `backend/.env`.

### Criar o administrador inicial

O usuário com login `admin` possui acesso administrativo no sistema.

Gere um hash bcrypt para a senha que deseja utilizar:

```bash
cd /opt/sistema-chamados/backend

sudo -u chamados venv/bin/python -c \
"import bcrypt, getpass; print(bcrypt.hashpw(getpass.getpass('Senha do admin: ').encode(), bcrypt.gensalt()).decode())"
```

Copie o hash exibido e insira o administrador:

```bash
sudo mysql sistema_chamados
```

```sql
INSERT INTO usuarios_ti (usuario, nome_exibicao, senha_hash)
VALUES ('admin', 'Administrador', 'COLE_AQUI_O_HASH_BCRYPT');
```

Depois de entrar como administrador, os demais técnicos podem ser cadastrados pela própria interface.

## Build do frontend

```bash
cd /opt/sistema-chamados/frontend

sudo -u chamados npm ci
sudo -u chamados npm run build
```

Os arquivos estáticos serão gerados em:

```text
/opt/sistema-chamados/frontend/dist
```

## Serviço do backend

Crie o serviço:

```bash
sudo nano /etc/systemd/system/chamados-backend.service
```

Conteúdo:

```ini
[Unit]
Description=Backend do Sistema de Chamados
After=network-online.target mysql.service
Wants=network-online.target
Requires=mysql.service

[Service]
User=chamados
Group=chamados
WorkingDirectory=/opt/sistema-chamados/backend
EnvironmentFile=/opt/sistema-chamados/backend/.env
ExecStart=/opt/sistema-chamados/backend/venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
Restart=always
RestartSec=5
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
```

Ative o serviço:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now chamados-backend
sudo systemctl status chamados-backend --no-pager
```

## Configuração do Caddy

Crie ou edite o arquivo:

```bash
sudo nano /etc/caddy/Caddyfile
```

```caddyfile
http://chamados.exemplo.local {
    @api path /api /api/*

    handle @api {
        uri strip_prefix /api
        reverse_proxy 127.0.0.1:8000
    }

    handle {
        root * /opt/sistema-chamados/frontend/dist
        try_files {path} /index.html
        file_server
    }
}
```

Valide e reinicie:

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl enable --now caddy
sudo systemctl restart caddy
```

## Firewall

Libere a porta HTTP somente para a rede interna:

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing

sudo ufw allow from 192.168.0.0/16 to any port 80 proto tcp
sudo ufw allow from IP_DO_ADMINISTRADOR to any port 22 proto tcp

sudo ufw enable
sudo ufw status numbered
```

Não libere as portas `3306` e `8000` para a rede.

## Testes

No servidor:

```bash
curl -I -H "Host: chamados.exemplo.local" http://127.0.0.1/
sudo systemctl status chamados-backend --no-pager
sudo systemctl status caddy --no-pager
```

Em um computador da rede:

```powershell
Test-NetConnection chamados.exemplo.local -Port 80
```

Acesse:

```text
http://chamados.exemplo.local
```

## Segurança

- Não versione o arquivo `.env`;
- Não publique dumps SQL, backups, anexos ou dados reais;
- Não exponha MySQL na porta `3306`;
- Mantenha o backend em `127.0.0.1:8000`;
- Utilize HTTPS em produção sempre que possível;
- Inclua o banco e a pasta `backend/uploads` na rotina de backup;
- Use senha forte para o MySQL e uma chave JWT aleatória com no mínimo 64 caracteres.

## Licença

Defina uma licença apropriada antes de disponibilizar o projeto para reutilização.
