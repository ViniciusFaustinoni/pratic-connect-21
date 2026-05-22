## Por que MARCOS apareceu em Serviços de Campo antes do Cadastro aprovar

### Linha do tempo (KOU6D37, COT-20260522-105020696-877)

| Hora | Evento |
|---|---|
| 13:51 | Contrato gerado (`cadastro_aprovado=false`) |
| **14:28:18** | Cliente agenda Vistoria Base no link público → cria `agendamentos_base` (status `agendado`, hoje 13:00) |
| **14:31:07** | Cadastro aprova (`cadastro_aprovado=true`, `aprovado_em` preenchido) |

Entre 14:28 e 14:31 a proposta ficou simultaneamente na fila do **Cadastro** e na fila **Serviços de Campo › Atribuição Manual** — exatamente o que o canônico proíbe (Monitoramento só recebe pós-Cadastro).

### Causa raiz no código

`src/hooks/useAtribuicaoManual.ts` monta a fila a partir de **duas fontes**:

1. **`servicos`** (linhas 34–102) — filtra corretamente por `!!s.contrato?.aprovado_em` (ou `origem='troca_titularidade'`). ✅
2. **`agendamentos_base`** (linhas 104–154) — busca por `atendido_por IS NULL` + `status IN ('agendado','pendente')` + data ≥ hoje. **Sem nenhum gate de `contratos.cadastro_aprovado`.** ❌

Como o agendamento_base é materializado no momento em que o cliente marca data/hora no link público (`criar-instalacao-pos-pagamento`, mem `criar-instalacao-sem-cadastro-aprovado`), ele entra na fila do Monitoramento **na hora**, antes do Cadastro decidir. Foi o que aconteceu com MARCOS — e é um vazamento sistêmico, não um caso isolado.

### Plano de correção

**1. Gate de `cadastro_aprovado` no branch de `agendamentos_base`** (`src/hooks/useAtribuicaoManual.ts`, ~linhas 104–135)

Buscar os contratos vinculados (via `cotacao_id` → `contratos.cotacao_id`) e descartar os `agendamentos_base` cujo contrato ainda não tem `aprovado_em`:

```ts
// após buscar baseItems
const cotacaoIds = [...new Set(baseItems.map(b => b.cotacao_id).filter(Boolean))];
const { data: contratosBase } = await supabase
  .from('contratos')
  .select('cotacao_id, aprovado_em, origem_troca_titularidade_id')
  .in('cotacao_id', cotacaoIds);
const aprovadosPorCotacao = new Map(
  (contratosBase || []).map(c => [c.cotacao_id, !!c.aprovado_em || !!c.origem_troca_titularidade_id])
);

const baseSemDup = (baseItems || []).filter(b => {
  if (!aprovadosPorCotacao.get(b.cotacao_id)) return false;       // ⬅ novo gate
  if (b.instalacao_id && instalacoesNaFila.has(b.instalacao_id)) return false;
  if (b.vistoria_id   && vistoriasNaFila.has(b.vistoria_id))   return false;
  return true;
});
```

(Selecionar `cotacao_id` em `baseItems` também — está faltando no `.select` atual.)

**2. Mesmo gate em qualquer outra leitura "para o Monitoramento" que consuma `agendamentos_base` direto.** Auditoria rápida:
- `useServicosRota.ts`, `Rotas.tsx`, `VistoriasInstalacoesMon.tsx` — confirmar se algum lista pré-Cadastro.

**3. Saneamento pontual** — verificar no momento da correção quantos `agendamentos_base` ativos hoje pertencem a cotações ainda em `aguardando_aprovacao_cadastro` (mesmo padrão MARCOS). Não há mutação destrutiva: apenas filtro de leitura.

**4. Memória nova** — registrar `mem://logic/operations/atribuicao-manual-gate-cadastro-aprovado` para fixar a invariante: "Atribuição Manual nunca lista `agendamentos_base` cujo contrato não tem `aprovado_em` (exceto troca de titularidade)."

### Arquivos a editar

- `src/hooks/useAtribuicaoManual.ts` (correção principal)
- Possível ajuste em hooks consumidores de `agendamentos_base` (a confirmar na execução)
- Novo arquivo de memória

### Fora do escopo

- Não alterar `criar-instalacao-pos-pagamento` (manter materialização no agendamento; o gate fica na leitura).
- Sem migration de DB — fix é puramente no front/hook.
