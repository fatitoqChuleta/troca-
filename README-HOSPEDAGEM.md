# Trocaí — código para hospedagem própria

Este ZIP contém o **código-fonte** do Trocaí (checkpoint `79971e3`). Ele não contém senhas, chaves, banco de dados, contas, anúncios, conversas ou fotos já armazenadas.

## Antes de instalar: há serviços externos necessários

O Trocaí foi construído no Manus WebDev. Para funcionar em outro servidor, configure estes serviços por conta própria:

- **Banco:** MySQL 8 ou compatível/TiDB. O banco precisa estar acessível pelo servidor.
- **Login:** o código usa Manus OAuth. Configure a aplicação OAuth para o domínio definitivo e cadastre o callback `https://SEU-DOMINIO/api/oauth/callback`. Sem essas credenciais e a autorização do domínio, cadastro e login não funcionarão. Trocar para outro provedor de login exige adaptação do código.
- **Fotos:** o envio e a leitura de fotos usam a API de armazenamento Manus (`BUILT_IN_FORGE_API_URL` e `BUILT_IN_FORGE_API_KEY`). Você pode manter acesso a esse serviço ou substituir `server/storage.ts` e `server/_core/storageProxy.ts` por uma integração própria com S3 compatível.
- **Painel de administração:** `OWNER_OPEN_ID` precisa corresponder ao identificador da conta proprietária no provedor de login.

O ZIP não migra o banco que está no Manus. `pnpm db:push` cria/atualiza as tabelas, mas **não transfere** contas, anúncios, mensagens, avaliações, denúncias nem arquivos. Se precisar desses dados, faça uma migração separada e autorizada antes de desligar a instalação atual.

A minuta de políticas no site ainda contém campos pendentes para identificação do responsável e e-mail de contato, além do aviso de revisão jurídica. Preencha e revise isso antes de abrir o serviço ao público.

## Requisitos

- Linux ou outro sistema que rode Node.js.
- Node.js `20.19+` ou `22.12+` (recomendado: Node 22 LTS).
- Corepack e pnpm `10.4.1` (a versão indicada pelo projeto).
- MySQL 8 ou compatível/TiDB.
- Um domínio com HTTPS e um proxy reverso (Nginx, Caddy ou equivalente).

## Instalação e inicialização

1. Envie e descompacte `trocai-para-servidor.zip` no servidor; entre na pasta `trocai-para-servidor`.
2. Instale Node.js e habilite o pnpm indicado:

   ```bash
   corepack enable
   corepack prepare pnpm@10.4.1 --activate
   ```

3. Copie `.env.example` para `.env`, abra o arquivo e preencha os valores reais. Gere um segredo de sessão forte com `openssl rand -base64 48`. Restrinja o acesso ao arquivo (`chmod 600 .env`) e não o envie para Git, chamados ou mensagens públicas.
4. Instale as dependências e prepare o banco:

   ```bash
   pnpm install --frozen-lockfile
   pnpm db:push
   ```

5. Valide e gere a versão de produção:

   ```bash
   pnpm check
   pnpm test
   pnpm build
   ```

6. Configure seu proxy reverso para encaminhar HTTPS ao processo Node na porta definida por `PORT` (padrão `3000`). O login usa cookies `Secure`, então o domínio público deve usar HTTPS.
7. Inicie o serviço com `pnpm start`. Para mantê-lo no ar após sair do terminal ou reinicializar o servidor, configure um gerenciador de processos do seu provedor (por exemplo, systemd ou PM2).

## Variáveis de ambiente

Use `.env.example` como modelo. `DATABASE_URL`, `JWT_SECRET`, `OAUTH_SERVER_URL`, `VITE_APP_ID`, `VITE_OAUTH_PORTAL_URL`, `OWNER_OPEN_ID`, `BUILT_IN_FORGE_API_URL` e `BUILT_IN_FORGE_API_KEY` precisam ser configurados para as funções correspondentes. As variáveis que começam com `VITE_` são incorporadas ao JavaScript público durante `pnpm build`; **nunca coloque nelas uma chave secreta de servidor**. `VITE_FRONTEND_FORGE_API_KEY`, caso seja necessário para o mapa, ficará visível no navegador e deve ser uma chave pública restrita ao domínio — nunca reutilize `BUILT_IN_FORGE_API_KEY` ali.

Analytics foi desativado no HTML deste pacote. Se quiser medir visitas, configure um serviço de analytics próprio e adicione sua integração depois de revisar a política de privacidade.

## Notas de operação

- O comando `pnpm start` espera que `pnpm build` já tenha criado `dist/`.
- Faça backup do banco e dos arquivos de imagem; a cópia do código não é um backup de dados.
- Atualizações posteriores do código devem ser instaladas e validadas como uma nova versão; não substitua um serviço em produção sem backup e plano de retorno.
- Este pacote é a aplicação do MVP, não um teste de carga nem garantia de capacidade para um número específico de acessos. Faça teste de carga e monitore banco, CPU, memória e armazenamento antes de ampliar o público.
