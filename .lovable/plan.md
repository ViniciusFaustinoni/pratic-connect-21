
# Plano: Melhorar Rastreadores "Em Manutenção" e Histórico Completo

## Resumo do Problema

Após análise do código atual, identificamos as seguintes lacunas:

1. **Histórico incompleto no dialog de detalhes**: O `DetalhesRastreadorDialog` só mostra movimentações de `estoque_movimentacoes`, mas falta:
   - Histórico de manutenções de campo (tabela `servicos`)
   - Histórico de manutenções internas (tabela `rastreador_manutencao_interna`)

2. **Tipos de movimentação faltantes**: O mapeamento `tipoMovimentacaoLabels` não inclui todos os tipos usados nos hooks:
   - `retorno_base`
   - `baixa_substituicao`
   - `instalacao_substituicao`
   - `baixa_manutencao`

3. **Rastreador em manutenção não mostra serviço vinculado**: Quando um rastreador está com status `manutencao`, o dialog não mostra qual serviço está associado (protocolo, data agendada, técnico)

4. **Falta histórico de manutenção interna**: Quando um rastreador passou pela bancada (triagem, plataforma, garantia), isso não aparece no histórico

---

## Alterações Propostas

### 1. Expandir `tipoMovimentacaoLabels` no Dialog

**Arquivo:** `src/components/monitoramento/estoque/DetalhesRastreadorDialog.tsx`

Adicionar os tipos que faltam:

```typescript
const tipoMovimentacaoLabels: Record<string, string> = {
  entrada_estoque: 'Entrada no Estoque',
  saida_instalacao: 'Saída para Instalação',
  retorno_estoque: 'Retorno ao Estoque',
  envio_manutencao: 'Envio para Manutenção',
  baixa: 'Baixa',
  transferencia: 'Transferência',
  alteracao_status: 'Alteração de Status',
  atribuicao_portador: 'Atribuição de Portador',
  remocao_portador: 'Remoção de Portador',
  troca_portador: 'Troca de Portador',
  // NOVOS
  retorno_base: 'Retorno à Base (Triagem)',
  baixa_substituicao: 'Baixa por Substituição',
  instalacao_substituicao: 'Instalação (Substituição)',
  baixa_manutencao: 'Baixa por Manutenção',
};
```

### 2. Adicionar Query de Serviço Ativo (se em manutenção)

**Arquivo:** `src/components/monitoramento/estoque/DetalhesRastreadorDialog.tsx`

Buscar o serviço de manutenção vinculado quando status = `manutencao`:

```typescript
// Query para buscar serviço de manutenção ativo
const { data: servicoManutencao } = useQuery({
  queryKey: ['rastreador-servico-manutencao', rastreadorId],
  queryFn: async () => {
    const { data } = await supabase
      .from('servicos')
      .select(`
        id,
        protocolo,
        status,
        data_agendada,
        periodo,
        motivo_manutencao,
        observacoes,
        profissional:profiles!servicos_profissional_id_fkey(nome)
      `)
      .eq('rastreador_id', rastreadorId!)
      .eq('tipo', 'vistoria_manutencao')
      .not('status', 'in', '("concluida","cancelada","aprovada")')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return data;
  },
  enabled: !!rastreadorId && open && rastreador?.status === 'manutencao',
});
```

### 3. Adicionar Query de Manutenção Interna (se em triagem/plataforma/garantia)

```typescript
// Query para buscar manutenção interna ativa
const { data: manutencaoInterna } = useQuery({
  queryKey: ['rastreador-manutencao-interna', rastreadorId],
  queryFn: async () => {
    const { data } = await supabase
      .from('rastreador_manutencao_interna')
      .select(`
        id,
        etapa,
        diagnostico_inicial,
        defeito_identificado,
        encaminhado_para,
        numero_protocolo_externo,
        laudo_externo,
        created_at,
        servico_origem:servicos!rastreador_manutencao_interna_servico_origem_id_fkey(protocolo)
      `)
      .eq('rastreador_id', rastreadorId!)
      .not('etapa', 'in', '("concluido_estoque","descartado")')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return data;
  },
  enabled: !!rastreadorId && open && ['retorno_base', 'triagem', 'em_analise_plataforma', 'em_garantia'].includes(rastreador?.status || ''),
});
```

### 4. Adicionar Query de Histórico de Manutenções Internas Concluídas

