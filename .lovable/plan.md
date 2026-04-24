
## Problema identificado

A integração de busca de boletos (`POST /listar/boleto-associado-veiculo`) **já existe** (`supabase/functions/_shared/hinova-client.ts` → `listarBoletosVeiculo`), mas está **violando regras obrigatórias da API documentada**, o que causa erros silenciosos / 406:

| Item | Doc Hinova | Implementação atual | Status |
|---|---|---|---|
| Janela máxima | **90 dias** | 5 anos (default) e 5 meses (sync) | ❌ Erro |
| `data_inicial` / `data_final` | obrigatório, dd/mm/aaaa | ok | ✅ |
| `link_boleto` | opcional, retorna URL | nunca enviado | ⚠️ Faltando |
| Identificador (`codigo_associado` ou `placa` ou `cpf` ou `codigo_veiculo`) | basta um par | enviamos os 2 códigos | ✅ |
| Janela do filtro | usar par vencimento OR pagamento OR emissão | só `data_inicial`/`data_final` (genérico) | ⚠️ Frágil |

Resultado: como o sistema dispara janelas de 150 dias / 1825 dias, a Hinova devolve 406 ou ignora o filtro, e os boletos chegam parciais ou vazios — o que explica o backfill ter "muitos vazios" mesmo com `codigo_hinova` correto.

## Plano (3 partes)

### 1. Corrigir o cliente Hinova (`supabase/functions/_shared/hinova-client.ts`)

- Em `listarBoletosVeiculo`, **trocar a janela única de 5 anos por janelas iterativas de 90 dias** cobrindo até N anos para trás (default 3 anos = ~12 chamadas) e concatenando resultados, deduplicados por `nosso_numero`.
- Aceitar `linkBoleto?: boolean` (default `true`) e enviar `link_boleto: true` no body — assim já gravamos `boleto_url` direto da Hinova.
- Aceitar `codigoSituacaoBoleto?: number` opcional para filtros pontuais (ex.: somente abertos = `1`).
- Usar **`data_vencimento_inicial` / `data_vencimento_final`** (par mais semântico para "boletos do veículo no período") em vez do par genérico `data_inicial`/`data_final`, mantendo compatibilidade enviando ambos.
- Limitar tamanho do payload em logs (continuar com `bodySample`).

### 2. Criar nova edge function `sga-testar-boletos-veiculo`

Função simples, **somente leitura, sem efeitos colaterais no banco** (não grava em `cobrancas`, não cria job), para validação isolada com 1 veículo:

- **Input:** `{ veiculo_id?: string, placa?: string, codigo_veiculo?: number, dias?: number }` (default 90 dias).
- **Fluxo:**
  1. Carrega o veículo + associado (resolve `codigo_hinova` em ambos).
  2. Autentica na Hinova.
  3. Se faltar `codigo_veiculo`, reconcilia por placa; se faltar `codigo_associado`, reconcilia por CPF.
  4. Chama `listarBoletosVeiculo` com janela de exatamente `dias` (≤90) e `link_boleto: true`.
  5. **Retorna o JSON cru da Hinova + um resumo normalizado** (status mapeado, valores parseados) — sem persistir.
- **Saída:** `{ success, codigo_associado, codigo_veiculo, janela: { inicio, fim }, request_payload, raw_response, boletos_normalizados, hinova_http_status }`.
- Loga em `sga_sync_logs` com `action: 'teste_listar_boletos'` para auditoria.

### 3. UI de teste em `Configurações > Integrações > Hinova`

Adicionar um card "Teste de Boletos por Veículo" em `src/pages/configuracoes/IntegracaoHinovaMapeamentos.tsx` (ou na página principal de Integrações Hinova — confirmar o melhor local após abrir a tela):

- Campo de busca por **placa** (autocomplete em `veiculos` com `codigo_hinova` not null).
- Seletor de janela: 30 / 60 / 90 dias.
- Botão **"Testar busca"** → chama `sga-testar-boletos-veiculo`.
- Exibe lado a lado:
  - **Request enviado** (codigo_associado, codigo_veiculo, datas, link_boleto).
  - **Resposta crua da Hinova** (JSON colapsável).
  - **Tabela normalizada**: nosso_numero, vencimento, valor, status, link.
- Mostra erros transitórios com `reason` (`janela_horaria`, `auth`, etc.) e botão "Repetir".

### 4. Após validar com 1 veículo, ajustar o sync de produção

- `supabase/functions/sga-sync-financeiro-veiculo/index.ts`: substituir `janela5Meses()` por chamada à nova versão de `listarBoletosVeiculo` que já itera internamente em janelas de 90 dias (não precisa mais montar janela manualmente). Manter cobertura de ~3 anos para histórico inicial.
- Idempotência por `nosso_numero` já existe (upsert), então re-rodar é seguro.

## Arquivos afetados

- `supabase/functions/_shared/hinova-client.ts` — janela 90d iterativa + `link_boleto` + filtro vencimento.
- `supabase/functions/sga-testar-boletos-veiculo/index.ts` — **novo** (read-only, sem grava nada).
- `supabase/functions/sga-sync-financeiro-veiculo/index.ts` — usa nova assinatura.
- `src/pages/configuracoes/IntegracaoHinovaMapeamentos.tsx` (ou página equivalente) — card de teste.

## Detalhes técnicos

- **Por que 90 dias é hard-cap:** documentação literal — *"O limite do intervalo de tempo é de, no máximo, 90 dias"*. A Hinova retorna 406 com payloads maiores; tem sido a causa de chamadas que devolvem 0 boletos para veículos que claramente têm cobranças.
- **Iteração:** loop `for` de hoje → N anos atrás, em passos de 90 dias, com `await` sequencial (não paralelo) para não estourar rate limit. Cada iteração soma ao set por `nosso_numero` (chave única já existente em `cobrancas`).
- **Sem novas tabelas/migrations.** O endpoint de teste apenas lê e loga em `sga_sync_logs` (já existe).
- **Sem novos secrets.** Reusa credenciais Hinova já configuradas via `getHinovaCreds`.
- **CORS padrão** + handler OPTIONS na nova função.

## Critério de sucesso

Você acessa o card de teste, escolhe uma placa qualquer (com `codigo_hinova` preenchido), clica em "Testar busca 90 dias" e a tela mostra:
1. Request enviado (com `data_vencimento_inicial`/`data_vencimento_final` válidos e `link_boleto: true`).
2. Resposta crua da Hinova (JSON inteiro).
3. Tabela com pelo menos 1 boleto recente, contendo `nosso_numero`, `linha_digitavel`, `valor_boleto`, `data_vencimento`, `situacao_boleto` e `link_boleto`.

Após esse OK manual, libero o ajuste para o sync em massa.
