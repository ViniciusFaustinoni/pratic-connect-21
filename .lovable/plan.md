
## Funcionalidade: Blacklist de Veículos Reprovados

Este plano implementa um sistema completo de blacklist para veículos reprovados, com ações automáticas de cancelamento de contrato e estorno de pagamento.

---

## Visão Geral

Quando um veículo for recusado pelo vistoriador ou uma proposta for reprovada pelo analista de cadastro:

```text
┌─────────────────────────────────────────────────────────────────────┐
│ VISTORIADOR RECUSA VEÍCULO   OU   ANALISTA REPROVA PROPOSTA        │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  1. Adiciona veículo/placa na BLACKLIST                             │
│  2. Cancela documento no Autentique                                 │
│  3. Estorna pagamento de adesão no ASAAS                            │
│  4. Bloqueia acesso do associado ao app com mensagem "REPROVADO"    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Componentes a Implementar

### 1. Banco de Dados

**Nova tabela `blacklist_veiculos`:**

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid | Chave primária |
| placa | text | Placa do veículo (unique) |
| chassi | text | Chassi (opcional) |
| motivo | text | Motivo da inclusão |
| tipo_reprovacao | enum | 'vistoria_reprovada', 'proposta_reprovada' |
| veiculo_id | uuid | Referência ao veículo original |
| associado_id | uuid | Referência ao associado |
| contrato_id | uuid | Referência ao contrato |
| adicionado_por | uuid | Usuário que incluiu |
| created_at | timestamp | Data de inclusão |
| removido_em | timestamp | Data de remoção (se aplicável) |
| removido_por | uuid | Usuário que removeu |
| ativo | boolean | Se está ativo na blacklist |

---

### 2. Menu Lateral - Nova Opção

**Arquivo:** `src/components/layout/AppSidebar.tsx`

Adicionar item no grupo "Diretoria - Cadastro":

```typescript
{
  id: 'diretoria',
  label: 'Diretoria',
  items: [
    // ... itens existentes ...
    { title: 'Blacklist', url: '/diretoria/blacklist', icon: Ban },
  ],
}
```

---

### 3. Página de Blacklist

**Novo arquivo:** `src/pages/diretoria/Blacklist.tsx`

Funcionalidades:
- Listagem de veículos na blacklist com filtros
- Busca por placa, chassi, nome do associado
- Detalhes do motivo da reprovação
- Opção para remover da blacklist (apenas Diretor)
- Histórico de inclusões/remoções

---

### 4. Edge Function: Processar Reprovação Completa

**Novo arquivo:** `supabase/functions/processar-reprovacao/index.ts`

Fluxo:

```text
ENTRADA: { tipo, veiculo_id, contrato_id, motivo, usuario_id }
        │
        ▼
┌───────────────────────────────────────┐
│ 1. ADICIONAR NA BLACKLIST             │
│    INSERT INTO blacklist_veiculos     │
└───────────────────┬───────────────────┘
                    │
                    ▼
┌───────────────────────────────────────┐
│ 2. CANCELAR AUTENTIQUE                │
│    invoke('autentique-cancel')        │
│    (se houver documento pendente)     │
└───────────────────┬───────────────────┘
                    │
                    ▼
┌───────────────────────────────────────┐
│ 3. ESTORNAR PAGAMENTO ASAAS           │
│    POST /payments/{id}/refund         │
│    (se pagamento foi realizado)       │
└───────────────────┬───────────────────┘
                    │
                    ▼
