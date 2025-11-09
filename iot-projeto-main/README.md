# 📊 Dashboard de Monitoramento - Umidade e Temperatura do Silo

Este projeto é um sistema completo de monitoramento em tempo real de dados de umidade e temperatura para silos, com uma interface web moderna e uma API RESTful.

## 🚀 Funcionalidades

### Frontend (Dashboard)
- **Visualização em Tempo Real**: Gráficos interativos de umidade e temperatura
- **Tabela de Dados**: Visualização tabular com paginação
- **Filtros Avançados**: 
  - Limite de registros (50, 100, 200, 500, 1000)
  - Filtro por data/hora inicial e final
- **Estatísticas**: 
  - Total de registros
  - Média de umidade e temperatura
  - Período dos dados
- **Exportação de Dados**:
  - Gráfico como PNG
  - Dados como CSV
- **Design Responsivo**: Interface adaptável para desktop e mobile

### Backend (API)
- **Conexão com MongoDB Atlas**: Armazenamento e recuperação de dados
- **Endpoints RESTful**:
  - `/api/data` - Dados dos sensores com filtros
  - `/api/health` - Status da conexão com o banco
  - `/api/test` - Teste de conexão e estrutura de dados
  - `/api/stats` - Estatísticas detalhadas
- **Tratamento de Erros**: Mensagens de erro claras e logging

## 🛠️ Tecnologias Utilizadas

### Frontend
- **HTML5** + **Tailwind CSS** - Interface moderna e responsiva
- **Chart.js** - Gráficos interativos
- **JavaScript Vanilla** - Lógica do cliente

### Backend
- **Python** + **Flask** - Servidor API
- **PyMongo** - Driver MongoDB
- **Flask-CORS** - Habilitar CORS
- **python-dotenv** - Gerenciamento de variáveis de ambiente

### Banco de Dados
- **MongoDB Atlas** - Banco de dados na nuvem

## 📁 Estrutura do Projeto

```
iot-projeto/
│
├── 📄 index.html          # Tela de login
├── 📄 dashboard.html      # Interface principal do dashboard
├── 📄 app.js              # Lógica do frontend
├── 📄 style.css           # Estilos
├── 📄 README.md           # Este arquivo
│
└── 📁 api/                # Backend e configurações
    ├── 📄 app.py          # Servidor Flask API
    ├── 📄 requirements.txt # Dependências Python
    └── 📄 .env.example    # Exemplo de variáveis de ambiente
└── 📁 assets/             # Imagens
    ├── 📄 logo-silo.jpeg  # Logo AgriGrowth
    └── 📄 silos.jpeg      # Fundo da Tela de Login
```

## ⚙️ Configuração e Instalação

### Pré-requisitos
- Python 3.8+
- Node.js (apenas para servir arquivos estáticos)
- Conta no MongoDB Atlas

### 1. Configuração do Backend

```bash
# Navegue para a pasta api
cd api

# Instale as dependências Python
pip install -r requirements.txt

# Configure as variáveis de ambiente
cp .env.example .env
```

Edite o arquivo `.env` com suas credenciais:

```env
MONGO_URI=mongodb+srv://seu_usuario:senha@cluster.mongodb.net/?retryWrites=true&w=majority
DB_NAME=seu_banco_de_dados
COLLECTION_NAME=sua_colecao
```

### 2. Execução do Projeto

**Backend (API):**
```bash
cd api
python app.py
```

O servidor estará disponível em: `http://localhost:5000`

**Frontend (Dashboard):**
```bash
# Usando um servidor HTTP simples (Python)
python -m http.server 8000

# Ou usando o Live Server do VS Code
# Ou qualquer servidor web estático
```

O dashboard estará disponível em: `http://localhost:8000`

## 🔌 Endpoints da API

### GET `/api/data`
Retorna dados dos sensores com filtros.

**Parâmetros:**
- `limit` (opcional): Número máximo de registros (padrão: 100)
- `start_date` (opcional): Data/hora inicial (formato ISO)
- `end_date` (opcional): Data/hora final (formato ISO)

### GET `/api/health`
Verifica o status da conexão com o MongoDB.

### GET `/api/test`
Testa a conexão e mostra estrutura dos dados.

### GET `/api/stats`
Retorna estatísticas detalhadas dos dados.

## 📊 Estrutura dos Dados

Os documentos no MongoDB devem ter a seguinte estrutura:

```json
{
  "field1": 65.5,        // Umidade (%)
  "field2": 23.1,        // Temperatura (°C)
  "created_at": "2024-01-01T10:30:00Z"  // Data/hora
}
```

## 🎯 Como Usar

1. **Configuração Inicial**: 
   - Configure o MongoDB Atlas
   - Execute o backend e frontend
   - Verifique a conexão em `http://localhost:5000/api/health`

2. **Visualização de Dados**:
   - Acesse `http://localhost:8000`
   - Use os filtros para ajustar a visualização
   - Exporte gráficos ou dados conforme necessário

3. **Monitoramento Contínuo**:
   - Use o botão "Atualizar Dados" para refresh manual
   - Configure filtros por período específico

## 🐛 Solução de Problemas

### Erro de Conexão com MongoDB
- Verifique as credenciais no arquivo `.env`
- Confirme que o IP está na whitelist do MongoDB Atlas
- Teste a conexão em `http://localhost:5000/api/test`

### Dados Não Aparecendo
- Verifique se a collection existe e tem dados
- Confirme a estrutura dos documentos
- Use o endpoint `/api/test` para diagnosticar

### CORS Errors
- Certifique-se de que o Flask-CORS está instalado
- Verifique se a API está rodando na porta 5000

**Desenvolvido com ❤️ para o monitoramento inteligente de silos**
