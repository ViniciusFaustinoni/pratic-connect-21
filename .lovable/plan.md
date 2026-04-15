

## Plano: Mostrar vistorias (especialmente de base) no Calendário de Monitoramento

### Problema
O calendário (`CalendarioInstalacoes.tsx`) busca **apenas instalações** via `useInstalacoes`. Vistorias agendadas na base (ou em campo) não aparecem — o calendário ignora completamente a tabela `vistorias`.

### Solução
Adicionar uma query de vistorias ao calendário, exibindo-as com badges diferenciados ao lado das instalações.

### Alterações

**Arquivo: `src/pages/monitoramento/CalendarioInstalacoes.tsx`**

1. **Renomear** o título para "Calendário de Serviços" (ou "Instalações e Vistorias") para refletir que agora mostra ambos.

2. **Adicionar query de vistorias** no mesmo período do mês:
```typescript
const { data: vistoriasRaw } = useQuery({
  queryKey: ['vistorias-calendario', mesKey],
  queryFn: async () => {
    const { data } = await supabase
      .from('vistorias')
      .select('id, status, data_agendada, local_vistoria, modalidade, associado:associados(nome), veiculo:veiculos(placa)')
      .gte('data_agendada', primeiroDiaStr)
      .lte('data_agendada', ultimoDiaStr)
      .in('status', ['pendente','agendada','em_rota','em_andamento','em_analise','aprovada'])
      .eq('tipo', 'entrada');
    return data || [];
  }
});
```

3. **Agrupar vistorias por data** no mesmo `useMemo`, separando por `local_vistoria` (base vs cliente/campo).

4. **Renderizar badges de vistoria** com cor diferente (ex: roxo/indigo para base, teal para campo), mostrando o label "Base" ou "Campo" e a placa do veículo.

5. **Atualizar legenda** para incluir ícone de vistoria base e campo.

6. **Badge contador por dia**: quando há vistorias base no dia, mostrar um badge "🏢 N vistorias" no canto da célula do calendário.

### Resultado
- Vistorias agendadas na base aparecem no calendário com badge visual distinto
- Coordenador pode ver de relance quantas vistorias presenciais na base estão marcadas por dia
- Ao clicar no dia, pode navegar para a fila de vistorias filtrada por data

