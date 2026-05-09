## Problema

No card "Veículos em Análise" (/cadastro/veiculos) o veículo da troca de titularidade aparece com **Valor FIPE: N/A**.

A causa: `criar-solicitacao-troca-titularidade` apenas **copia** `valor_fipe` / `codigo_fipe` do registro original em `veiculos` (linhas 65, 154-155). Se o veículo antigo nunca teve FIPE preenchida (cadastro antigo, importação, etc.), a troca herda o vazio — diferente da cotação normal, que **sempre** consulta a FIPE atualizada via `fipe-lookup` (hook `useFipe.getByPlaca` + busca por marca/modelo/ano).

## Decisão de "momento correto"

A FIPE precisa estar disponível em três pontos:

1. **Card do veículo em análise** (tela atual da screenshot)
2. **Cotação do novo titular** (cálculo de mensalidade e regra do rastreador)
3. **Snapshot do contrato** ao efetivar

Todos esses pontos lêem de `veiculos.valor_fipe` ou da cópia em `cotacoes.valor_fipe`. Logo, o **único momento que resolve os três** é a **criação da solicitação** (edge `criar-solicitacao-troca-titularidade`), antes de inserir a cotação. É também o momento em que a equipe de Cadastro abre o registro pela primeira vez — então o valor já chega calculado.

## Mudanças

### 1. `supabase/functions/criar-solicitacao-troca-titularidade/index.ts`

Logo após carregar `veiculo` e antes do `insert` em `cotacoes`:

- Se `veiculo.valor_fipe` ausente/zero **ou** `veiculo.codigo_fipe` ausente, chamar a edge `fipe-lookup` (mesmo backend usado pela cotação):
  - Tentativa 1: `action=buscar-por-nome` com `marca` + `modelo` + `ano`. Tipo é deduzido da categoria (`carros` para automóvel, `motos` para moto) — usar `marcas_modelos.tipo_veiculo` se houver, senão default `carros`.
  - Tentativa 2 (fallback se a primeira falhar): consulta por placa (a edge `fipe-lookup` já tem essa rota interna usada pelo `useFipe.getByPlaca`).
- Se obtiver resultado:
  - **Atualiza `veiculos`** (`valor_fipe`, `codigo_fipe`, e `marca`/`modelo`/`ano` se vierem normalizados) — assim o card de Cadastro › Veículos passa a mostrar a FIPE.
  - Usa o valor encontrado nas chaves `valor_fipe` / `codigo_fipe` do insert em `cotacoes`.
- Se a consulta falhar (timeout, sem retorno), segue o fluxo atual (insere com `null`) e loga aviso — não bloqueia a criação da troca.
- Toda a chamada é envelopada em `try/catch` e usa `Promise.race` com timeout de ~6s para não atrasar a resposta da edge.

### 2. UI — sem alteração obrigatória

Como o card e o modal já leem `valor_fipe` da tabela `veiculos`, nenhum componente precisa mudar. O card que hoje exibe "N/A" passará a exibir o valor automaticamente.

(Opcional — não incluído no escopo deste plano: botão manual "Recalcular FIPE" no `ModalDetalhesTroca` para casos em que o valor precisa ser refrescado depois.)

### Detalhes técnicos

- Reuso de infraestrutura: a edge `fipe-lookup` já existe (`supabase/functions/fipe-lookup/index.ts`) e é usada pela `Cotador.tsx`, `EtapaConsultaFipe.tsx`, `StepNovoVeiculo.tsx` (fluxo de substituição de veículo). Mesmo padrão.
- Chamada server-to-server via `fetch` direto para `${SUPABASE_URL}/functions/v1/fipe-lookup?...` (a função `fipe-lookup` é pública/`verify_jwt=false`, conforme uso no front).
- Categoria: ler `marcas_modelos.tipo_veiculo` pelo `veiculo.marca`+`veiculo.modelo`; default `carros`.
- Não tocar em `efetivar-troca-titularidade` — ele já lê `valor_fipe` de `veiculos` no momento da efetivação, então herdará o valor atualizado.

### Fora de escopo

- Não cria UI de "recalcular FIPE manualmente" (posso adicionar em seguida se quiser).
- Não altera o fluxo de cotação normal nem de substituição (já fazem o lookup).