```typescript
// Query para buscar histórico de manutenções internas
const { data: historicoManutencaoInterna } = useQuery({
  queryKey: ['rastreador-historico-manutencao-interna', rastreadorId],
  queryFn: async () => {
    const { data } = await supabase
      .from('rastreador_manutencao_interna')
      .select(`
        id,
        etapa,
        acao_tomada,
        laudo_externo,
        encaminhado_para,
        created_at,
        resolvido_em,
        resolvido_por_profile:profiles!rastreador_manutencao_interna_resolvido_por_fkey(nome)
      `)
      .eq('rastreador_id', rastreadorId!)
      .order('created_at', { ascending: false })
      .limit(5);
    return data;
  },
  enabled: !!rastreadorId && open,
});
```

### 5. Adicionar Query de Histórico de Serviços de Manutenção

```typescript
// Query para buscar histórico de serviços de manutenção
const { data: historicoServicosManutencao } = useQuery({
  queryKey: ['rastreador-historico-servicos', rastreadorId],
  queryFn: async () => {
    const { data } = await supabase
      .from('servicos')
      .select(`
        id,
        protocolo,
        status,
        resultado_manutencao,
        concluida_em,
        observacoes_analise,
        profissional:profiles!servicos_profissional_id_fkey(nome)
      `)
      .eq('rastreador_id', rastreadorId!)
      .eq('tipo', 'vistoria_manutencao')
      .in('status', ['concluida', 'aprovada', 'cancelada'] as any)
      .order('created_at', { ascending: false })
      .limit(5);
    return data;
  },
  enabled: !!rastreadorId && open,
});
```

### 6. Adicionar Seção de "Manutenção Ativa" no Dialog

Se o rastreador está em manutenção (campo ou interna), mostrar card destacado:

```tsx
{/* Manutenção de Campo Ativa */}
{rastreador?.status === 'manutencao' && servicoManutencao && (
  <div className="space-y-3">
    <h3 className="font-semibold text-sm text-orange-600 uppercase tracking-wide flex items-center gap-2">
      <Wrench className="h-4 w-4" />
      Manutenção em Andamento
    </h3>
    <div className="rounded-lg border-2 border-orange-200 bg-orange-50 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium">{servicoManutencao.protocolo}</span>
        <Badge variant="outline">{servicoManutencao.status}</Badge>
      </div>
      <div className="text-sm text-muted-foreground space-y-1">
        <p>Motivo: {servicoManutencao.motivo_manutencao}</p>
        {servicoManutencao.data_agendada && (
          <p>Agendado: {format(new Date(servicoManutencao.data_agendada), 'dd/MM/yyyy')} - {servicoManutencao.periodo}</p>
        )}
        {servicoManutencao.profissional?.nome && (
          <p>Técnico: {servicoManutencao.profissional.nome}</p>
        )}
      </div>
    </div>
  </div>
)}

{/* Manutenção Interna Ativa */}
{['retorno_base', 'triagem', 'em_analise_plataforma', 'em_garantia'].includes(rastreador?.status || '') && manutencaoInterna && (
  <div className="space-y-3">
    <h3 className="font-semibold text-sm text-purple-600 uppercase tracking-wide flex items-center gap-2">
      <Settings className="h-4 w-4" />
      Manutenção Interna (Bancada)
    </h3>
    <div className="rounded-lg border-2 border-purple-200 bg-purple-50 p-4">
      <Badge className={ETAPA_MANUTENCAO_INTERNA_COLORS[manutencaoInterna.etapa]}>
        {ETAPA_MANUTENCAO_INTERNA_LABELS[manutencaoInterna.etapa]}
      </Badge>
      <div className="text-sm text-muted-foreground space-y-1 mt-2">
        {manutencaoInterna.diagnostico_inicial && <p>Diagnóstico: {manutencaoInterna.diagnostico_inicial}</p>}
        {manutencaoInterna.encaminhado_para && <p>Encaminhado para: {manutencaoInterna.encaminhado_para}</p>}
        {manutencaoInterna.numero_protocolo_externo && <p>Protocolo Externo: {manutencaoInterna.numero_protocolo_externo}</p>}
      </div>
    </div>
  </div>
)}
```

### 7. Adicionar Seções de Histórico Completo

Após o histórico de movimentações, adicionar:

