

# Melhorias nos Detalhes do Rastreador (Estoque)

## Problemas Identificados

### 1. Numero de Serie e ID da Plataforma vazios
O rastreador `862667083494305` tem `numero_serie = null` e `id_plataforma = null` no banco de dados. Isso ocorre porque:
- O fluxo de ativacao Softruck (`useAtivarRastreador`) nao atualiza esses campos apos vincular o dispositivo na plataforma
- A Edge Function `softruck-ativar-dispositivo` retorna o `softruck_device_id`, mas ele nao e salvo no campo `id_plataforma` da tabela `rastreadores`

### 2. Historico incompleto e desatualizado
O historico exibido mostra apenas 1 registro da tabela `estoque_movimentacoes`, mas existem 4 servicos vinculados ao rastreador (instalacao, 2 manutencoes, retirada) que nao aparecem. O componente `DetalhesRastreadorDialog` consulta servicos apenas na secao de manutencao, nao consolida uma timeline unificada.

---

## Solucao

### Parte 1: Salvar `id_plataforma` na ativacao

**Arquivo: `src/hooks/useAtivarRastreador.ts`**

No retorno da integracao Softruck (apos sucesso), adicionar um UPDATE na tabela `rastreadores` para gravar o `id_plataforma` retornado pela Edge Function:

```sql
UPDATE rastreadores SET id_plataforma = softruck_device_id WHERE id = rastreador_id
```

O mesmo para Rede Veiculos, salvando o `rede_veiculos_veiculo_id` como `id_plataforma`.

### Parte 2: Permitir edicao de Numero de Serie e ID Plataforma

**Arquivo: `src/components/monitoramento/estoque/DetalhesRastreadorDialog.tsx`**

Na secao "Informacoes Tecnicas", tornar os campos "Numero de Serie" e "ID na Plataforma" editaveis inline (icone de lapis). Ao salvar, atualiza diretamente na tabela `rastreadores`.

### Parte 3: Timeline unificada do historico

**Arquivo: `src/components/monitoramento/estoque/DetalhesRastreadorDialog.tsx`**

Consolidar o historico em uma unica timeline cronologica mesclando:
- `estoque_movimentacoes` (movimentacoes de estoque)
- `servicos` vinculados ao rastreador (instalacao, manutencao, retirada) -- todos os tipos e status
- `rastreador_manutencao_interna` (triagem/bancada)

Cada item tera um icone e cor diferente por tipo, e serao ordenados por data decrescente.

### Parte 4: Auto-refresh do historico

Adicionar `refetchInterval: 30000` (30 segundos) nas queries de historico para manter os dados atualizados enquanto o dialog estiver aberto.

---

## Detalhes Tecnicos

### Campos editaveis (Parte 2)

Adicionar estados `editandoCampo` e `valorEditado` no componente. Ao clicar no icone de edicao:
- Campo se transforma em input
- Ao confirmar, executa `supabase.from('rastreadores').update({ [campo]: valor }).eq('id', rastreadorId)`
- Invalida query `rastreador-detalhes`

### Timeline unificada (Parte 3)

Nova query que busca servicos vinculados ao rastreador:

```typescript
const { data: historicoServicos } = useQuery({
  queryKey: ['rastreador-historico-servicos-completo', rastreadorId],
  queryFn: async () => {
    const { data } = await supabase
      .from('servicos')
      .select('id, tipo, status, protocolo, created_at, concluida_em, profissional:profiles!servicos_profissional_id_fkey(nome)')
      .eq('rastreador_id', rastreadorId)
      .order('created_at', { ascending: false });
    return data;
  },
});
```

Mesclar com `estoque_movimentacoes` e `rastreador_manutencao_interna` em um array unificado, ordenado por data.

### Mapeamento de tipos de servico para exibicao

```text
instalacao       -> "Instalacao" (icone Car, cor azul)
vistoria_manutencao -> "Manutencao de Campo" (icone Wrench, cor amarelo)
vistoria_retirada   -> "Retirada" (icone Package, cor vermelho)
```

### Arquivos afetados

1. `src/hooks/useAtivarRastreador.ts` -- salvar id_plataforma apos ativacao
2. `src/components/monitoramento/estoque/DetalhesRastreadorDialog.tsx` -- edicao inline + timeline unificada + auto-refresh
