# Unilentes

Sistema de catálogos de lentes oftalmológicas: cadastro de produtos e tratamentos, catálogo público e exportação em PDF e CSV.

```
unilentes/
├── apps/
│   ├── api/      # Node.js + Express + Prisma (MySQL)
│   └── front/    # React 19 + Vite + Tailwind
├── package.json
└── pnpm-workspace.yaml
```

## Pré-requisitos

- Node.js 22
- pnpm 9.15.9 (`corepack enable` usa a versão definida no `package.json`)
- MySQL 8 (ou Docker para subir um banco local)

**Windows:** use o WSL e instale o Node dentro dele. Rodar o Node do Windows sobre um caminho `\\wsl.localhost\...` não funciona, porque o pnpm cria symlinks do Linux no `node_modules`.

## Configuração

### 1. Instalar as dependências

Na raiz do repositório:

```bash
pnpm install
```

A instalação também baixa o Chrome usado pelo Puppeteer para gerar os PDFs.

### 2. Subir o banco

```bash
docker run -d --name unilentes_db \
  -e MYSQL_ROOT_PASSWORD=root \
  -e MYSQL_DATABASE=unilentes \
  -e MYSQL_USER=unilentes \
  -e MYSQL_PASSWORD=unilentes \
  -p 3306:3306 \
  -v unilentes_mysqldata:/var/lib/mysql \
  mysql:8
```

Nas próximas vezes, basta `docker start unilentes_db`.

### 3. Criar os arquivos `.env`

```bash
cp apps/api/.env.example apps/api/.env
cp apps/front/.env.example apps/front/.env
```

Em `apps/api/.env`, ajuste:

```env
DATABASE_URL="mysql://unilentes:unilentes@localhost:3306/unilentes"
JWT_SECRET="um-valor-com-pelo-menos-16-caracteres"
JWT_REFRESH_SECRET="outro-valor-com-pelo-menos-16-caracteres"
```

| Variável | App | Uso |
|---|---|---|
| `DATABASE_URL` | API | Conexão com o MySQL |
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | API | Assinatura dos tokens (mínimo de 16 caracteres) |
| `PORT` | API | Porta da API. Use `3030`, que é a porta do proxy do Vite |
| `CORS_ORIGIN` | API | URL do front |
| `EXPORTS_DIR` | API | Pasta dos PDFs e CSVs gerados |
| `VITE_API_URL` | Front | URL da API, usada só em desenvolvimento |

### 4. Preparar o banco

```bash
pnpm api:db:generate   # gera o Prisma Client
pnpm api:db:migrate    # aplica as migrações
pnpm api:db:seed       # cria os usuários admin e dados de exemplo
```

O sistema não tem tela de cadastro de usuário, então o primeiro login depende do seed. Os e-mails e senhas de desenvolvimento estão em `apps/api/prisma/seed.ts`. **Não rode o seed em produção:** ele cria administradores com senha conhecida.

## Rodar

Em dois terminais, na raiz:

```bash
pnpm api:dev     # API em http://localhost:3030
pnpm front:dev   # Front em http://localhost:5173
```

| Endereço | Conteúdo |
|---|---|
| `http://localhost:5173/login` | Painel administrativo |
| `http://localhost:5173/c` | Catálogo público, sem login |
| `http://localhost:3030/api/health` | Status da API |

## Testar

```bash
pnpm --dir apps/api test:pdf             # testes do gerador de PDF (abre o Chrome)
pnpm --dir apps/api test:import          # testes do leitor de planilhas
pnpm --dir apps/api exec tsc --noEmit    # checagem de tipos da API
pnpm --dir apps/front exec tsc --noEmit  # checagem de tipos do front
```

O repositório não tem CI: rode os comandos acima antes do push. Para ver o PDF gerado pelo teste, defina o destino:

```bash
PDF_TEST_OUTPUT=/tmp/teste.pdf pnpm --dir apps/api test:pdf
```

## Como usar

### Importar produtos

