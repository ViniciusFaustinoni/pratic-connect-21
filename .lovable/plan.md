
# Adicionar Limpeza de Posicoes Antigas na sync-rastreadores

## Objetivo

Apos cada sincronizacao, a edge function deve excluir registros da tabela `rastreador_posicoes` com mais de 7 dias, mantendo apenas uma janela rolante de dados recentes.

## Alteracao

### Arquivo: `supabase/functions/sync-rastreadores/index.ts`

Adicionar um passo de limpeza **apos** a insercao das posicoes (depois da linha 543), antes do calculo de totais:

```typescript
// Limpar posicoes com mais de 7 dias
const seteDiasAtras = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
const { count: deletados, error: errDelete } = await supabase
  .from("rastreador_posicoes")
  .delete({ count: 'exact' })
  .lt("data_posicao", seteDiasAtras);

if (errDelete) {
  console.error("[sync-rastreadores] Erro ao limpar posicoes antigas:", errDelete);
} else {
  console.log(`[sync-rastreadores] ${deletados || 0} posicoes antigas removidas (>7 dias)`);
}
```

Tambem incluir `posicoes_removidas` no JSON de resposta para monitoramento.

## Fluxo Final

1. Buscar rastreadores instalados
2. Consultar posicao atual em cada plataforma (Softruck / Rede Veiculos)
3. Inserir posicoes novas na tabela `rastreador_posicoes`
4. **Excluir registros com `data_posicao` anterior a 7 dias**
5. Retornar resultado com contagem de inseridos e removidos

## Impacto

- A limpeza roda em segundo plano junto com o cron, sem impactar o uso do sistema
- Mantém a tabela leve com no maximo ~1.008 registros por rastreador (7 dias x 144 syncs/dia)
- A politica de retencao anterior de 90 dias sera substituida por esta de 7 dias conforme solicitado

| Arquivo | Alteracao |
|---|---|
| `supabase/functions/sync-rastreadores/index.ts` | Adicionar DELETE de posicoes com mais de 7 dias apos insercao + incluir contagem no response |
