# Trocaí — primeira publicação no Cloudflare Pages

## Estado atual e limitações

Este passo prepara **somente o frontend React/Vite** para ser publicado no Cloudflare Pages. O backend Express/tRPC, o login Manus OAuth, o MySQL e as integrações Manus Forge ainda existem no projeto original e **não funcionarão só por publicar os arquivos estáticos**. Não apresente este deploy como versão completa para usuários. A próxima etapa é migrar autenticação e operações de dados para Supabase e decidir como tratar as funções de servidor que ainda não foram migradas.

## Antes de começar

1. Tenha acesso à conta Cloudflare e a uma conta GitHub.
2. Descompacte o ZIP numa pasta local.
3. Crie um repositório **privado** no GitHub para o projeto (recomendado enquanto o código está em migração).
4. Envie os arquivos do diretório do projeto para esse repositório. Não envie `.env` nem segredos; confira o `.gitignore`.

## Configuração do Cloudflare Pages

No painel Cloudflare:

1. Abra **Workers & Pages**.
2. Selecione **Create application** → **Pages** → **Connect to Git**.
3. Autorize o GitHub e escolha o repositório do Trocaí.
4. Configure:
   - **Production branch:** `main`
   - **Framework preset:** `Vite` (ou `None` se não aparecer)
   - **Build command:** `pnpm install --no-frozen-lockfile && pnpm build:pages`
   - **Build output directory:** `dist/public`
   - **Root directory:** deixe em branco (raiz do repositório)
5. Se for solicitado um Node.js, use uma versão compatível com Vite 7 (Node 20.19+ ou 22.12+).
6. Clique em **Save and Deploy**. O Cloudflare fornecerá um endereço `*.pages.dev`.

> Se a instalação do pnpm ou a atualização do lockfile falhar no build, não ignore o erro: confira o log completo e ajuste o package manager/lockfile antes de repetir. O script `build:pages` não compila o backend.

## Verificação pós-publicação

- Abra o endereço `*.pages.dev` e confira se a página inicial e os estilos aparecem.
- Atualize diretamente uma rota interna para confirmar que o fallback SPA funciona.
- Abra o console do navegador. Requisições a `/api/trpc` ainda podem falhar até a migração do backend/autenticação; isso é esperado nesta etapa.
- Não cadastre dados reais nem divulgue o site como pronto até que Supabase Auth, tabelas, políticas RLS e operações de dados sejam implementadas e testadas.

## Segurança e migração seguinte

- Nunca coloque `service_role`, senhas do banco ou outros segredos em variáveis `VITE_*`.
- No frontend, apenas a URL do projeto Supabase e a chave `anon`/publishable podem ser expostas; habilite RLS em todas as tabelas expostas.
- Não apague o site Manus nem o banco antigo antes de validar a versão nova e planejar a migração dos dados.
- O build ainda pode depender de pacotes presentes no lockfile; a configuração do Vite já não importa o plugin de runtime/debug do Manus.
