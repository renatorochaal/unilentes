# Unilentes - Frontend

Aplicação web (SPA) para o sistema Unilentes, construída com React, TypeScript e Vite.

## 🛠 Tecnologias

- [React 19](https://react.dev/)
- [Vite](https://vitejs.dev/) - Bundler super rápido
- [TypeScript](https://www.typescriptlang.org/) - Tipagem estática
- [Tailwind CSS](https://tailwindcss.com/) - Estilização utilitária
- [React Router](https://reactrouter.com/) - Navegação
- [React Hook Form](https://react-hook-form.com/) + [Zod](https://zod.dev/) - Gerenciamento e validação de formulários
- [Axios](https://axios-http.com/) - Requisições HTTP

## 🚀 Como executar localmente

### 1. Instalar dependências
Certifique-se de usar o `pnpm` (padrão do workspace):
```bash
pnpm install
```

### 2. Configurar variáveis de ambiente
Crie um arquivo `.env` na raiz da pasta `front-unilentes` (você pode copiar do `.env.example` se existir):
```env
VITE_API_URL=http://localhost:3030
```

Essa variável é usada apenas em desenvolvimento. Em produção, o frontend acessa
a API pelo mesmo domínio, usando o proxy reverso das rotas `/api`.

### 3. Rodar o servidor de desenvolvimento
```bash
pnpm run dev
```
A aplicação ficará disponível em `http://localhost:5173` (ou outra porta indicada no terminal).

## 📦 Scripts Disponíveis

- `pnpm run dev`: Inicia o servidor local de desenvolvimento.
- `pnpm run build`: Faz a checagem de tipos (TypeScript) e compila a aplicação para produção (pasta `dist/`).
- `pnpm run preview`: Serve localmente a versão compilada (pasta `dist/`) para testes.
- `pnpm run lint`: Roda o ESLint para encontrar problemas no código.
- `pnpm run format`: Formata os arquivos usando Prettier.
