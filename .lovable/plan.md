
# Plano: Exibir Solicitações Pendentes da IA no Painel de Sinistros

## Diagnostico do Problema

### Fluxo Atual do Sistema

```text
┌─────────────────────────────────────────────────────────────────────┐
│  ASSOCIADO - WhatsApp/App                                           │
│  "Quero registrar uma colisao"                                      │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  IA COLETA INFORMACOES                                              │
│  - Tipo do sinistro (colisao)                                       │
│  - Data/hora da ocorrencia                                          │
│  - Local do evento                                                  │
│  - Descricao                                                        │
│  - Fotos do dano                                                    │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  TABELA: chat_solicitacoes_ia                                       │
│  Status: "pendente"                                                 │
│  ID: 002bc5c6-bf33-4f9e-b8d9-a139abd426c7                          │
└─────────────────────────────────────────────────────────────────────┘
                              │
               ┌──────────────┴──────────────┐
               │                             │
               ▼                             ▼
┌─────────────────────────┐    ┌─────────────────────────────────────┐
│  DIRETOR APROVA         │    │  PAINEL SINISTROS                   │
│  /diretoria/            │    │  /eventos/sinistros                 │
│  solicitacoes-ia        │    │                                     │
│                         │    │  Busca APENAS tabela "sinistros"    │
│  Executa edge function  │    │  que esta VAZIA!                    │
│  "aprovar-solicitacao"  │    │                                     │
└─────────────────────────┘    │  ❌ "Nenhum sinistro encontrado"    │
               │               └─────────────────────────────────────┘
               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  TABELA: sinistros                                                  │
│  Registro REAL criado                                               │
│  Status: "comunicado"                                               │
│  Protocolo: "SIN-20260203-XXXX"                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Problema Identificado

O painel de Sinistros (`SinistrosList.tsx` e `SinistrosDashboard.tsx`) busca dados APENAS da tabela `sinistros`. Porem, as solicitacoes criadas via IA ficam na tabela `chat_solicitacoes_ia` com status "pendente" ate que um diretor as aprove na tela `/diretoria/solicitacoes-ia`.

| Tabela | Dados Atuais |
|--------|--------------|
| `sinistros` | 0 registros |
| `chat_solicitacoes_ia` | 1 registro pendente (colisao do Marcus) |

---

## Solucao Proposta

### Opcao A: Adicionar Indicador de Pendencias no Painel (RECOMENDADO)

Modificar o painel de Sinistros para exibir um card de alerta quando existirem solicitacoes pendentes de aprovacao.

**Beneficios:**
- Mantem a separacao de responsabilidades (aprovacao vs gestao)
- Diretor e informado das pendencias diretamente no painel
- Nao altera o fluxo de aprovacao existente

**Implementacao:**

1. **Adicionar query para buscar pendencias IA em `SinistrosList.tsx`**

```typescript
// Nova query para buscar solicitacoes pendentes da IA
const { data: pendenciasIA } = useQuery({
  queryKey: ['sinistros-pendencias-ia'],
  queryFn: async () => {
    const { data, count } = await supabase
      .from('chat_solicitacoes_ia')
      .select('id, tipo, dados, created_at, associado:associados(nome)', { count: 'exact' })
      .eq('status', 'pendente')
      .eq('tipo', 'sinistro')
      .order('created_at', { ascending: false });
    return { items: data, count };
  },
});
```

2. **Adicionar card de alerta no topo da lista**

```typescript
{pendenciasIA?.count > 0 && (
  <Card className="border-l-4 border-l-amber-500 bg-amber-50 dark:bg-amber-950/20">
    <CardContent className="flex items-center justify-between py-4">
      <div className="flex items-center gap-3">
        <Bot className="h-8 w-8 text-amber-600" />
        <div>
          <p className="font-semibold text-amber-800 dark:text-amber-200">
            {pendenciasIA.count} sinistro(s) aguardando aprovacao da IA
          </p>
          <p className="text-sm text-amber-600 dark:text-amber-400">
            Solicitacoes geradas via WhatsApp/App precisam ser revisadas
          </p>
        </div>
      </div>
      <Button onClick={() => navigate('/diretoria/solicitacoes-ia')}>
        Revisar Solicitacoes
      </Button>
    </CardContent>
  </Card>
)}
```

3. **Atualizar contador de "Comunicados" para incluir pendencias IA**

```typescript
// No card de KPI "Comunicados":
<p className="text-2xl font-bold text-yellow-600">
  {(contadores?.comunicado || 0) + (pendenciasIA?.count || 0)}
