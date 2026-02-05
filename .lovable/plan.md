
## Problema: Tela do Cliente Não Atualiza ao Concluir Vistoria

### Diagnóstico

Quando o vistoriador conclui uma vistoria presencial, o cliente deveria ver a mensagem **"VISTORIA CONCLUÍDA, AGUARDANDO ANÁLISE CADASTRAL"**, mas a tela permanece mostrando "Vistoria Agendada com Sucesso!".

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ FLUXO ATUAL (COM PROBLEMA)                                                  │
├────────────────────────────────────────────────────────────────────────────┤
│ Vistoriador conclui vistoria                                               │
│         ↓                                                                  │
│ Tabelas atualizadas: vistorias, servicos, associados (→ em_analise)        │
│         ↓                                                                  │
│ Cliente NÃO recebe evento Realtime ❌                                      │
│         ↓                                                                  │
│ Tela continua mostrando "Vistoria Agendada com Sucesso!"                   │
│         ↓                                                                  │
│ Atualização só ocorre após 30 segundos (refetchInterval) ou refresh manual │
└────────────────────────────────────────────────────────────────────────────┘
```

**Causa raiz:** O hook `useCotacaoContratacao.ts` não possui subscriptions Realtime para:
1. Tabela `cotacoes` (onde `vistoria_concluida_em` é atualizado)
2. Tabela `vistorias` (onde o status da vistoria muda para `aprovada`/`concluida`)
3. Tabela `servicos` (alternativa - onde o status do serviço muda)

### Solução Proposta

Adicionar subscriptions Realtime para detectar quando:
1. A tabela `cotacoes` é atualizada (campo `vistoria_concluida_em`)
2. A tabela `vistorias` é atualizada (status muda para `concluida`/`aprovada`)
3. Redirecionar imediatamente para `/acompanhar/:token` quando detectar conclusão

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ FLUXO CORRIGIDO                                                            │
├────────────────────────────────────────────────────────────────────────────┤
│ Vistoriador conclui vistoria                                               │
│         ↓                                                                  │
│ UPDATE em cotacoes.vistoria_concluida_em + associados.status = em_analise  │
│         ↓                                                                  │
│ Realtime dispara evento para cotacoes/vistorias  ✅                        │
│         ↓                                                                  │
│ Hook refetch() → associadoStatus = 'em_analise'                            │
│         ↓                                                                  │
│ useEffect detecta → Navigate para /acompanhar/:token                       │
│         ↓                                                                  │
│ Cliente vê "Proposta em Análise" (ou nova mensagem customizada)            │
└────────────────────────────────────────────────────────────────────────────┘
```

### Implementação

#### 1. Atualizar `useCotacaoContratacao.ts`

Adicionar subscriptions Realtime para as tabelas `cotacoes` e `vistorias`:

```typescript
// Após a subscription existente de documentos_solicitados e associados
// Adicionar subscription para cotacoes e vistorias

.on(
  'postgres_changes',
  {
    event: 'UPDATE',
    schema: 'public',
    table: 'cotacoes',
    filter: `token_publico=eq.${token}`,
  },
  (payload) => {
    console.log('[CotacaoContratacao] Realtime: cotacao atualizada:', payload);
    refetch();
    queryClient.invalidateQueries({ queryKey: ['contrato-publico-fallback', token] });
  }
)
```

E também para vistorias (usando cotacao_id):

```typescript
.on(
  'postgres_changes',
  {
    event: 'UPDATE',
    schema: 'public',
    table: 'vistorias',
    filter: `cotacao_id=eq.${cotacaoId}`,
  },
  (payload) => {
    console.log('[CotacaoContratacao] Realtime: vistoria atualizada:', payload);
    refetch();
    queryClient.invalidateQueries({ queryKey: ['vistoria-existente', cotacaoId] });
  }
)
```

#### 2. Adicionar Estado Intermediário na UI

Criar um estado visual para "Vistoria Concluída, Aguardando Análise" antes do redirecionamento em `CotacaoContratacao.tsx`:

| Condição | Exibição |
|----------|----------|
| `cotacao.vistoria_concluida_em` preenchido E `associadoStatus !== 'em_analise'` | Card: "VISTORIA CONCLUÍDA, AGUARDANDO ANÁLISE CADASTRAL" |
| `associadoStatus === 'em_analise'` | Redireciona para `/acompanhar/:token` |

#### 3. Estrutura do Novo Card Visual

```typescript
// Novo estado visual antes do redirecionamento
{cotacao?.vistoria_concluida_em && (
  <Card className="border-emerald-500/30">
    <CardContent className="py-12 text-center space-y-6">
      <CheckCircle2 className="h-16 w-16 text-emerald-500 mx-auto" />
      <Badge className="bg-emerald-500/20 text-emerald-400">
        Vistoria Concluída
      </Badge>
      <h2 className="text-2xl font-bold">
        VISTORIA CONCLUÍDA
      </h2>
      <p className="text-muted-foreground">
        Aguardando análise cadastral. Em breve você receberá a confirmação.
      </p>
      <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
    </CardContent>
  </Card>
)}
```

### Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/hooks/useCotacaoContratacao.ts` | Adicionar subscriptions Realtime para `cotacoes` e `vistorias` |
| `src/pages/public/CotacaoContratacao.tsx` | Adicionar estado visual para "Vistoria Concluída, Aguardando Análise" |

### Fluxo Visual Atualizado

```text
┌──────────────────────────────────────────────────────────────────────────┐
│                      TELA DO CLIENTE - ETAPA VISTORIA                    │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Estado 1: Vistoria Agendada                                             │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  📅 Vistoria Agendada com Sucesso!                                 │ │
│  │  Data: sexta-feira, 06 de fevereiro de 2026                        │ │
│  │  Horário: 08:00                                                    │ │
│  │  Local: Rua Iriquitia, 260                                         │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                              ↓ (Realtime detecta conclusão)              │
│                                                                          │
│  Estado 2: Vistoria Concluída  ← NOVO                                    │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  ✅ VISTORIA CONCLUÍDA                                             │ │
│  │                                                                    │ │
│  │  Aguardando análise cadastral.                                     │ │
│  │  Em breve você receberá a confirmação.                             │ │
│  │                                                                    │ │
│  │  ⏳ (animação de loading)                                          │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                              ↓ (associado.status = em_analise)           │
│                                                                          │
│  Estado 3: Redirecionamento → /acompanhar/:token                         │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  🕐 Proposta em Análise                                            │ │
│  │                                                                    │ │
│  │  Seus documentos, contrato e imagens da vistoria estão sendo       │ │
│  │  analisados pelo setor de cadastro.                                │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### Detalhes Técnicos

**Subscriptions Realtime necessárias:**

1. **cotacoes** (por `token_publico`)
   - Detecta atualização de `vistoria_concluida_em`
   - Detecta atualização de `status_contratacao`

2. **vistorias** (por `cotacao_id`)
   - Detecta mudança de status para `concluida`/`aprovada`
   - Fallback caso a atualização de cotacoes não seja suficiente

3. **Manter subscriptions existentes:**
   - `documentos_solicitados` (por `associado_id`)
   - `associados` (por `id`)

**Polling como fallback:**
- Manter `refetchInterval: 30000` nas queries como backup
- Seguir o padrão Realtime + Polling conforme documentação do Lovable Stack Overflow
