## Diagnóstico

Auditoria das cotações dos últimos 60 dias (`cotacoes`):

| Métrica | Resultado |
|---|---|
| Cotações com `veiculo_zero_km = true` | **0** |
| Cotações com `veiculo_chassi` preenchido | dezenas — **todas com placa real** (não-0KM) |
| Cotações com `veiculo_placa = NULL` e `status_contratacao ∈ {pagamento_ok, ativo}` | 6 (HONDA CG 160, YAMAHA XTZ 250, FIAT CRONOS) — provavelmente 0KM tratados informalmente |

Ou seja: **na prática, nenhuma cotação 0KM hoje cumpre a regra canônica do manual**.

## Causa raiz

O toggle **"Veículo dentro da Agência (0km)"** em `src/components/cotacao/EtapaConsultaFipe.tsx` é controlado por `modoNotaFiscal` em `src/pages/vendas/Cotacao.tsx`. Esse estado é usado **apenas localmente** para:

1. Desabilitar consulta FIPE
2. Trocar o rótulo "Valor FIPE" → "Valor da Nota Fiscal"
3. Passar `origemValor='nota'` para `EtapaResultado`

E nada mais. Quando o vendedor clica em **Iniciar Cadastro** (`handleIniciarCadastro`, linha 276 de `Cotacao.tsx`), o payload `dadosCotacao` enviado para `/vendas/contratos` **não inclui** `veiculo_zero_km`, `chassi` ou `renavam`. A interface `PrefilledCotacaoData` em `ContratoFormDialog.tsx` (linha 84) também não tem esses campos. Resultado: a flag morre no front-end e a coluna `cotacoes.veiculo_zero_km` nunca recebe `true` por esse caminho.

A única forma do flag ser gravado hoje é via `EtapaDadosPessoaisDocumentos.tsx` (linha 153 — `isZeroKm` default `false`), onde o **próprio associado** precisa lembrar de marcar no link público. Fonte de verdade errada.

## Consequências em cascata (regras quebradas)

