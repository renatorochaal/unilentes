# Unilentes - Backend API

API REST para o sistema Unilentes, construída com Node.js, Express e Prisma ORM.

## 🛠 Tecnologias

- [Node.js](https://nodejs.org/) + [Express](https://expressjs.com/)
- [TypeScript](https://www.typescriptlang.org/) - Tipagem estática
- [Prisma ORM](https://www.prisma.io/) - Mapeamento objeto-relacional e migrações
- [Zod](https://zod.dev/) - Validação de schemas e requests
- [JWT](https://jwt.io/) + [Bcrypt](https://www.npmjs.com/package/bcryptjs) - Autenticação e criptografia de senhas

## 🚀 Como executar localmente

### 1. Instalar dependências
Certifique-se de usar o `pnpm` (padrão do workspace):
```bash
pnpm install
```

### 2. Configurar variáveis de ambiente
Crie um arquivo `.env` na raiz da pasta `api-unilentes`:
```env
# Porta do servidor (opcional, padrão 3000)
PORT=3000

# String de conexão com o banco de dados
DATABASE_URL="file:./dev.db" # Exemplo usando SQLite

# Secret para geração dos tokens JWT
JWT_SECRET="seu_secret_super_seguro_aqui"
```

### 3. Configurar o Banco de Dados (Prisma)
Gere os artefatos do cliente do Prisma e rode as migrações para criar as tabelas:
```bash
pnpm run db:generate
pnpm run db:migrate
```
*(Opcional)* Popule o banco de dados com dados iniciais:
```bash
pnpm run db:seed
```

### 4. Rodar o servidor de desenvolvimento
Inicia o servidor com hot-reload (via `tsx`):
```bash
pnpm run dev
```
A API ficará disponível em `http://localhost:3000` (ou na porta configurada).

## 📦 Scripts Disponíveis

- `pnpm run dev`: Inicia a API em modo de desenvolvimento com hot-reload (`tsx watch`).
- `pnpm run build`: Compila o código TypeScript para JavaScript (pasta `dist/`).
- `pnpm run start`: Inicia a aplicação já compilada (ideal para produção).
- `pnpm run db:migrate`: Executa migrações pendentes no banco de dados.
- `pnpm run db:generate`: Atualiza os tipos gerados pelo Prisma Client.
- `pnpm run db:studio`: Abre uma interface web do Prisma para visualizar e editar o banco.
- `pnpm run lint`: Roda o ESLint para encontrar problemas no código.
- `pnpm run format`: Formata os arquivos usando Prettier.