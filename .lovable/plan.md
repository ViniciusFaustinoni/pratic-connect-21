

## Não desvincular rastreador do veículo durante manutenção / mudanças de status — só em cancelamento ou troca

### Diagnóstico

Hoje o rastreador perde o vínculo com o veículo (`veiculo_id = null`) em vários cenários onde ele **continua sendo o mesmo equipamento daquele veículo** — só temporariamente fora de operação. Isso quebra histórico, relatórios "rastreador X esteve no veículo Y" e a UI de detalhes do rastreador, além de exigir religação manual posterior.

Pontos de desvinculação encontrados:

| # | Arquivo | Linha | Cenário | Comportamento atual | Correto |
|---|---------|-------|---------|---------------------|---------|
| 1 | `src/hooks/useRastreadores.ts` | 423-425 | Troca de status manual (qualquer status ≠ `instalado`) via UI de estoque | `veiculo_id = null` sempre | Manter `veiculo_id` quando vai para `manutencao`, `reagendar_manutencao`, `retirada_pendente`. Limpar só quando vai para `estoque`, `baixado`, `retorno_base`, `triagem`, `em_analise_plataforma`, `em_garantia` (terminais ou pós-retirada). |
| 2 | `src/hooks/useVistoriaManutencao.ts` | 595-599 | Substituição em campo — atualização do **rastreador antigo** | `veiculo_id = null` ao mudar para `retorno_base`/`baixado` | **Manter** — neste fluxo houve troca real de equipamento (substituição é uma das exceções que o usuário citou). |
| 3 | `src/hooks/useSubstituirEquipamento.ts` | 127-131 | Substituição via UI de gestão | `veiculo_id = null` no antigo | **Manter** — também é troca de equipamento. |
| 4 | `supabase/functions/concluir-retirada/index.ts` | 169-180 | Conclusão de retirada (rastreador foi fisicamente removido do veículo) | `veiculo_id = null` | **Manter** — retirada física é o equivalente operacional ao cancelamento/troca. |
| 5 | `src/hooks/useDeleteBaseAntiga.ts` | 12-26 | Exclusão de base antiga | `veiculo_id = null` | **Manter** — equivale a cancelamento. |
| 6 | `src/hooks/useVenderVeiculo.ts` | 114-118 | Venda de veículo (sai da proteção) | `veiculo_id = null` | **Manter** — equivale a cancelamento daquele veículo. |
| 7 | `supabase/functions/delete-associado` / `delete-ativacao` | — | Exclusão completa | `veiculo_id = null` | **Manter** — cancelamento. |
| 8 | `supabase/functions/rede-veiculos-desvincular-cliente` | 87-91, 135-139, 249-253 | Desvinculação na plataforma externa | `veiculo_id = null` no banco local | Revisar — só limpar quando o status final pedido for terminal. Quando a desvinculação for por **manutenção temporária**, manter o vínculo local. |

A regra do usuário é clara: **manutenção (campo OU interna) ≠ desvinculação**. Só `estoque` (porque já voltou para o pool físico), `baixado` (descartado) e os fluxos explícitos de cancelamento/troca/retirada/venda devem zerar `veiculo_id`.

### O que vai mudar

**1. `src/hooks/useRastreadores.ts` (linhas 420-428)** — substituir a regra "qualquer ≠ instalado limpa" por whitelist explícita:

```ts
// Status que DESVINCULAM do veículo (rastreador deixa fisicamente o veículo
// ou é descartado). Os demais (manutencao, reagendar_manutencao,
// retirada_pendente) preservam veiculo_id para manter histórico.
const STATUS_DESVINCULA_VEICULO: StatusRastreador[] = [
  'estoque', 'baixado', 'retorno_base', 'triagem',
  'em_analise_plataforma', 'em_garantia',
];

const updateData: RastreadorUpdate = { status };
if (STATUS_DESVINCULA_VEICULO.includes(status)) {
  updateData.veiculo_id = null;
} else if (veiculo_id !== undefined) {
  updateData.veiculo_id = veiculo_id;
}
```

E ajustar o bloco anterior (linha 381) que **chama a desvinculação na plataforma externa** quando `status !== 'instalado'`: passar a chamar **só** quando `status ∈ STATUS_DESVINCULA_VEICULO` (manutenção temporária não deve desvincular na Rede Veículos/Softruck — o equipamento volta para o mesmo veículo).

**2. `supabase/functions/rede-veiculos-desvincular-cliente/index.ts`** — passa a aceitar parâmetro `manterVinculoLocal: boolean` (default `false` para retrocompatibilidade) e, quando `true`, faz o `update` na plataforma externa mas **não** zera `veiculo_id` no banco local. A `useUpdateRastreadorStatus` passa `manterVinculoLocal: !STATUS_DESVINCULA_VEICULO.includes(status)`.

**3. `src/hooks/useVistoriaManutencao.ts` linha 299-306** — já está correto: ao abrir manutenção, só muda `status` para `'manutencao'`, **não** mexe em `veiculo_id`. Confirmar que não há outro `update` no mesmo arquivo zerando o vínculo no fluxo de "abertura". (As linhas 595-599 são do fluxo de **substituição**, que mantemos zerando — é exceção legítima.)

**4. `src/components/monitoramento/estoque/ListaRastreadores.tsx`** — verificar e ajustar o tooltip/label das ações "Enviar para Manutenção" para deixar claro que o vínculo com o veículo é preservado. (Mudança apenas de copy.)

**5. Não mudam:**
- `useSubstituirEquipamento.ts`, `useVistoriaManutencao.ts` cenário B (substituição), `concluir-retirada`, `useVenderVeiculo`, `useDeleteBaseAntiga`, `delete-associado`, `delete-ativacao` — todos casos legítimos de desvinculação (troca, retirada física, venda, cancelamento).
- Tipos em `src/types/rastreadores.ts` e `TRANSICOES_STATUS_RASTREADOR` — sem alteração.

**6. Memória do projeto** — criar `mem://logic/operations/rastreador-vinculo-preservacao` documentando a regra: "Vínculo `rastreador.veiculo_id` só é zerado em (a) retirada física concluída, (b) substituição de equipamento, (c) cancelamento/exclusão do associado, (d) venda do veículo, (e) status terminal `estoque`/`baixado`/`retorno_base`/`triagem`/`em_garantia`/`em_analise_plataforma`. Manutenção em campo, reagendamento e retirada pendente preservam o vínculo."

### Arquivos editados

- `src/hooks/useRastreadores.ts` — whitelist de status que desvinculam + condicionar chamada à API externa.
- `supabase/functions/rede-veiculos-desvincular-cliente/index.ts` — novo parâmetro `manterVinculoLocal`.
- `src/components/monitoramento/estoque/ListaRastreadores.tsx` — copy das ações.
- `mem://logic/operations/rastreador-vinculo-preservacao.md` (novo) + atualização do `mem://index.md`.

### Riscos

- Rastreador em `manutencao` continuará aparecendo "vinculado" ao veículo na listagem do veículo — comportamento desejado (é o equipamento daquele veículo, só está em assistência). Filtros que mostram "rastreadores instalados" devem usar `status = 'instalado'`, não `veiculo_id IS NOT NULL`. Verificar `useVeiculos`/queries do mapa de monitoramento — se filtrarem por `veiculo_id`, mostrar `status` para distinguir.
- Plataforma externa (Rede Veículos/Softruck) pode ficar com a vinculação ativa durante manutenção — desejável, evita re-cadastro quando o rastreador volta ao mesmo veículo após o reparo.