┌───────────────────────────────────────┐
│ 4. ATUALIZAR STATUS ASSOCIADO         │
│    status = 'bloqueado'               │
│    motivo_bloqueio = 'REPROVADO'      │
└───────────────────────────────────────┘
```

---

### 5. Bloquear Área do Cliente

**Modificar:** `src/components/auth/AssociadoGuard.tsx`

Adicionar verificação de status "bloqueado" do associado:

```typescript
// Se associado está bloqueado, mostrar tela de reprovação
if (associado?.status === 'bloqueado' && associado?.motivo_bloqueio === 'VEICULO_REPROVADO') {
  return <Navigate to="/app/veiculo-reprovado" replace />;
}
```

**Nova página:** `src/pages/app/VeiculoReprovado.tsx`

Tela informativa exibindo:
- Ícone de alerta vermelho
- Mensagem: "VEÍCULO REPROVADO"
- Explicação sobre a reprovação
- Link para suporte/atendimento

---

### 6. Integrar nos Fluxos Existentes

**A) Recusa pelo Vistoriador**

**Modificar:** `src/hooks/useVistoriaCompleta.ts` (hook `useRecusarVeiculo`)

Após recusar veículo:
```typescript
// Chamar edge function para processar reprovação completa
await supabase.functions.invoke('processar-reprovacao', {
  body: {
    tipo: 'vistoria_reprovada',
    veiculo_id: data.veiculoId,
    contrato_id: vistoriaData?.contrato_id,
    motivo: data.motivo,
    usuario_id: profile?.id,
  }
});
```

**B) Reprovação pelo Analista**

**Modificar:** `src/hooks/usePropostasPendentes.ts` (hook `useReprovarProposta`)

Após reprovar proposta:
```typescript
// Chamar edge function para processar reprovação completa
await supabase.functions.invoke('processar-reprovacao', {
  body: {
    tipo: 'proposta_reprovada',
    veiculo_id: veiculoId,
    contrato_id: contratoId,
    associado_id: associadoId,
    motivo,
    justificativa,
    usuario_id: profile?.id,
  }
});
```

---

### 7. Verificar Blacklist ao Criar Cotação

**Modificar:** Fluxo de criação de cotação

Antes de permitir nova cotação, verificar se placa já está na blacklist:

```typescript
const { data: blacklistCheck } = await supabase
  .from('blacklist_veiculos')
  .select('id, motivo')
  .eq('placa', placa)
  .eq('ativo', true)
  .maybeSingle();

if (blacklistCheck) {
  throw new Error('Veículo não elegível para proteção');
}
```

---

## Arquivos a Criar/Modificar

| Tipo | Arquivo | Descrição |
|------|---------|-----------|
| 🆕 | `src/pages/diretoria/Blacklist.tsx` | Página de gestão da blacklist |
| 🆕 | `src/pages/app/VeiculoReprovado.tsx` | Tela de bloqueio para cliente |
| 🆕 | `supabase/functions/processar-reprovacao/index.ts` | Edge function para fluxo completo |
| 🆕 | `src/hooks/useBlacklist.ts` | Hook para operações de blacklist |
| ✏️ | `src/components/layout/AppSidebar.tsx` | Adicionar menu Blacklist |
| ✏️ | `src/components/auth/AssociadoGuard.tsx` | Verificar bloqueio |
| ✏️ | `src/hooks/useVistoriaCompleta.ts` | Integrar processamento |
| ✏️ | `src/hooks/usePropostasPendentes.ts` | Integrar processamento |
| ✏️ | `src/App.tsx` | Adicionar rotas |
| 🗄️ | `migration` | Criar tabela blacklist_veiculos |

---

## Detalhes Técnicos

### Estorno ASAAS

A API do ASAAS permite estorno via endpoint:
- **Boleto:** `POST /payments/{id}/bankSlip/refund`
- **PIX:** `POST /payments/{id}/refund`

### Status do Associado

Utilizar o valor existente do enum `status_associado`:
- `bloqueado` - para indicar que está na blacklist

Adicionar campo `motivo_bloqueio` com valor `'VEICULO_REPROVADO'` para identificar o tipo específico de bloqueio.

### Segurança

- Somente Diretor/Desenvolvedor pode remover da blacklist
- Todas as ações são registradas em logs de auditoria
- RLS policies para proteger a tabela blacklist_veiculos
