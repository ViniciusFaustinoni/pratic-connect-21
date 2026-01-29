

# Revisao Completa - Fluxo de Ativacao e Inativacao de Cliente na Rede Veiculos

## Resumo Executivo

| Item | Status | Detalhes |
|------|--------|----------|
| Endpoint POST /ativarCliente | **NAO EXISTE NA API** | A API Rede Veiculos trabalha com ativacao por **VEICULO**, nao por cliente |
| Endpoint POST /inativarCliente | **NAO EXISTE NA API** | A API Rede Veiculos trabalha com inativacao por **VEICULO**, nao por cliente |
| Associado aprovado no cadastro | **PARCIAL** | Aprovacao ativa associado localmente, vinculacao ocorre na instalacao |
| Reativacao de associado que cancelou | **IMPLEMENTADO** | Usa `informarAdimplente` + revincular veiculos |
| Associado regulariza pendencias | **IMPLEMENTADO** | Webhook ASAAS e baixa manual notificam adimplencia |
| Cancelamento definitivo | **IMPLEMENTADO** | Usa `desvincularClienteVeiculo` para cada veiculo |
| Exclusao por fraude | **NAO EXISTE** | Funcionalidade especifica nao implementada |
| Todos os veiculos desvinculados | **PARCIAL** | Nao ha logica especifica para inativar cliente |
| Cliente inativo perde acesso ao App | **IMPLEMENTADO** | AppRastreamento bloqueia se status = suspenso/inadimplente |
| Reativacao restaura acesso | **IMPLEMENTADO** | Muda status para ativo e notifica adimplencia |
| Historico preservado | **IMPLEMENTADO** | Tabela `associados_historico` mantem registros |

---

## Analise Conceitual: Cliente vs Veiculo na API Rede Veiculos

### Descoberta Importante

A API da Rede Veiculos **NAO POSSUI** endpoints especificos para ativar/inativar CLIENTES. O modelo de negocio e baseado em **VEICULOS**, nao em clientes. Os endpoints disponiveis sao:

| Nivel | Endpoints Disponiveis |
|-------|----------------------|
| **Cliente** | vincularClienteVeiculo, desvincularClienteVeiculo, atualizarDadosCliente |
| **Veiculo** | ativarVeiculo, inativarVeiculo, atualizarDadosVeiculo |
| **Financeiro** | informarVeiculoAdimplente, informarVeiculoInadimplente |

**Implicacao:** Para "inativar um cliente" na Rede Veiculos, deve-se:
1. Inativar/desvincular TODOS os seus veiculos
2. Informar inadimplencia em TODOS os veiculos

---

## Estado Atual da Implementacao

### Edge Functions Existentes

| Edge Function | Operacao | Status |
|---------------|----------|--------|
| `rede-veiculos-vincular-cliente` | vincularClienteVeiculo | Implementado |
| `rede-veiculos-desvincular-cliente` | desvincularClienteVeiculo | Implementado |
| `rede-veiculos-atualizar-cliente` | atualizarDadosCliente | Implementado |
| `rede-veiculos-ativar-veiculo` | ativarVeiculo | Implementado |
| `rede-veiculos-inativar-veiculo` | inativarVeiculo | Implementado |
| `rede-veiculos-informar-adimplente` | informarVeiculoAdimplente | Implementado |
| `rede-veiculos-informar-inadimplente` | informarVeiculoInadimplente | Implementado |

### Cenarios de Ativacao de Cliente

#### 1. Associado Aprovado no Cadastro

**Arquivo:** `src/hooks/usePropostasPendentes.ts` (linhas 1356-1382)

```typescript
// Status do associado definido como 'ativo' imediatamente na aprovacao
const statusAssociado = 'ativo';

const { data: associadoAtualizado } = await supabase
  .from('associados')
  .update({
    status: statusAssociado,
    data_adesao: agora.split('T')[0],
    aprovado_por: profile.id,
    aprovado_em: agora,
  })
  .eq('id', associadoId);
```

**Status:** Apenas atualiza banco local. Vinculacao na Rede Veiculos ocorre posteriormente quando instalador executa a instalacao e chama `rede-veiculos-vincular-cliente`.