```tsx
{/* Histórico de Manutenções de Campo */}
{historicoServicosManutencao && historicoServicosManutencao.length > 0 && (
  <div className="space-y-3">
    <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-2">
      <Wrench className="h-4 w-4" />
      Histórico de Manutenções (Campo)
    </h3>
    <div className="space-y-2">
      {historicoServicosManutencao.map((s) => (
        <div key={s.id} className="rounded-lg border p-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="font-medium">{s.protocolo}</span>
            <Badge variant="outline" className={...}>{s.resultado_manutencao || s.status}</Badge>
          </div>
          {s.observacoes_analise && <p className="text-xs text-muted-foreground mt-1">{s.observacoes_analise}</p>}
          <div className="text-xs text-muted-foreground mt-1">
            {s.concluida_em && format(new Date(s.concluida_em), "dd/MM/yyyy")}
            {s.profissional?.nome && ` • ${s.profissional.nome}`}
          </div>
        </div>
      ))}
    </div>
  </div>
)}

{/* Histórico de Manutenções Internas */}
{historicoManutencaoInterna && historicoManutencaoInterna.length > 0 && (
  <div className="space-y-3">
    <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-2">
      <Settings className="h-4 w-4" />
      Histórico de Manutenções (Bancada)
    </h3>
    <div className="space-y-2">
      {historicoManutencaoInterna.map((m) => (
        <div key={m.id} className="rounded-lg border p-3 text-sm">
          <div className="flex items-center justify-between">
            <Badge variant="outline">{ETAPA_LABELS[m.etapa]}</Badge>
            <span className="text-xs text-muted-foreground">
              {format(new Date(m.created_at), "dd/MM/yyyy")}
            </span>
          </div>
          {m.acao_tomada && <p className="text-xs mt-1">{m.acao_tomada}</p>}
          {m.encaminhado_para && <p className="text-xs text-muted-foreground">Encaminhado: {m.encaminhado_para}</p>}
          {m.resolvido_por_profile?.nome && <p className="text-xs text-muted-foreground">Por: {m.resolvido_por_profile.nome}</p>}
        </div>
      ))}
    </div>
  </div>
)}
```

---

## Estrutura Final do Dialog de Detalhes

```
┌────────────────────────────────────────────────────────────┐
│  Detalhes do Rastreador                               [X]  │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ┌─ Header Card ─────────────────────────────────────────┐ │
│  │ RAT-123 [Em Manutenção] [Softruck] Portador: Técnico │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                            │
│  ┌─ MANUTENÇÃO ATIVA (se status = manutencao) ───────────┐ │
│  │ MAN-001 • Agendado 08/02 Manhã • Técnico João         │ │
│  │ Motivo: sem_sinal                                      │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                            │
│  ┌─ MANUTENÇÃO INTERNA (se status = triagem/etc) ────────┐ │
│  │ [Em Triagem] • Diagnóstico: GPS com defeito           │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                            │
│  ──── Informações Técnicas ────                           │
│  IMEI: 86266... │ S/N: ABC123 │ Plataforma: Softruck      │
│                                                            │
│  ──── Veículo Vinculado (se instalado) ────               │
│  ABC-1234 • Fiat Strada • João Silva                      │
│                                                            │
│  ──── Datas ────                                          │
│  Entrada: 01/01/2026 │ Última Comunicação: 07/02/2026     │
│                                                            │
│  ═══════════════════════════════════════════════════════  │
│                                                            │
│  ──── Histórico de Movimentações (últimas 10) ────        │
│  • Alteração de Status: manutencao → instalado            │
│    07/02/2026 14:00 • Admin                               │
│  • Saída para Instalação                                  │
│    01/02/2026 10:00 • NF: 12345                           │
│                                                            │
│  ──── Histórico de Manutenções Campo (últimas 5) ────     │
│  • MAN-001 [Resolvido] • 05/02/2026 • Técnico João        │
│    "Refiz fiação do positivo"                             │
│                                                            │
│  ──── Histórico de Manutenções Bancada (últimas 5) ────   │
│  • [Devolvido ao Estoque] • 03/02/2026                    │
│    Ação: Conserto na bancada                              │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/monitoramento/estoque/DetalhesRastreadorDialog.tsx` | Adicionar queries e seções de histórico completo |

---

## Resultado Esperado

1. Dialog de detalhes mostra **tudo** que aconteceu com o rastreador
2. Se está em manutenção de campo, mostra o serviço ativo com data/técnico
3. Se está em triagem/plataforma/garantia, mostra a etapa atual e protocolo externo
4. Histórico completo de movimentações, serviços de campo e manutenções internas
5. Labels corretos para todos os tipos de movimentação
