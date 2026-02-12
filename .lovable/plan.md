
# Corrigir atribuicao automatica de tarefas - Multiplos problemas

## Problemas identificados

### Problema 1: Edge Function `atribuir-proxima-tarefa` retorna 500 (PGRST201)
A versao **deployada** ainda contem o erro de relacionamento ambiguo com `veiculos`. Os logs mostram claramente:
```
Could not embed because more than one relationship was found for 'servicos' and 'veiculos'
```
A correcao anterior (FK hint `!servicos_veiculo_id_fkey`) foi aplicada em duas queries, mas a funcao precisa ser re-deployada.

### Problema 2: `cron-atribuir-tarefas` tem o MESMO bug
Nas linhas 204 e 239, usa `veiculo:veiculos(placa)` sem o hint de FK. Tambem precisa de `!servicos_veiculo_id_fkey` e `!servicos_associado_id_fkey`.

### Problema 3: Nenhum registro em `servicos` para a cotacao do MARCOS VINICIUS
A cotacao `dc131311...` tem:
- `status = 'aceita'`, `status_contratacao = 'pagamento_ok'`
- `tipo_vistoria = 'autovistoria'`
- `vistoria_permite_encaixe = true`
- `vistoria_data_agendada = NULL` (autovistoria nao preenche este campo)
- `vistoria_completa_data_agendada = NULL`

O fluxo `criar-instalacao-pos-pagamento` tenta usar `vistoria_completa_data_agendada` para autovistoria, mas esta NULL, entao retorna erro "Dados de agendamento nao encontrados" e nao cria nenhuma instalacao. Sem instalacao, o trigger `sync_instalacao_to_servicos` nao dispara e nenhum registro e criado na tabela `servicos`.

### Problema 4: Enum `status_instalacao` nao tem valor `pendente`
Os logs do Postgres mostram:
```
invalid input value for enum status_instalacao: "pendente"
```
O enum `status_instalacao` so aceita: `agendada`, `em_rota`, `em_andamento`, `concluida`, `reagendada`, `cancelada`. O debug da edge function tenta buscar instalacoes com `status IN ('agendada', 'pendente')`, mas `pendente` nao existe nesse enum.

## Plano de correcao

### 1. Corrigir `atribuir-proxima-tarefa` - query de debug com enum invalido
Na secao de debug (linhas 528-542), a query usa `.in('status', ['agendada', 'pendente'])` na tabela `instalacoes`. Remover `'pendente'` e usar apenas `'agendada'`.

### 2. Corrigir `cron-atribuir-tarefas` - FK hints faltantes
Nas linhas 203-204 e 238-239, adicionar hints de FK:
```
associado:associados!servicos_associado_id_fkey(nome)
veiculo:veiculos!servicos_veiculo_id_fkey(placa)
```

### 3. Corrigir `criar-instalacao-pos-pagamento` - autovistoria sem data
Para cotacoes com `tipo_vistoria = 'autovistoria'` onde `vistoria_completa_data_agendada` e NULL, usar os campos `vistoria_*` como fallback (a cotacao tem `vistoria_endereco_latitude/longitude` preenchidos e `vistoria_permite_encaixe = true`).

Logica corrigida:
```
if (tipoVistoria === 'autovistoria') {
  // Tentar vistoria_completa_* primeiro
  dataAgendada = cotacao.vistoria_completa_data_agendada;
  // FALLBACK: Se nao tiver data completa, usar vistoria_* simples
  if (!dataAgendada) {
    dataAgendada = cotacao.vistoria_data_agendada;
    // usar campos vistoria_* para endereco tambem
  }
}
```

### 4. Re-deployar ambas edge functions

## Arquivos a modificar

| Arquivo | Acao |
|---|---|
| `supabase/functions/atribuir-proxima-tarefa/index.ts` | Corrigir query de debug (remover 'pendente' do enum) |
| `supabase/functions/cron-atribuir-tarefas/index.ts` | Adicionar FK hints nas 2 queries (associados e veiculos) |
| `supabase/functions/criar-instalacao-pos-pagamento/index.ts` | Adicionar fallback para autovistoria sem dados completos |

## Validacao pos-correcao

1. Re-deployar as 3 edge functions
2. Chamar `criar-instalacao-pos-pagamento` com `cotacaoId = 'dc131311-234a-4f8a-b433-233a116e38d3'` para criar a instalacao pendente
3. Verificar que o trigger cria o registro em `servicos`
4. Logar como vistoriador e confirmar que a atribuicao funciona sem erro 500
