# Spaguas Quiz

Sistema de Quiz completo construído com Node.js, Express, Prisma, PostgreSQL e uma aplicação web em React. O projeto permite que administradores cadastrem quizzes, perguntas e alternativas, acompanhem métricas em um dashboard e que usuários respondam aos quizzes disputando um ranking.

## Recursos
- Cadastro de quizzes com status de ativação.
- Cadastro de perguntas e alternativas com validações de negócio.
- Acesso público às perguntas sem expor as respostas corretas.
- Registro de submissões, cálculo automático de pontuação e ranking.
- Autenticação JWT com perfis de usuário (admin/participante) e controle de acesso.
- Dashboard administrativo com ranking geral, top quizzes, top participantes e atividade recente.
- Interface web para administração (cadastro e manutenção) e para os participantes responderem aos quizzes.
- Gamificação com pontuação, níveis, conquistas, medalhas e ranking global.

## Pré-requisitos
- Node.js 18+
- PostgreSQL 13+
- Uma ferramenta de cliente HTTP (Insomnia, Postman, cURL, etc.)

## Configuração do backend
1. Duplique `.env.example` para `.env`, ajuste `DATABASE_URL` para sua instância Postgres, defina um `JWT_SECRET` forte e configure `PASSWORD_RESET_TOKEN_EXPIRY_MINUTES` conforme a política desejada (padrão: 60 minutos).
2. Instale as dependências (executado fora deste ambiente):
   ```bash
   npm install
   ```
3. Gere e aplique as migrações:
   ```bash
   npx prisma generate
   npx prisma migrate dev --name init
   ```
4. Execute a aplicação:
   ```bash
   npm run dev
   ```

O servidor será iniciado em `http://localhost:4000` (ajuste a porta via variável `PORT`).

## Configuração da interface web
1. Acesse a pasta `client` e duplique `.env.example` para `.env`, configurando `VITE_API_URL` se necessário.
2. Instale as dependências do frontend:
   ```bash
   cd client
   npm install
   ```
3. Execute o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```
4. A aplicação estará disponível em `http://localhost:5173` consumindo o backend em `http://localhost:4000/api`.

## Execução com Docker (banco externo)
1. Garanta que o arquivo `.env` contém os dados de conexão para o banco externo acessível a partir do container (por exemplo, use o IP/hostname público do servidor e não `localhost`).
2. Opcionalmente ajuste `PORT` (porta exposta da API) e `SERVE_CLIENT=true` para servir os arquivos estáticos da interface dentro do mesmo container.
3. Faça o build da imagem:
   ```bash
   docker compose build
   ```
4. Aplique as migrações na base externa:
   ```bash
   docker compose run --rm app npx prisma migrate deploy
   ```
5. Inicie os serviços:
   ```bash
   docker compose up -d
   ```
6. A API (e a SPA embarcada) ficarão disponíveis em `http://localhost:${PORT:-4000}`.

> Observação: o `docker-compose.yml` não provisiona um banco local, permitindo conectar-se diretamente ao servidor PostgreSQL de produção ou staging informado via `DATABASE_URL`.

## Autenticação e gerenciamento de usuários
- O primeiro cadastro criado via `POST /api/auth/register` será promovido automaticamente a administrador.
  ```json
  {
    "name": "Administrador",
    "email": "admin@exemplo.com",
    "password": "senha-super-segura"
  }
  ```
- Faça login com `POST /api/auth/login` para receber o token JWT.
  ```json
  {
    "email": "admin@exemplo.com",
    "password": "senha-super-segura"
  }
  ```
- Envie o token no header `Authorization: Bearer <token>` para acessar as rotas administrativas ou utilizar o painel web (`/admin`).
- Use o endpoint `POST /api/admin/users` ou a tela "Usuários" do painel para cadastrar novos administradores ou participantes.
- Também é possível criar ou promover um administrador via CLI:
  ```bash
  npm run create:admin -- --name "Admin" --email "admin@exemplo.com" --password "senha"
  ```
