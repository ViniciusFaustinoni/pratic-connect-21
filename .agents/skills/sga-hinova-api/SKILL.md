---
name: sga-hinova-api
description: Reference for the Hinova SGA v2 REST API (associados, veículos, boletos, eventos, vistorias, benefícios, MGF, voluntários). Use when integrating, building or debugging any `sga-*` edge function, the `sga_sync_queue` pipeline, the `/configuracoes/integracoes/sga-hinova` UI, or any direct call to `api.hinova.com.br/api/sga/v2`.
---

# SGA Hinova API v2

Skill espelhando o apidoc oficial de `https://api.hinova.com.br/api/sga/v2/doc/` — **136 endpoints em 15 grupos**, com parâmetros, exemplos de requisição e de resposta extraídos do `api_data.json`.

## Base URL e ambiente

- Produção: `https://api.hinova.com.br/api/sga/v2`
- No projeto a base é resolvida em `supabase/functions/_shared/hinova-client.ts`:
  ```ts
  const apiUrl = Deno.env.get('HINOVA_API_URL') || 'https://api.hinova.com.br/api/sga/v2';
  ```
- Credenciais: secrets `HINOVA_USUARIO`, `HINOVA_SENHA` (e `HINOVA_API_URL` opcional).

## Autenticação (regra crítica — stateful)

1. `POST /usuario/autenticar` com `{usuario, senha}` → `{mensagem, token_usuario}`.
2. Demais chamadas: `Authorization: Bearer <token_usuario>` + `Content-Type: application/json`.
3. **A Hinova é stateful**: cada novo `/usuario/autenticar` **invalida** os tokens anteriores. Por isso o projeto reusa a sessão via `getHinovaSession()` (`_shared/hinova-client.ts`). Em 401/403 fora da janela horária, reautenticar **apenas uma vez** — nunca a cada request.
4. O token **não tem TTL declarado** (não expira por tempo), mas pode ser invalidado por outra autenticação concorrente; trate isso como condição esperada.

## Convenções do projeto

- **Nunca chamar a Hinova direto do front.** Sempre passar por um edge `sga-*` (existe um helper genérico em `_shared/hinova-client.ts`).
- **Fila canônica de sync**: `sga_sync_queue` — ver `mem://infrastructure/integrations/sga-sync-queue-canonical`. UI fonte da verdade: `/configuracoes/integracoes/sga-hinova` (aceita `?placa=`).
- **Idempotência de fotos**: `sga_fotos_enviadas` + flag `force_resync_media` (mem `sga-fotos-idempotencia`).
- **Tipos de foto**: códigos 13/14 são provisórios (mem `tipo-foto-contrato-temporario`); técnicas sem equivalente vão pro código 15 (mem `sga-fotos-codigo-15-adicional`).
- **Logs/erros**: edges propagam erro real (502 + `Retry-After`), nunca `console.error+continue` silencioso (mem `edges-propagam-erro-real-em-updates-criticos`).

## Pegadinhas do upstream já documentadas

Quando bater contra uma dessas, **NÃO mude a heurística sem consultar a memória correspondente**:

- **Boletos**: campos vêm como `valor_boleto` / `situacao_boleto`, **não** `valor`/`situacao`. `/listar/boleto-associado-veiculo` exige `diasFuturo` (default 90) p/ enxergar mensalidade futura. BAIXADO traz sentinela em `linha_digitavel`/`link_boleto` (limpar p/ null). "Pago" exige `data_pagamento` preenchida **E** sinal textual de baixa. → mem `sga-boletos-campos-canonicos-e-lookahead`.
- **Inadimplência**: boletos vencidos NÃO bastam — consultar também `/buscar/situacao-financeira-veiculo/`. Sem sinal financeiro em todos os veículos = INCONCLUSIVO (bloqueia Cadastro, exige bypass auditado). → mem `sga-inadimplencia-veiculo-canonica` + `gate-financeiro-cadastro-inconclusivo`.
- **Troca de titularidade**: usar `POST /alterar/veiculo`. **NUNCA** inativar veículo+associado para "recriar" — não libera o índice de placas. → mem `sga-alterar-veiculo-troca-titularidade`.
- **Pós-cadastro**: o sistema **NUNCA** envia ATIVO. Força PENDENTE (situação=3) via `GET /associado/alterar-situacao-para/3/:codigo_associado` **e** `GET /veiculo/alterar-situacao-para/3/:codigo_veiculo`. Promoção a ATIVO é manual no painel SGA. → core memory.
- **RENAVAM em 0KM**: opcional; placeholder "só zeros" tratado como NULL. → mem `sga-renavam-opcional-zero-km`.
- **CPF duplicado com busca vazia**: `cadastrar` retorna "CPF já existe" **mas** `buscar/cpf` pode dar 404/406. Resolver com `cadastrarOuAtualizarAssociadoHinova` → `motivo:'codigo_associado_nao_encontrado'` + fila `falha_manual_codigo_nao_encontrado`. → mem `sga-cpf-duplicado-busca-vazia`.
- **`dia_vencimento`**: sempre resolver via `contratos.dia_vencimento` + `resolverDiaVencimento`. **Proibido** `|| 10` cego em payloads. → mem `sga-dia-vencimento-fonte`.
- **Inativar veículo substituído**: `GET /veiculo/alterar-situacao-para/2/:codigo` (não-bloqueante). → mem `sga-inativar-veiculo-substituido`.

## Como usar esta skill

A skill é progressiva — começa aqui e desce conforme a tarefa:

1. **Índice de 136 endpoints** com método/URL/título e link pro grupo:
   `code--view knowledge://skill/sga-hinova-api/references/_index.md`
2. **Detalhes por grupo** (parâmetros + exemplos oficiais de request e response, copiados verbatim do apidoc):
   - `references/autenticacao.md` (1)
   - `references/associado.md` (20)
   - `references/beneficiario.md` (11)
   - `references/beneficio.md` (5)
   - `references/boleto.md` (12)
   - `references/veiculo.md` (30)
   - `references/vistoria.md` (5)
   - `references/produto.md` (10)
   - `references/cota.md` (2)
   - `references/regional.md` (2)
   - `references/cooperativa.md` (3)
   - `references/fornecedor.md` (2)
   - `references/evento.md` (6)
   - `references/atendimento.md` (5)
   - `references/mgf.md` (12)
   - `references/voluntario.md` (10)
3. **Fallback bruto** — o `api_data.json` original (399 KB) está em `assets/api_data.json` para qualquer detalhe não coberto pelas references (basta `code--view` ou `jq`).

## Padrão mínimo de chamada (referência)

```ts
// 1) autenticar (ou reaproveitar sessão)
const auth = await fetch(`${apiUrl}/usuario/autenticar`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ usuario, senha }),
});
const { token_usuario } = await auth.json();

// 2) chamar qualquer endpoint
const r = await fetch(`${apiUrl}/veiculo/buscar/ABC1D23`, {
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token_usuario}`,
  },
});
```

No projeto, use sempre o helper de `_shared/hinova-client.ts` (cuida de sessão, retry single-shot em 401, métricas e propagação de erro estruturada).
