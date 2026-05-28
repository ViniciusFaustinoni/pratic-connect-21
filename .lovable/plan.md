## Problema

Quando `contrato-gerar` / `autentique-create` falham (ex.: e-mail sem `@` — caso `Jesusmatheus8917gmail.com`), o consultor vê só um `toast.error` genérico vindo de `error.message`. Sem código de erro, sem solução, sem botão para corrigir — a cotação fica travada e exige intervenção manual no banco.

Hoje o backend já valida o e-mail e lança `Error('O e-mail do solicitante (...) é inválido...')`, mas:
- O hook `useGerarContrato` (`src/hooks/useContratos.ts`) só faz `toast.error(error.message)`.
- A invocação via `supabase.functions.invoke` engole o body 4xx (perde `code`/`hint`).
- Mesmo padrão em `useCotacoes.aceitarCotacao` e nas chamadas a `autentique-create`.

## Objetivo

Para erros recuperáveis (começando por e-mail inválido), o consultor recebe:
1. O **erro exato** com o **código** visível (ex.: `[EMAIL_INVALIDO]`)
2. Um **modal de correção inline** que atualiza o campo no banco e **reprocessa** a operação automaticamente — sem sair da tela, sem suporte técnico.

## Mudanças

### 1. Backend — erros estruturados com `code`

Padronizar as edges para responder `4xx` com JSON `{ code, mensagem, hint, campo }` em vez de `throw new Error(...)` solto:

- `supabase/functions/contrato-gerar/index.ts` (linhas 468–481):
  - Validação de nome → `code: 'NOME_INVALIDO'`, `campo: 'nome'`
  - Validação de e-mail → `code: 'EMAIL_INVALIDO'`, `campo: 'email_solicitante'`, `hint: 'Corrija o e-mail e reprocesse — formato esperado: nome@dominio.com'`
- `supabase/functions/autentique-create/index.ts` (linhas 777–785): mesmo padrão para os mesmos códigos (defesa em profundidade).
- Helper compartilhado mínimo (`_shared/erroEstruturado.ts`) com `respostaErro(status, code, mensagem, extras)` — só pra não repetir o JSON.

### 2. Frontend — propagar `code` e abrir modal

- **`src/hooks/useContratos.ts` (`useGerarContrato`)** e **`src/hooks/useCotacoes.ts` (`aceitarCotacao` linha 564)**:
  - Trocar `toast.error(error.message)` por `toastErroEdge(error, 'Gerar proposta')` (helper já existe em `src/lib/ui/toastErroEdge.ts` e já sabe parsear `error.context`).
  - Adicionar `EMAIL_INVALIDO` ao set `CODIGOS_409_CONHECIDOS` em `toastErroEdge.ts` (toast persistente com `[EMAIL_INVALIDO]` visível).
  - Mutation passa a **re-throw** o `EdgeErrorParsed` para o componente caller decidir abrir modal de correção.

- **Novo componente `src/components/cotacoes/CorrigirEmailDialog.tsx`**:
  - Props: `open`, `onOpenChange`, `cotacaoId`, `contratoId?`, `emailAtual`, `onReprocessar(novoEmail)`.
  - Form simples com `<Input type="email">` + validação `EMAIL_REGEX` no submit.
  - Ao confirmar: UPDATE em `cotacoes.email_solicitante` (+ `contratos.cliente_email` + `associados.email` quando vinculados), chama `onReprocessar` (reinvoca `contrato-gerar` / `autentique-create`), fecha em sucesso.
  - Layout segue padrão de `ConfirmacaoAcaoDialog`.

- **Callers que disparam contrato-gerar/autentique-create** abrem o modal quando `code === 'EMAIL_INVALIDO'`:
  - `src/pages/vendas/Cotacao.tsx` (e o ponto em `/vendas/contratos` que chama `useGerarContrato`)
  - `src/hooks/useAtribuirPlano.ts` (linha 167) — chama `autentique-create-by-token`
  - `src/components/cotacao-publica/EtapaAssinaturaContrato.tsx` — fluxo do link público

### 3. Saneamento do caso atual (COT-20260528-141222375-095)

Migration única corrigindo `Jesusmatheus8917gmail.com` → `Jesusmatheus8917@gmail.com` em `cotacoes`, `contratos` e `associados`, e re-disparando `autentique-create` para `CTR-20260528171456-3LA6ZH`. (Aguardo sua confirmação de que o e-mail correto é esse antes de aplicar.)

## Resultado pro consultor

```text
Antes:  toast.error("Edge Function returned a non-2xx status code")  → travado
Depois: toast persistente "Gerar proposta: O e-mail do solicitante
        (Jesusmatheus8917gmail.com) é inválido [EMAIL_INVALIDO]
        Corrija o e-mail e reprocesse..."
        + Modal "Corrigir e-mail e reprocessar" abre automaticamente
        + Consultor digita o novo e-mail → salva → reprocessa → contrato OK
```

## Escopo desta primeira iteração

Só **e-mail inválido**. A infra (backend estruturado + `toastErroEdge` + padrão de "modal de correção") fica pronta pra estender depois pra `NOME_INVALIDO`, `CPF_INVALIDO`, `TELEFONE_INVALIDO` etc. com baixo custo.

## Arquivos tocados

- `supabase/functions/_shared/erroEstruturado.ts` (novo, ~15 linhas)
- `supabase/functions/contrato-gerar/index.ts` (validação e-mail/nome)
- `supabase/functions/autentique-create/index.ts` (validação e-mail)
- `src/lib/ui/toastErroEdge.ts` (adicionar `EMAIL_INVALIDO` ao set)
- `src/components/cotacoes/CorrigirEmailDialog.tsx` (novo)
- `src/hooks/useContratos.ts` (`useGerarContrato`)
- `src/hooks/useCotacoes.ts` (`aceitarCotacao`)
- `src/hooks/useAtribuirPlano.ts`
- `src/pages/vendas/Cotacao.tsx` (e ponto de `/vendas/contratos`)
- `src/components/cotacao-publica/EtapaAssinaturaContrato.tsx`
- Migration de saneamento da COT-20260528-141222375-095 (após confirmação)
