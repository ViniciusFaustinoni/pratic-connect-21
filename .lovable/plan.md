

# Corrigir Rastreador Não Aparecendo no Veículo Após Instalação

## Problema
Quando a instalação é concluída via `InstalacaoDetalhe.tsx` (tela do monitoramento), o hook `useInstalacoes.ts` → `concluirInstalacao` atualiza o rastreador para `status: 'instalado'` mas **não define `veiculo_id`** no rastreador. Sem `veiculo_id`, a query do `VeiculoDetalhesModal` (que busca `rastreadores WHERE veiculo_id = X`) não encontra nenhum rastreador.

O fluxo alternativo via `useAprovarVeiculoServico` (linha 978 de `useServicos.ts`) faz isso corretamente — o bug está apenas em `useInstalacoes.ts`.

## Solução

### `src/hooks/useInstalacoes.ts` — `concluirInstalacao` (linhas 560-596)

1. Adicionar `veiculo_id` como parâmetro opcional na mutation
2. Se não fornecido, buscar da própria instalação (`instalacoes.veiculo_id`)
3. Incluir `veiculo_id` no update do rastreador

```typescript
// Antes (linha 583-586):
.update({ status: 'instalado' })

// Depois:
// Buscar veiculo_id da instalação
const { data: instData } = await supabase
  .from('instalacoes')
  .select('veiculo_id')
  .eq('id', instalacao_id)
  .single();

.update({ 
  status: 'instalado', 
  veiculo_id: instData?.veiculo_id || null,
  portador_id: null,
  updated_at: new Date().toISOString(),
})
```

## Arquivo alterado
| Arquivo | Ação |
|---------|------|
| `src/hooks/useInstalacoes.ts` | Adicionar `veiculo_id` ao update do rastreador na conclusão |