</p>
```

---

## Arquivos a Modificar

| Arquivo | Acao | Descricao |
|---------|------|-----------|
| `src/pages/eventos/SinistrosList.tsx` | Editar | Adicionar query para pendencias IA e card de alerta |
| `src/pages/eventos/SinistrosDashboard.tsx` | Editar | Adicionar indicador de pendencias no dashboard |

---

## Fluxo Corrigido

```text
┌─────────────────────────────────────────────────────────────────────┐
│  PAINEL SINISTROS (/eventos/sinistros)                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  ⚠️ 1 sinistro(s) aguardando aprovacao da IA               │   │
│  │  Solicitacoes geradas via WhatsApp/App precisam ser        │   │
│  │  revisadas                            [Revisar Solicitacoes]│   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐       │
│  │Comunicados │ │ Em Analise │ │ Aguardando │ │ Aprovados  │       │
│  │    1 (+IA) │ │     0      │ │  Vistoria  │ │     0      │       │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘       │
│                                                                     │
│  [Tabela de sinistros]                                             │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Codigo da Implementacao

### SinistrosList.tsx - Adicoes

```typescript
// Imports adicionais
import { Bot } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Query para pendencias IA (adicionar apos query de contadores)
const { data: pendenciasIA } = useQuery({
  queryKey: ['sinistros-pendencias-ia'],
  queryFn: async () => {
    const { data, count } = await supabase
      .from('chat_solicitacoes_ia')
      .select('id, tipo, dados, created_at, associado:associados!chat_solicitacoes_ia_associado_id_fkey(nome)', { count: 'exact' })
      .eq('status', 'pendente')
      .eq('tipo', 'sinistro')
      .order('created_at', { ascending: false });
    return { items: data || [], count: count || 0 };
  },
});

// Card de alerta (adicionar entre NovoSinistroModal e KPI Cards)
{pendenciasIA?.count > 0 && (
  <Card className="border-l-4 border-l-amber-500 bg-amber-50 dark:bg-amber-950/20">
    <CardContent className="flex items-center justify-between py-4">
      <div className="flex items-center gap-3">
        <Bot className="h-8 w-8 text-amber-600" />
        <div>
          <p className="font-semibold text-amber-800 dark:text-amber-200">
            {pendenciasIA.count} sinistro(s) aguardando aprovacao via IA
          </p>
          <p className="text-sm text-amber-600 dark:text-amber-400">
            Solicitacoes geradas via WhatsApp/App precisam ser aprovadas
          </p>
        </div>
      </div>
      <Button 
        variant="outline" 
        className="border-amber-500 text-amber-700 hover:bg-amber-100"
        onClick={() => navigate('/diretoria/solicitacoes-ia')}
      >
        <Bot className="mr-2 h-4 w-4" />
        Revisar Solicitacoes
      </Button>
    </CardContent>
  </Card>
)}
```

### SinistrosDashboard.tsx - Adicoes

```typescript
// Query para pendencias IA
const { data: pendenciasIA } = useQuery({
  queryKey: ['sinistros-pendencias-ia'],
  queryFn: async () => {
    const { count } = await supabase
      .from('chat_solicitacoes_ia')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pendente')
      .eq('tipo', 'sinistro');
    return count || 0;
  },
});

// Card de alerta no topo do dashboard (antes dos KPIs)
{pendenciasIA > 0 && (
  <Card className="border-l-4 border-l-amber-500 bg-amber-50 dark:bg-amber-950/20">
    <CardContent className="flex items-center justify-between py-4">
      <div className="flex items-center gap-3">
        <Bot className="h-8 w-8 text-amber-600" />
        <div>
          <p className="font-semibold text-amber-800 dark:text-amber-200">
            {pendenciasIA} sinistro(s) aguardando aprovacao
          </p>
          <p className="text-sm text-amber-600 dark:text-amber-400">
            Solicitacoes geradas via IA precisam ser revisadas
          </p>
        </div>
      </div>
      <Button 
        variant="outline"
        className="border-amber-500 text-amber-700 hover:bg-amber-100"
        onClick={() => navigate('/diretoria/solicitacoes-ia')}
      >
        Revisar
      </Button>
    </CardContent>
  </Card>
)}
```

---

## Validacao Pos-Implementacao

1. Acessar `/eventos/sinistros`
2. Verificar que aparece o card amarelo "1 sinistro(s) aguardando aprovacao via IA"
3. Clicar em "Revisar Solicitacoes"
4. Aprovar a solicitacao do Marcus
5. Voltar ao painel de sinistros
6. Verificar que o sinistro agora aparece na tabela

---

## Resumo

| Problema | Solucao |
|----------|---------|
| Painel mostra "Nenhum sinistro" | Adicionar indicador de pendencias IA |
| Diretor nao sabe que tem pendencias | Card de alerta com botao para revisar |
| Contador de comunicados incompleto | Somar pendencias IA no total |
