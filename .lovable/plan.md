## Contexto

Hoje o `cotacao-criar-senha` força o login do associado para `<cpf>@n.com.br` (padrão antigo, igual ao `app-criar-senha`/`api-externa`/`create-test-user`). O e-mail real informado pelo associado na cotação fica só guardado em `associados.email`/`profiles.email`, mas não é usado para login. A tela de sucesso ainda exibe o sintético — exatamente o que aparece no print.

A diretriz é: **passar a usar o e-mail real da cotação como login**, com fallback seguro para o sintético quando o real não existir ou já estiver em uso por outra conta.

## O que será feito

### 1. Edge function `cotacao-criar-senha`
Resolver o e-mail de login na ordem:
1. `associados.email` (preferido)
2. `cotacoes.email` / `leads.email` (se vazio no associado, persistir de volta no associado)
3. fallback `<cpf>@n.com.br` quando nada disponível

Antes de criar a conta:
- Normalizar (`trim().toLowerCase()`) e validar formato.
- Verificar via `auth.admin.listUsers({ email })` (ou `profiles` por e-mail) se já existe outro `user_id` com aquele e-mail e que **não pertence a este associado**. Se sim:
  - Se for um e-mail genuinamente do associado mas já tem conta antiga → retornar 409 com a mensagem "Já existe conta com este e-mail. Use 'Esqueci minha senha'."
  - Se for um e-mail compartilhado (ex.: cônjuge) → cair no fallback `<cpf>@n.com.br` automaticamente e devolver `email_fallback: true` para a UI avisar.

Quando criar/atualizar:
- `auth.admin.createUser({ email: loginEmail, ... })` usando o e-mail real.
- Se associado já tem `user_id` com o sintético antigo, fazer `updateUserById(user_id, { email: loginEmail, password })` para migrar o login para o real.
- Atualizar `profiles.email` e `associados.email` com o e-mail real.
- Atualizar log em `auth_logs` para registrar o e-mail efetivo.

Resposta passa a incluir `{ email, email_origem: 'real' | 'fallback_cpf' }`.

### 2. Front — `EtapaCriacaoSenhaCotacao.tsx`
- Buscar o e-mail real para exibir como dica antes do envio (já temos os dados da cotação carregados em `useCotacaoContratacao`). Mostrar: "Seu login será: `joao@email.com`" (ou o sintético quando não houver e-mail).
- Tela de sucesso: usar `email` retornado pela edge (substitui o "12493649737@n.com.br" do print). Quando `email_origem === 'fallback_cpf'`, exibir um aviso curto: "Seu e-mail não pôde ser usado como login; usamos seu CPF."
- Botão "Acessar meu app de associado" continua redirecionando para `/app/login?email=<email retornado>`.

### 3. Correção retroativa do MARCUS
Como o associado do print já criou conta com o sintético, na próxima vez que abrir a tela e clicar em criar senha, a edge:
- Detecta `user_id` existente.
- Atualiza o e-mail para o real (se houver e estiver livre) + nova senha.
- A UI passa a mostrar o e-mail real.

Sem migração de banco necessária.

### 4. Fora de escopo
- Não mexer em `app-criar-senha`, `api-externa`, `create-test-user` — continuam usando `<cpf>@n.com.br`. Só o fluxo público da cotação ganha o e-mail real.
- Não mudar a convenção do login dos demais usuários (vendedores, técnicos, etc.).

## Detalhes técnicos

```text
[POST cotacao-criar-senha { token, senha }]
        │
        ▼
  resolve_email_login():
    associado.email
      ├─ vazio? → cotacao.email / leads.email (e persiste em associados)
      └─ ainda vazio? → <cpf>@n.com.br (fallback)
        │
        ▼
  e-mail já está em uso por outro user?
    ├─ sim, é do mesmo associado → updateUserById(password)
    ├─ sim, outro user_id → 409 "use Esqueci minha senha"
    └─ não → createUser({ email, password })
        │
        ▼
  upsert profiles.email + associados.email + user_roles + log
        │
        ▼
  return { success, email, email_origem, already_existed }
```

Tabelas tocadas: `cotacoes` (read), `leads` (read), `contratos` (read), `associados` (read+update email/user_id), `profiles` (insert/update email + primeiro_acesso), `user_roles` (upsert), `auth_logs` (insert), `auth.users` (admin). Nenhuma migração.

