# Unilentes - Backend API

API REST para o sistema Unilentes, construída com Node.js, Express e Prisma ORM.

## 🛠 Tecnologias

- [Node.js](https://nodejs.org/) + [Express](https://expressjs.com/)
- [TypeScript](https://www.typescriptlang.org/) - Tipagem estática
- [Prisma ORM](https://www.prisma.io/) - Mapeamento objeto-relacional e migrações
- [Zod](https://zod.dev/) - Validação de schemas e requests
- [JWT](https://jwt.io/) + [Bcrypt](https://www.npmjs.com/package/bcryptjs) - Autenticação e criptografia de senhas

## 🚀 Como executar localmente

Instalação, variáveis de ambiente e execução estão no [README da raiz](../../README.md).

## 📦 Scripts Disponíveis

- `pnpm run dev`: Inicia a API em modo de desenvolvimento com hot-reload (`tsx watch`).
- `pnpm run build`: Compila o código TypeScript para JavaScript (pasta `dist/`).
- `pnpm run start`: Inicia a aplicação já compilada (ideal para produção).
- `pnpm run db:migrate`: Cria e aplica migrações em desenvolvimento (`prisma migrate dev`).
- `pnpm run test:pdf`: Roda os testes do gerador de PDF.
- `pnpm run db:generate`: Atualiza os tipos gerados pelo Prisma Client.
- `pnpm run db:studio`: Abre uma interface web do Prisma para visualizar e editar o banco.
- `pnpm run lint`: Roda o ESLint para encontrar problemas no código.
- `pnpm run format`: Formata os arquivos usando Prettier.