**Fluxo Completo:**
1. Analista aprova proposta -> associado.status = 'ativo'
2. Instalador conclui instalacao -> chama `rede-veiculos-vincular-cliente`
3. Vinculacao cria cliente e veiculo na Rede Veiculos
4. Automaticamente ativa veiculo via `ativarVeiculo`

#### 2. Reativacao de Associado que Havia Cancelado

**Arquivo:** `src/hooks/useAssociados.ts` (linhas 479-545)

```typescript
const reativarAssociado = useMutation({
  mutationFn: async (id: string) => {
    // 1. Atualizar status local
    await supabase.from('associados').update({ status: 'ativo', ... });

    // 2. Notificar Rede Veiculos sobre adimplencia
    await supabase.functions.invoke('rede-veiculos-informar-adimplente', {
      body: { associadoId: id, motivo: 'reativacao_manual' },
    });

    // 3. Revincular veiculos se necessario
    for (const veiculo of veiculos) {
      if (rastreador?.plataforma === 'rede_veiculos') {
        await supabase.functions.invoke('rede-veiculos-vincular-cliente', { ... });
      }
    }
  },
});
```

**Status:** IMPLEMENTADO - Notifica adimplencia e revincular cada veiculo individualmente.

#### 3. Associado Regulariza Pendencias

**Coberto por:**
- Webhook ASAAS (`PAYMENT_RECEIVED`) - chama `rede-veiculos-informar-adimplente`
- Baixa manual (`RegistrarPagamentoModal.tsx`) - chama `rede-veiculos-informar-adimplente`

**Status:** IMPLEMENTADO

### Cenarios de Inativacao de Cliente

#### 1. Cancelamento Definitivo

**Arquivo:** `src/hooks/useAssociados.ts` (linhas 590-656)

```typescript
const cancelarAssociado = useMutation({
  mutationFn: async ({ id, motivo }) => {
    // Para cada rastreador Rede Veiculos, desvincular na plataforma
    for (const rastreador of rastreadores || []) {
      if (rastreador.plataforma === 'rede_veiculos') {
        await supabase.functions.invoke('rede-veiculos-desvincular-cliente', {
          body: {
            rastreadorId: rastreador.id,
            motivo: 'cancelamento_contrato',
            atualizarBancoLocal: true,
          },
        });
      }
    }
    
    // Atualizar status do associado
    await supabase.from('associados').update({ status: 'cancelado', ... });
  },
});
```

**Status:** IMPLEMENTADO - Desvincula cada veiculo individualmente.

**Gap Identificado:** A funcao deveria tambem chamar `inativarVeiculo` antes de `desvincularClienteVeiculo` para garantir que o veiculo seja desativado corretamente na plataforma.

#### 2. Exclusao por Fraude Comprovada

**Arquivo:** `supabase/functions/delete-associado/index.ts`

Esta funcao exclui permanentemente o associado do banco local, mas **NAO** notifica a Rede Veiculos:
- Nao chama `inativarVeiculo`
- Nao chama `desvincularClienteVeiculo`
- Nao chama `informarInadimplente`

**Status:** GAP CRITICO - Exclusao por fraude nao inativa/desvincula na plataforma Rede Veiculos.

#### 3. Todos os Veiculos Desvinculados

**Nao existe logica automatica para:**
- Detectar quando o ultimo veiculo foi desvinculado
- Marcar cliente como inativo na plataforma

**Status:** GAP - Nao ha logica para tratar este cenario.

---

## Controle de Acesso ao App

### Implementacao Atual (CORRETA)

**Arquivo:** `src/pages/app/AppRastreamento.tsx` (linhas 227-260)

```typescript
const associadoBloqueado = associado?.status === 'suspenso' || 
                            associado?.status === 'inadimplente' || 
                            associado?.bloqueado === true;

if (associadoBloqueado) {
  return (
    <div className="flex h-screen flex-col bg-background">
      // Tela de Acesso Bloqueado
      <h3>Acesso Bloqueado</h3>
      <p>Seu acesso esta suspenso devido a pendencias financeiras.</p>
      <Button onClick={() => navigate('/app/boletos')}>Ver Boletos</Button>
    </div>
  );
}
```

