## Contexto

Após inspeção do código e do banco:

- **287 planos ativos** em `public.planos`, **TODOS com `codigo_sga_plano = NULL`**.
- A função `sga-hinova-sync` exige `codigo_sga_plano` preenchido — sem ele, nenhuma ativação real chega à Hinova com o plano correto (cai no default da conta).
- Credenciais Hinova já configuradas em `integracoes_credenciais` (`configurado=true`).
- A doc oficial (`https://api.hinova.com.br/api/sga/v2/doc/`) é uma SPA — `fetch_website` só capturou o início (Autenticação + Associado). Para descobrir o endpoint exato de **Plano** preciso fazer chamadas reais à API com o token, listando os caminhos plausíveis (`/listar/planos`, `/plano/listar`, `/listar/plano-protecao`, `/listar/tipo-plano`, etc.).

Esta investigação **exige executar chamadas autenticadas** (modo build), pois a doc não está disponível via HTTP estático.

## Entregáveis

1. **Edge function `hinova-discover-planos`** (descartável) que:
   - Autentica na Hinova.
   - Tenta uma lista de endpoints candidatos GET (`/listar/plano/ativo`, `/plano/listar`, `/listar/tipo-plano/ativo`, `/listar/planos-protecao`, `/listar/servicos`, `/listar/tipo-servico/ativo`, etc.) e retorna o body cru de cada um.
   - Identifica qual endpoint devolve a lista de planos com `codigo_plano` (ou similar), nome, valor.

2. **Relatório comparativo** (Markdown salvo em `/mnt/documents/hinova-vs-local-planos.md`) contendo:
   - **Lista completa de planos da Hinova** (código, nome, valor configurado lá, cobertura/categoria se disponível).
   - **Lista completa dos 287 planos locais** (id, nome, linha, fipe_min/max, valor_adesão e — quando houver — valor mensal mínimo via `tabelas_preco_mensalidade`).
   - **Tabela de match** por similaridade de nome (algoritmo de tokens normalizados) com 3 colunas: `Local → Hinova sugerido (score)`, `Match exato?`, `Diferença de valor`.
   - **Resumo executivo**: quantos batem 100%, quantos parciais, quantos sem correspondência, divergências de valor.

3. **Análise estrutural** documentando se a estrutura Hinova é compatível:
   - A Hinova trabalha com **um código numérico por "plano de proteção"** ligado à conta/regional. Nossos 287 planos são variações (ex.: linha + cobertura + região + deságio + uso). Provável conclusão: a Hinova tem **muito menos planos** que nós — vários dos nossos planos locais (ex.: "Select One Passeio 5%", "...- Lagos", "...- SP") devem mapear para o **mesmo** `codigo_plano` Hinova, com a diferença de valor sendo calculada via `valor_fixo`/`valor_adesao` no payload de cadastro do veículo.

4. **Decisão sobre auto-preenchimento via API**:
   - Se houver match >= 95% por token de nome + faixa FIPE compatível → marca como **auto-preenchível**.
   - Se houver ambiguidade → marca como **revisão manual** e lista os 3 candidatos top.
   - Gera um **migration SQL preview** (não executado) com `UPDATE planos SET codigo_sga_plano='X' WHERE id='...'` para os matches confiáveis, salvo em `/mnt/documents/hinova-codigos-suggested.sql`.

5. **UI opcional (somente se aprovado pelo usuário depois)**: tela em `/configuracoes/integracoes/hinova/planos` com tabela editável (Local | Hinova sugerido | Confirmar) e botão "Aplicar selecionados" que grava os códigos.

## Plano de execução (após aprovação)

```text
Etapa 1 — Descoberta de endpoint
  • Criar edge function hinova-discover-planos
  • Autenticar e probar 8 endpoints candidatos
  • Identificar o endpoint correto + formato de resposta

Etapa 2 — Coleta
  • Chamar o endpoint identificado
  • Persistir snapshot em /mnt/documents/hinova-planos-raw.json

Etapa 3 — Comparação
  • Script Python lê snapshot + SELECT de planos locais
  • Calcula match por token Jaccard, faixa FIPE, palavras-chave
    (lancamento|select_one, deságio %, aplicativo, lagos, sp, diesel)
  • Gera tabela Markdown e SQL preview

Etapa 4 — Apresentar resultado ao usuário
  • Relatório em /mnt/documents/
  • Decisão: aplicar SQL automático para matches >= 95% ou
    abrir UI de revisão manual
```

## Detalhes técnicos

- **Endpoint de auth confirmado**: `POST https://api.hinova.com.br/api/sga/v2/usuario/autenticar` com `{usuario, senha}` e header `Authorization: Bearer {token}`. Retorna `token_usuario` (não expira).
- **Cache de sessão** já existe em `_shared/hinova-client.ts` (`getHinovaSession`) — reutilizar.
- **Endpoints candidatos a testar** (baseados em padrões da doc):
  `/listar/plano/ativo`, `/listar/plano-protecao/ativo`, `/listar/tipo-plano/ativo`, `/plano/listar/ativo`, `/listar/servico/ativo`, `/listar/tipo-servico/ativo`, `/listar/planos`, `/listar/produtos/ativo`.
- **Campo destino**: `public.planos.codigo_sga_plano` (text). Validação atual em `sga-hinova-sync` linha 1514: `Number.parseInt(planoRow.codigo_sga_plano, 10)` — então deve ser numérico.
- **Heurística de match de valor**: comparar `valor_fixo` Hinova com a faixa `tabelas_preco_mensalidade` do plano local na FIPE média; tolerância de R$ 5,00.
- **Risco de janela horária**: a Hinova bloqueia por horário comercial em algumas contas — a função já trata `HinovaTransientError` com `reason='janela_horaria'`.

## Não inclui

- Aplicar UPDATE em massa sem revisão (gerado como SQL preview, não executado).
- Alterar a estrutura de `planos` ou `codigo_sga_plano`.
- Mudar o fluxo de sync atual (`sga-hinova-sync`).
