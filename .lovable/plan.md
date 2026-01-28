
# Plano: Corrigir Fluxo de Cobertura Total Após Instalação

## Diagnóstico

### Cenário Atual (MARCUS VINICIUS)
| Etapa | Status Associado | cobertura_roubo_furto | cobertura_total | Observação |
|-------|------------------|----------------------|-----------------|------------|
| Autovistoria aprovada (09:58) | ativo | ✅ true | ❌ false | OK - cobertura parcial |
| Instalação concluída (10:17) | **em_analise** ⚠️ | ✅ true | ❌ false | PROBLEMA! |

### Problemas Identificados

**1. Regressão de Status do Associado**
- Arquivo: `src/hooks/useServicos.ts` (linhas 914-926)
- O hook `useAprovarVeiculoServico` força o status para `em_analise` quando deveria **manter o status atual** se já for `ativo`
- O associado MARCUS voltou de `ativo` → `em_analise` após a instalação

**2. Falta de Visibilidade para Ativação**
- O hook `useInstalacoesAguardandoAtivacao` existe em `useVistoriaCompletaAnalise.ts` mas **NÃO está sendo usado em nenhuma tela**
- O analista não sabe que precisa ativar o rastreador
- A página `/cadastro/instalacoes/:id/ativar` existe mas não há listagem que leve a ela

**3. Rastreador Instalado mas Não Ativado**
- Rastreador: `imei: 12345678912345678`, `status: instalado`
- `plataforma_device_id: null` (não ativado na Softruck)
- `cobertura_total: false` (deveria ser ativado automaticamente ou ter ação clara)

## Solução

### 1. Corrigir Regressão de Status (Prioridade Alta)

**Arquivo:** `src/hooks/useServicos.ts`

Modificar a lógica de atualização do associado (linhas 914-926):

```typescript
// ANTES:
const { error: associadoError } = await supabase
  .from('associados')
  .update({ 
    status: 'em_analise',  // ← SEMPRE força para em_analise
    updated_at: agora,
  })
  .eq('id', data.associadoId)
  .in('status', ['pendente_vistoria', 'aguardando_instalacao']);

// DEPOIS:
// Só atualiza para em_analise se NÃO estava ativo
// Se já estava ativo (aprovado antes), mantém ativo
const { error: associadoError } = await supabase
  .from('associados')
  .update({ 
    status: 'em_analise',
    updated_at: agora,
  })
  .eq('id', data.associadoId)
  .in('status', ['pendente_vistoria', 'aguardando_instalacao'])
  .neq('status', 'ativo');  // ← NÃO REGREDIR se já estiver ativo!

// OU melhor: Buscar status atual primeiro
const { data: associadoAtual } = await supabase
  .from('associados')
  .select('status')
  .eq('id', data.associadoId)
  .single();

if (associadoAtual?.status !== 'ativo') {
  await supabase
    .from('associados')
    .update({ status: 'em_analise', updated_at: agora })
    .eq('id', data.associadoId);
}
```

### 2. Ativar Cobertura Total Automaticamente Quando Autovistoria Prévia

**Arquivo:** `src/hooks/useServicos.ts`

Adicionar lógica para verificar se a autovistoria já foi aprovada e ativar cobertura total imediatamente:

```typescript
// Após vincular rastreador...

// Verificar se veículo já tinha cobertura_roubo_furto (autovistoria aprovada)
const { data: veiculoAtual } = await supabase
  .from('veiculos')
  .select('cobertura_roubo_furto, cobertura_total')
  .eq('id', data.veiculoId)
  .single();

// Se já tinha autovistoria aprovada, ativar cobertura total automaticamente
if (veiculoAtual?.cobertura_roubo_furto && !veiculoAtual?.cobertura_total) {
  const { error: veiculoError } = await supabase
    .from('veiculos')
    .update({
      status: 'ativo',
      cobertura_total: true,  // ← ATIVAR cobertura total
      updated_at: agora,
    })
    .eq('id', data.veiculoId);

  // Tentar ativar rastreador na plataforma (Softruck)
  try {
    await supabase.functions.invoke('softruck-ativar-dispositivo', {
      body: {
        imei: data.imeiRastreador,
        veiculoId: data.veiculoId,
        associadoId: data.associadoId,
      },
    });
  } catch (err) {
    console.warn('Ativação na plataforma falhou, requer ação manual:', err);
    // Não bloquear fluxo - ativação pode ser feita manualmente depois
  }
} else {
  // Fluxo normal sem autovistoria prévia
  await supabase
    .from('veiculos')
    .update({ status: 'ativo', updated_at: agora })
    .eq('id', data.veiculoId);
}
```