Em **Produtos > Importar arquivo**, envie a tabela de preços em Excel (`.xlsx`, `.xlsb`, `.xls`) ou um CSV, com até 30 MB.

**Planilha:**

1. Envie o arquivo. O sistema lista as abas que têm produtos.
2. Escolha as abas e informe a marca e a categoria de cada uma.
3. Clique em **Validar abas selecionadas**, confira os avisos e clique em **Importar**.

As colunas são localizadas pelos cabeçalhos, então a posição pode mudar entre abas. Uma coluna só vira tratamento se estiver no cadastro ou na lista `BASE_TREATMENTS` de `product.spreadsheet.ts`; as outras aparecem nos avisos e não são importadas. Categorias sem colunas configuradas recebem os tratamentos da aba.

**CSV:**

1. Baixe o modelo em **Baixar modelo CSV**.
2. Preencha uma linha por produto. **Cod. WEB, Material, Marca e Categoria** são obrigatórios.
3. Salve como CSV. O sistema aceita `;` ou `,`, em UTF-8 ou Windows-1252.
4. Envie o arquivo, confira o resumo e clique em **Importar**.

Regras:

- Com **Criar marcas, categorias e tratamentos que não existem** marcado, os cadastros que faltam são criados. Desmarcado, viram erro.
- Num CSV, cada coluna extra é um tratamento: confira a lista de novos cadastros para não criar um nome digitado errado.
- Produto com Cod. WEB existente é atualizado; código novo é criado.
- Na planilha, código repetido fica com a primeira aba selecionada. Se o preço for diferente, a tela avisa com exemplos.
- Qualquer erro impede a gravação do arquivo inteiro.
- **Célula vazia ou `-` numa coluna de tratamento apaga o preço daquele produto.**

### Configurar os tratamentos de uma categoria

Em **Marcas**, abra a marca e edite a categoria em **Colunas de tratamento (AR)**. A lista define quais tratamentos aparecem nas tabelas e no PDF, e em que ordem. Sem lista, aparecem só os tratamentos com preço em algum produto da categoria.

Um preço em tratamento fora da lista fica salvo, mas não aparece nas tabelas nem no PDF.

### Gerar PDF

Em **Exportações > Nova Exportação**, escolha o escopo, a ordem das marcas e as páginas de imagem. Cada página de imagem ocupa uma folha A4 inteira e pode ficar no início, no fim, ou antes ou depois de uma marca. Use imagens em retrato, 1414 × 2000 px ou proporcional, com até 10 MB.

## Banco de dados

Depois de alterar `apps/api/prisma/schema.prisma`:

```bash
pnpm api:db:migrate
pnpm api:db:generate
```

## Produção

```bash
pnpm --dir apps/api exec prisma migrate deploy   # antes de subir a versão nova
pnpm deploy:build                                # gera o Prisma Client e compila API e front
pnpm api:start
```

- Use `prisma migrate deploy` em produção. O `pnpm api:db:migrate` roda `prisma migrate dev`, que é só para desenvolvimento.
- Aplique as migrações antes de publicar: a API nova falha se o banco estiver desatualizado.
- O front compilado chama a API no mesmo domínio, então o proxy reverso precisa encaminhar `/api` e `/uploads` para a API.

## Problemas comuns

| Sintoma | Causa provável |
|---|---|
| `Variáveis de ambiente inválidas` ao subir a API | `.env` ausente ou segredo JWT com menos de 16 caracteres |
| `Can't reach database server` | Banco desligado. Rode `docker start unilentes_db` |
| Erro de tipo do Prisma depois de um pull | Rode `pnpm api:db:generate` |
| Erro de tabela inexistente | Migração pendente. Rode `pnpm api:db:migrate` |
| PDF com status "Falhou" | Chrome do Puppeteer não instalado ou faltam bibliotecas do sistema. Veja o erro no log da API |
| `ERR_INVALID_URL` ou módulo não encontrado no PowerShell | Node do Windows em caminho WSL. Rode pelo terminal do WSL |