**Status:** IMPLEMENTADO - Cliente com status suspenso/inadimplente nao consegue acessar rastreamento.

---

## Gaps Identificados

### Gap 1: `delete-associado` Nao Notifica Rede Veiculos

A edge function de exclusao permanente **nao** inativa/desvincula na plataforma:

```typescript
// FALTANDO em delete-associado/index.ts:
// 1. Para cada veiculo do associado com rede_veiculos_veiculo_id:
//    - Chamar rede-veiculos-inativar-veiculo
//    - Chamar rede-veiculos-desvincular-cliente
// 2. Registrar log da operacao
```

### Gap 2: `cancelarAssociado` Deveria Inativar Antes de Desvincular

Atualmente, cancela apenas desvincula. Deveria:
1. Chamar `rede-veiculos-inativar-veiculo` para cada veiculo
2. Depois chamar `rede-veiculos-desvincular-cliente`

### Gap 3: Nao Ha Funcionalidade Especifica para Fraude

Exclusao por fraude deveria ter fluxo especifico:
1. Bloquear imediatamente na Rede Veiculos
2. Desativar todos os alertas
3. Registrar motivo especial

### Gap 4: Falta Orquestrador de Inativacao de Cliente

Nao ha funcao que coordene a inativacao completa de um cliente:
- Inativar todos os veiculos
- Informar inadimplencia em todos
- Atualizar status local
- Registrar historico

---

## Plano de Implementacao

### Fase 1: Criar Edge Function Orquestradora

**Novo arquivo:** `supabase/functions/rede-veiculos-inativar-cliente-completo/index.ts`

```typescript
interface RequestBody {
  associadoId: string;
  motivo: 'cancelamento' | 'fraude' | 'inadimplencia' | 'exclusao';
  observacoes?: string;
  atualizarBancoLocal?: boolean;
}

// Fluxo:
// 1. Buscar todos os veiculos do associado com rastreador Rede Veiculos
// 2. Para cada veiculo:
//    a. Chamar POST /inativarVeiculo
//    b. Chamar POST /informarVeiculoInadimplente (se aplicavel)
//    c. Chamar POST /desvincularClienteVeiculo (se cancelamento/exclusao)
// 3. Atualizar banco local
// 4. Registrar historico
```

### Fase 2: Criar Edge Function de Ativacao de Cliente Completo

**Novo arquivo:** `supabase/functions/rede-veiculos-ativar-cliente-completo/index.ts`

```typescript
interface RequestBody {
  associadoId: string;
  motivo?: string;
}

// Fluxo:
// 1. Buscar todos os veiculos do associado com rastreador Rede Veiculos
// 2. Para cada veiculo:
//    a. Se nao vinculado, chamar vincularClienteVeiculo
//    b. Chamar POST /ativarVeiculo
//    c. Chamar POST /informarVeiculoAdimplente
// 3. Atualizar banco local (veiculos ativos)
// 4. Registrar historico
```

### Fase 3: Integrar em `cancelarAssociado`

**Modificar:** `src/hooks/useAssociados.ts`

```typescript
const cancelarAssociado = useMutation({
  mutationFn: async ({ id, motivo }) => {
    // NOVO: Usar orquestrador para inativar completamente
    await supabase.functions.invoke('rede-veiculos-inativar-cliente-completo', {
      body: {
        associadoId: id,
        motivo: 'cancelamento',
        observacoes: motivo,
      },
    });
    
    // Atualizar status do associado (ja existe)
    await supabase.from('associados').update({ status: 'cancelado', ... });
  },
});
```

### Fase 4: Integrar em `delete-associado`

**Modificar:** `supabase/functions/delete-associado/index.ts`

Antes de excluir, chamar a edge function orquestradora:

```typescript
// Antes de deletar veiculos (linha ~196)
await fetch(`${supabaseUrl}/functions/v1/rede-veiculos-inativar-cliente-completo`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${supabaseServiceKey}`,
  },
  body: JSON.stringify({
    associadoId,
    motivo: 'exclusao',
    observacoes: 'Exclusao permanente por diretor',
  }),
});
```

### Fase 5: Adicionar Opcao de Exclusao por Fraude

**Modificar:** `src/pages/cadastro/AssociadoDetalhe.tsx`

Adicionar dialog especifico para exclusao por fraude com:
- Motivo detalhado
- Confirmacao dupla
- Chamada a `rede-veiculos-inativar-cliente-completo` com motivo 'fraude'

### Fase 6: Integrar em `reativarAssociado`

**Modificar:** `src/hooks/useAssociados.ts`

```typescript
const reativarAssociado = useMutation({
  mutationFn: async (id: string) => {
    // Atualizar status local (ja existe)
    await supabase.from('associados').update({ status: 'ativo', ... });
    
    // NOVO: Usar orquestrador para ativar completamente
    await supabase.functions.invoke('rede-veiculos-ativar-cliente-completo', {
      body: {
        associadoId: id,
        motivo: 'reativacao_manual',
      },
    });
  },
});
```

---

## Arquivos a Criar

| Arquivo | Descricao |
|---------|-----------|
| `supabase/functions/rede-veiculos-inativar-cliente-completo/index.ts` | Orquestrador de inativacao |
| `supabase/functions/rede-veiculos-ativar-cliente-completo/index.ts` | Orquestrador de ativacao |

## Arquivos a Modificar

| Arquivo | Alteracoes |
|---------|------------|
| `supabase/functions/delete-associado/index.ts` | Chamar orquestrador antes de excluir |
| `src/hooks/useAssociados.ts` | Usar orquestradores em cancelar/reativar |
| `src/pages/cadastro/AssociadoDetalhe.tsx` | Adicionar opcao de exclusao por fraude |
| `supabase/config.toml` | Registrar novas edge functions |

---

## Checklist de Verificacao

- [x] Aprovacao de proposta cria associado ativo localmente
- [x] Vinculacao na instalacao cria cliente na Rede Veiculos
- [x] Reativacao notifica adimplencia na Rede Veiculos
- [x] Regularizacao de pendencias notifica adimplencia
- [x] Cancelamento desvincula veiculos da plataforma
- [x] Cliente suspenso/inadimplente nao acessa App
- [x] Historico de mudancas preservado
- [ ] Edge function orquestradora de inativacao
- [ ] Edge function orquestradora de ativacao
- [ ] Exclusao notifica Rede Veiculos antes de deletar
- [ ] Cancelamento inativa antes de desvincular
- [ ] Opcao especifica para exclusao por fraude

---

## Teste Recomendado: Ciclo Completo

### Pre-requisitos

1. Associado ativo com veiculo e rastreador Rede Veiculos
2. `REDE_VEICULOS_TOKEN` valido
3. Acesso ao App do Associado

### Passos do Teste

**Parte 1: Inativar Cliente (Cancelamento)**

1. Acessar sistema como diretor (admin@teste.com)
2. Navegar para Cadastro > Associados > [Associado teste]
3. Clicar em "Cancelar Associado"
4. Informar motivo: "Teste de cancelamento"
5. Confirmar
6. Verificar no banco:
   - `associados.status = 'cancelado'`
   - `rastreadores_api_logs` com operacoes `inativarVeiculo` e `desvincularClienteVeiculo`
   - `veiculos.ativo = false`
7. Verificar no App do Associado:
   - Nao consegue fazer login ou acessa tela de bloqueio

**Parte 2: Reativar Cliente**

8. Voltar ao painel administrativo
9. Clicar em "Reativar Associado"
10. Verificar no banco:
    - `associados.status = 'ativo'`
    - `rastreadores_api_logs` com operacoes `vincularClienteVeiculo` e `ativarVeiculo`
11. Verificar no App do Associado:
    - Consegue fazer login e ver rastreamento

### Resultado Esperado

- Inativacao bloqueia acesso e desvincula na Rede Veiculos
- Reativacao restaura acesso e revincula na Rede Veiculos
- Todo o historico registrado em `associados_historico` e `rastreadores_api_logs`