- `sga-hinova-sync` (mem://logic/operations/sga-renavam-opcional-zero-km): só dispensa RENAVAM quando placa `0KM*` ou `aguardando_placa_definitiva=true`. Sem o flag, o sync exige RENAVAM e falha silenciosamente.
- `softruck-ativar-dispositivo` / `softruck-api` (mem://logic/integrations/softruck-placa-zero-km): só usa chassi como `plate/vin` quando `is_zero_km`. Sem o flag, registra rastreador com placa vazia/inválida.
- `documento-veiculo-equivalencia` (CRLV/CRV/NF aceitos para 0KM): sem o flag o link público continua exigindo CRLV e rejeita NF.
- O ramo "abaixo do mínimo FIPE → autovistoria completa obrigatória" continua funcionando (depende só de FIPE), mas a contratação + emplacamento + SGA quebram para 0KM.

## Plano de correção

### 1. Propagar `veiculo_zero_km` end-to-end no fluxo interno

**`src/pages/vendas/Cotacao.tsx`** — `handleIniciarCadastro`:
- Incluir `veiculo_zero_km: modoNotaFiscal` em `dadosCotacao.veiculo`
- Quando `modoNotaFiscal && !placa`, gerar placeholder `placa = 'AAAA0000'` + marcar `aguardando_placa_definitiva: true` (formato canônico — o sufixo `*` só é mascaramento; coluna real aceita 7 chars)
- Incluir `valor_origem: 'nota_fiscal'` no payload

**`src/components/contratos/ContratoFormDialog.tsx`**:
- Estender `PrefilledCotacaoData.veiculo` com `zero_km?: boolean` e `aguardando_placa_definitiva?: boolean`
- Repassar essas flags para `useCreateContrato`/edge `contrato-gerar`

**Edge `contrato-gerar`** (verificar):
- Já aceita esses campos? Se não, adicionar à validação Zod e gravar em `cotacoes.veiculo_zero_km` + `cotacoes.aguardando_placa_definitiva` (criar coluna se ausente) + `contratos.aguardando_placa_definitiva`.

### 2. Tornar o link público derivado, não auto-declarado

**`src/components/cotacao-publica/EtapaDadosPessoaisDocumentos.tsx`**:
- `useState(false)` → inicializar a partir de `cotacao.veiculo_zero_km`
- Travar o toggle (read-only) se a cotação já está marcada como 0KM pelo vendedor
- Quando 0KM: tornar RENAVAM opcional, aceitar `nota_fiscal_veiculo` ou `atpv_e` no lugar do CRLV (já existe a lista `TIPOS_EQUIVALENTES_CRLV`, validar que está sendo usada na regra de bloqueio do botão "Avançar")

### 3. UI do Cadastro

**`PropostaDetalhesTabs.tsx` / cards de aprovação** (auditar):
- Mostrar badge "0KM — aguardando placa definitiva" quando `cotacoes.veiculo_zero_km = true`
- Exibir chassi (identificador principal) com destaque ≥ placa

### 4. Backfill controlado (apenas leitura → relatório)

- Gerar SQL de auditoria listando as **6 cotações suspeitas** (sem placa + status ≥ `pagamento_ok` + categorias compatíveis com agência).
- **Não** marcar `veiculo_zero_km=true` automaticamente — esses casos já contrataram informalmente; apresentar lista ao operador para confirmação manual.
- Para cada caso confirmado: UPDATE pontual em migration nominal.

### 5. Guard de regressão

- Migration: criar trigger `BEFORE INSERT/UPDATE` em `cotacoes` que, quando `veiculo_zero_km = true`, exige um dos: `veiculo_chassi IS NOT NULL` **ou** `aguardando_placa_definitiva = true`. Bloqueia gravar 0KM "vazio".
- Migration: criar trigger em `contratos` espelhando a mesma invariante.

### 6. Memória canônica

Criar `mem://logic/quotation/cotacao-0km-fluxo-canonico` consolidando: toggle do vendedor é fonte de verdade → propagação até `cotacoes.veiculo_zero_km` → herança pelo link público → SGA/Softruck dependem do flag → backfill só com confirmação humana.

## Arquivos a modificar

```text
src/pages/vendas/Cotacao.tsx                                   (handleIniciarCadastro: propagar 0km)
src/components/contratos/ContratoFormDialog.tsx                (estender PrefilledCotacaoData)
src/hooks/useCreateContrato.ts                                 (gravar flag em cotação + contrato)
supabase/functions/contrato-gerar/index.ts                     (validar e persistir flag)
src/components/cotacao-publica/EtapaDadosPessoaisDocumentos.tsx (derivar isZeroKm da cotação, lock)
src/components/cadastro/proposta/PropostaDetalhesTabs.tsx      (badge 0KM + chassi como ID)
supabase/migrations/<ts>_cotacao_0km_guard_e_backfill.sql      (coluna aguardando_placa_definitiva em cotacoes se faltar, triggers de invariante, relatório)
mem://logic/quotation/cotacao-0km-fluxo-canonico.md             (nova regra)
mem://index.md                                                  (referência à nova memória)
```

## Pontos de atenção / decisão do usuário

1. **6 cotações já contratadas sem flag 0KM** — vou listar e aguardar você confirmar quais marcar retroativamente. Posso aplicar todas? Ou prefere caso a caso?
2. **Placeholder de placa** — confirmar formato (sugestão: `0KM` + 4 dígitos do `numero` da cotação para garantir unicidade, ex. `0KM5025`). Aceita?
3. O SGA Hinova e a Softruck **não** serão re-sincronizados nesta task (são integrações externas com efeito colateral); apenas o flag será corrigido para que **as próximas** cotações 0KM já entrem corretas. Confirma?