- Usuários autenticados podem atualizar seus dados e alterar a senha em `/account/profile`. Caso esqueçam a senha, utilizam `/auth/forgot-password` para gerar um token e `/auth/reset-password` para defini-la novamente.
- Configure as credenciais SMTP no `.env` (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, `APP_URL`) para que os e-mails de recuperação sejam enviados automaticamente. Ajuste também os badges padrões utilizando a tabela `Badge` caso deseje novas conquistas personalizadas.

## Estrutura do banco
O schema Prisma (`prisma/schema.prisma`) define as seguintes tabelas principais:
- `Quiz`
- `Question`
- `Option`
- `Submission`
- `SubmissionAnswer`

Cada `Question` pertence a um `Quiz`; cada `Option` pertence a uma `Question`. Submissões guardam as respostas escolhidas e a pontuação calculada.

## Endpoints Principais
Todos os endpoints estão disponíveis sob o prefixo `/api`.

### Autenticação
- `POST /api/auth/register` – cria uma conta (primeiro usuário é administrador por padrão).
- `POST /api/auth/login` – autentica o usuário e retorna o token JWT.
- `GET /api/auth/me` – obtém o perfil do usuário autenticado.
- `PUT /api/auth/me` – atualiza dados do perfil (nome/e-mail).
- `PUT /api/auth/me/password` – altera a senha informando a senha atual.
- `POST /api/auth/forgot-password` – gera token de redefinição (válido por tempo limitado).
- `POST /api/auth/reset-password` – redefine a senha usando o token gerado.

> Em ambiente de desenvolvimento o endpoint de recuperação retorna o token gerado para facilitar testes. Em produção, o token é enviado por e-mail via SMTP.

### Administração
- `POST /api/admin/quizzes` – cria um novo quiz.
  ```json
  {
    "title": "Fundamentos de JavaScript",
    "description": "Teste rápido sobre sintaxe e conceitos",
    "isActive": true
  }
  ```
- `PATCH /api/admin/quizzes/:quizId` – atualiza título/descrição (e status) de um quiz.
  ```json
  {
    "title": "Fundamentos de JS",
    "description": "Versão atualizada do quiz"
  }
  ```
- `POST /api/admin/quizzes/:quizId/questions` – adiciona pergunta a um quiz.
  ```json
  {
    "text": "Qual comando imprime no console?",
    "order": 1,
    "options": [
      { "text": "console.log()", "isCorrect": true },
      { "text": "print()", "isCorrect": false },
      { "text": "puts()", "isCorrect": false }
    ]
  }
  ```
- `GET /api/admin/quizzes` – lista quizzes com perguntas e respostas.
- `GET /api/admin/quizzes/:quizId` – detalhes do quiz (inclui respostas corretas).
- `DELETE /api/admin/quizzes/:quizId/questions/:questionId` – remove uma pergunta (reordena automaticamente as restantes).
- `DELETE /api/admin/quizzes/:quizId/ranking` – limpa todas as submissões e o ranking do quiz.
- `GET /api/admin/dashboard` – estatísticas e visão geral do sistema.
- `GET /api/admin/users` – lista usuários cadastrados e total de submissões.
- `POST /api/admin/users` – cria um novo usuário (participante ou administrador).

### Público
- `GET /api/quizzes` – lista quizzes ativos disponíveis para os participantes.
- `GET /api/quizzes/:quizId` – recupera quiz para responder (sem flag de respostas corretas).
- `POST /api/quizzes/:quizId/submissions` – envia respostas do usuário, calcula pontuação e posição no ranking.
  ```json
  {
    "userName": "Diego",
    "userEmail": "diego@example.com",
    "answers": [
      { "questionId": 1, "optionId": 2 },
      { "questionId": 2, "optionId": 5 }
    ]
  }
  ```
- Cada e-mail só pode participar uma única vez por quiz; em caso de duplicidade o serviço retorna `409`.
- `GET /api/quizzes/:quizId/ranking` – lista top 10 do ranking.

### Gamificação
- `GET /api/gamification/profile` – retorna pontos, nível, conquistas e eventos do usuário autenticado.
- `GET /api/gamification/leaderboard` – ranking global ordenado por pontuação.

## Próximos Passos Sugeridos
- Integrar serviço de e-mail em produção para envio real dos tokens de recuperação.
- Configurar monitoramento e analytics das métricas de gamificação.
- Publicar a aplicação em produção (containerização, pipelines, etc.).