### 3. Adicionar Seção de "Aguardando Ativação" na Tela de Propostas

**Arquivo:** `src/pages/cadastro/PropostasPendentes.tsx`

Adicionar KPI e seção para instalações aguardando ativação:

```typescript
import { useInstalacoesAguardandoAtivacao } from '@/hooks/useVistoriaCompletaAnalise';

// Dentro do componente
const { data: instalacoesPendentes } = useInstalacoesAguardandoAtivacao();

// Novo KPI
<KPICard
  titulo="Aguard. Ativação"
  valor={instalacoesPendentes?.length || 0}
  icon={<Zap className="h-5 w-5 text-white" />}
  cor="bg-purple-500"
  loading={false}
/>

// Seção dedicada (se houver pendentes)
{instalacoesPendentes && instalacoesPendentes.length > 0 && (
  <Card className="border-2 border-purple-500">
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <Zap className="h-5 w-5 text-purple-500" />
        Instalações Aguardando Ativação de Rastreador
      </CardTitle>
      <CardDescription>
        Clique para ativar o rastreador na plataforma e liberar a cobertura total
      </CardDescription>
    </CardHeader>
    <CardContent>
      <Table>
        {/* Lista de instalações com botão para /cadastro/instalacoes/:id/ativar */}
      </Table>
    </CardContent>
  </Card>
)}
```

### 4. Corrigir Dados Existentes (MARCUS)

Executar SQL para corrigir o estado atual:

```sql
-- 1. Restaurar status do associado para ativo
UPDATE associados
SET status = 'ativo',
    updated_at = NOW()
WHERE id = '9487e709-2154-4f44-b9bc-eb7a423cf98b';

-- 2. Ativar cobertura total do veículo (já tem rastreador instalado)
UPDATE veiculos
SET cobertura_total = true,
    updated_at = NOW()
WHERE id = 'e455066e-3b22-4d68-9e56-4ca9ffce4d93';
```

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useServicos.ts` | Não regredir status de `ativo`; Ativar `cobertura_total` automaticamente se autovistoria prévia |
| `src/pages/cadastro/PropostasPendentes.tsx` | Adicionar seção/KPI para instalações aguardando ativação |
| *Migração SQL* | Corrigir dados do MARCUS (status e cobertura) |

## Seção Técnica

### Fluxo Esperado Após Correção

```text
1. Autovistoria aprovada pelo analista
   └─ associado.status = 'ativo'
   └─ veiculo.cobertura_roubo_furto = true
   └─ veiculo.cobertura_total = false

2. Instalação física concluída pelo técnico
   └─ associado.status = 'ativo' (MANTÉM!)
   └─ veiculo.cobertura_roubo_furto = true
   └─ veiculo.cobertura_total = true (ATIVA AUTOMATICAMENTE!)
   └─ Tenta ativar Softruck (não bloqueia se falhar)

3. App do Associado
   └─ Mostra todas as funcionalidades (Assistência 24h, todos sinistros, rastreamento)
```

### Regras de Negócio

| Cenário | Comportamento |
|---------|---------------|
| Instalação após autovistoria aprovada | Ativa `cobertura_total` imediatamente |
| Instalação SEM autovistoria prévia | Mantém `cobertura_total: false`, vai para fila de análise |
| Falha na ativação Softruck | Não bloqueia, registra para ativação manual posterior |

## Resultado Esperado

| Antes (Bug) | Depois (Corrigido) |
|-------------|-------------------|
| MARCUS vê "Sua cobertura atual é apenas para roubo e furto" | MARCUS vê todas as funcionalidades liberadas |
| Status regrediu para `em_analise` | Status permanece `ativo` |
| `cobertura_total: false` mesmo após instalação | `cobertura_total: true` ativado automaticamente |
| Analista não vê instalações pendentes de ativação | KPI + Seção visível na tela de propostas |
