## Contexto

Hoje a tela pública `Proteção ativada!` (mostrada após o contrato ser ativado) só exibe um botão "Acessar meu app de associado". Mas para o associado que acabou de ser ativado **não existe usuário em `auth.users`**, então ele não tem senha para logar. Existe um fluxo `/app/criar-senha` + edge function `app-criar-senha`, mas ele depende de um token separado (`auth_tokens_primeiro_acesso`) que precisaria ter sido enviado por e-mail — e neste caso não foi gerado.

A solução é permitir que o associado **crie a senha direto na tela de ativação**, autorizado pelo próprio token público da cotação.

## O que será feito

### 1. Edge function nova: `cotacao-criar-senha`
Recebe `{ token_cotacao, senha }`. Valida:
- Cotação existe e `status_contratacao = 'ativo'`
- Tem `contrato_gerado_id` apontando para contrato `status = 'ativo'`
- Resolve o associado pelo contrato

Cria a conta de acesso seguindo o mesmo padrão do `app-criar-senha` existente:
- Se `associados.user_id` for nulo: cria usuário em `auth.users` com e-mail `<cpf>@associado.pratic.com.br` (mesma convenção já usada), confirma e-mail, gera profile (`tipo='associado'`, `primeiro_acesso=false`), insere em `user_roles` com role `associado`, vincula `user_id` no associado.
- Se já tiver `user_id`: apenas atualiza a senha via `auth.admin.updateUserById` e marca `primeiro_acesso=false`.

Registra log em `auth_logs` e histórico em `associados_historico`. Retorna `{ success, email, cpf }` para o front exibir no próximo passo.

Critérios de segurança:
- O token público é o único fator de autorização — funciona porque já é o mesmo token que o associado usou para contratar e está vinculado a um contrato ativo dele.
- Senha mínima: 8 caracteres, com regras iguais às do `DefinirSenha` interno (maiúscula, minúscula, número).
- Idempotência: se a senha já foi criada antes (existe user_id e o associado já fez login), retornar mensagem "Conta já existe, vá para o login".

### 2. Front — `src/pages/public/CotacaoContratacao.tsx`
Substituir o conteúdo do early-return atual (`status_contratacao === 'ativo'`) por um componente novo `EtapaCriacaoSenha` com 3 estados:

- **Estado inicial — formulário de senha**:
  - Card mantém o cabeçalho "Proteção ativada!" + número da cotação.
  - Adiciona dois campos: "Crie sua senha" e "Confirmar senha", com toggle de mostrar/ocultar.
  - Indicador visual de força + checklist (mín 8, maiúscula, minúscula, número) — reaproveitando o padrão visual do `DefinirSenha.tsx`.
  - Mostra dica do e-mail que será usado: "Seu login será: `<cpf-mascarado>@associado.pratic.com.br`".
  - Botão "Criar senha e ativar acesso" — desabilitado até validações passarem.

- **Estado de sucesso**:
  - Mensagem de confirmação + botão "Acessar meu app de associado" → redireciona para `/app/login` com `?email=<email>` para pré-preencher.

- **Estado "conta já criada"** (idempotente):
  - Card avisa que a senha já foi definida e oferece o link de login + "Esqueci minha senha".

A submissão chama a edge function via `publicSupabase.functions.invoke('cotacao-criar-senha', { body: { token, senha } })`.

### 3. Página `/app/login`
Aceitar query param `?email=` e pré-preencher o campo de e-mail. (Verificação rápida no componente — provavelmente já existe um login simples; se não, adicionar essa leitura é trivial.)

### 4. Correção retroativa do associado atual
O associado MARCUS (`a4e62fa5-c217-48c3-acd7-9390f13985eb`) está sem `user_id`. Não é necessária migração de banco — assim que abrir o link público da cotação após o deploy, ele cai no formulário e cria a senha pelo fluxo novo.

## Detalhes técnicos

```text
[Tela pública /cotacao/:token]
        │  status_contratacao = 'ativo'
        ▼
[Form de senha]  ──► publicSupabase.functions.invoke('cotacao-criar-senha')
                            │
                            ▼
                  ┌───────────────────────────────┐
                  │  Edge function (service role) │
                  │  1. Valida token + contrato   │
                  │  2. Cria/atualiza auth.user   │
                  │  3. Cria profile + role       │
                  │  4. Vincula user_id           │
                  └───────────────────────────────┘
                            │ success
                            ▼
                  [Tela de sucesso → /app/login?email=...]
```

Tabelas tocadas pelo edge: `cotacoes` (read), `contratos` (read), `associados` (read + update user_id), `profiles` (insert/update), `user_roles` (upsert), `auth_logs` (insert), `associados_historico` (insert), `auth.users` (admin). Nenhuma migração necessária.

## Fora de escopo

- Reenvio do e-mail "primeiro acesso" via WhatsApp/Email automático após ativação (pode ser uma evolução futura, mas a tela inline já cobre o caso comum em que o associado fica na própria página após ativar).
- Mexer no `/app/criar-senha` antigo — continua funcionando para os casos em que o token de e-mail for usado.
