
# Plano: Adicionar Veículos à Blacklist Quando Associado for Bloqueado

## Problema Identificado

Quando um associado é bloqueado pelo sistema, seus veículos **não são automaticamente adicionados à blacklist**. Isso significa que:
- O veículo pode ser usado em uma nova cotação por outro associado
- Não há registro histórico do bloqueio na blacklist
- O controle da diretoria sobre veículos problemáticos fica incompleto

## Solução Proposta

### 1. Adicionar Novo Tipo de Reprovação no Banco de Dados

Atualmente o enum `tipo_reprovacao` só tem dois valores:
- `vistoria_reprovada`
- `proposta_reprovada`

**Ação:** Adicionar um novo valor ao enum para representar bloqueio de associado:
- `associado_bloqueado`

```sql
ALTER TYPE tipo_reprovacao ADD VALUE 'associado_bloqueado';
```

### 2. Atualizar o Hook `useBlacklist.ts`

Atualizar a interface e o mutation para aceitar o novo tipo:

```typescript
// Interface BlacklistVeiculo
tipo_reprovacao: 'vistoria_reprovada' | 'proposta_reprovada' | 'associado_bloqueado';
```

### 3. Atualizar a Página de Blacklist

**Arquivo: `src/pages/diretoria/Blacklist.tsx`**

Adicionar o novo tipo no mapa de labels:
```typescript
const TIPO_LABELS: Record<string, string> = {
  vistoria_reprovada: 'Vistoria Reprovada',
  proposta_reprovada: 'Proposta Reprovada',
  associado_bloqueado: 'Associado Bloqueado', // NOVO
};
```

Adicionar opção no filtro de tipo:
```typescript
<SelectItem value="associado_bloqueado">Associado Bloqueado</SelectItem>
```

Adicionar card de estatísticas:
```typescript
<Card>
  <CardHeader>
    <CardTitle>Associado Bloqueado</CardTitle>
  </CardHeader>
  <CardContent>
    <div className="text-2xl font-bold">
      {blacklist?.filter((i) => i.ativo && i.tipo_reprovacao === 'associado_bloqueado').length || 0}
    </div>
  </CardContent>
</Card>
```

### 4. Modificar a Lógica de Bloqueio de Associado

**Arquivo: `src/pages/cadastro/Associados.tsx`**

Na função `handleAcaoConfirm`, após bloquear o associado, buscar todos os veículos vinculados e adicionar cada um à blacklist:

```typescript
const handleAcaoConfirm = async (motivo: string) => {
  // ... código existente para atualizar status ...

  // SE ação for BLOQUEAR, adicionar veículos à blacklist
  if (acaoDialog.acao === 'bloquear') {
    // 1. Buscar veículos do associado
    const { data: veiculos } = await supabase
      .from('veiculos')
      .select('id, placa, chassi')
      .eq('associado_id', acaoDialog.associadoId);

    // 2. Para cada veículo, adicionar à blacklist
    if (veiculos && veiculos.length > 0) {
      for (const veiculo of veiculos) {
        await supabase
          .from('blacklist_veiculos')
          .insert({
            placa: veiculo.placa.toUpperCase().replace(/[^A-Z0-9]/g, ''),
            chassi: veiculo.chassi,
            motivo: motivo,
            justificativa: `Associado bloqueado: ${motivo}`,
            tipo_reprovacao: 'associado_bloqueado',
            veiculo_id: veiculo.id,
            associado_id: acaoDialog.associadoId,
            adicionado_por: profile?.id,
            ativo: true,
          });
      }
      
      toast({
        title: 'Veículos adicionados à Blacklist',
        description: `${veiculos.length} veículo(s) foram adicionados à blacklist.`,
      });
    }
  }
};
```

### 5. Atualizar o Hook `useAssociadoActions` (Opcional)

Para centralizar a lógica, podemos adicionar a inserção na blacklist dentro do hook `useAssociadoActions`:

**Arquivo: `src/hooks/useAssociados.ts`**

Modificar o mutation `atualizarStatus` para incluir a lógica de blacklist quando status for `bloqueado`.

## Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| **Migração SQL** | Adicionar valor `associado_bloqueado` ao enum `tipo_reprovacao` |
| `src/hooks/useBlacklist.ts` | Atualizar interface para incluir novo tipo |
| `src/pages/diretoria/Blacklist.tsx` | Adicionar label, filtro e card de estatísticas |
| `src/pages/cadastro/Associados.tsx` | Adicionar lógica de inserção na blacklist após bloqueio |

## Fluxo Esperado

```text
┌─────────────────────────────────────────────────────────────┐
│  1. Usuário clica em "Bloquear" no menu do associado        │
└─────────────────────────────────┬───────────────────────────┘
                                  ▼
┌─────────────────────────────────────────────────────────────┐
│  2. Dialog solicita motivo do bloqueio                      │
└─────────────────────────────────┬───────────────────────────┘
                                  ▼
┌─────────────────────────────────────────────────────────────┐
│  3. Sistema atualiza status do associado para "bloqueado"   │
└─────────────────────────────────┬───────────────────────────┘
                                  ▼
┌─────────────────────────────────────────────────────────────┐
│  4. Sistema busca todos os veículos do associado            │
└─────────────────────────────────┬───────────────────────────┘
                                  ▼
┌─────────────────────────────────────────────────────────────┐
│  5. Cada veículo é inserido na blacklist_veiculos           │
│     com tipo_reprovacao = 'associado_bloqueado'             │
└─────────────────────────────────┬───────────────────────────┘
                                  ▼
┌─────────────────────────────────────────────────────────────┐
│  6. Toast confirma bloqueio + veículos na blacklist         │
└─────────────────────────────────────────────────────────────┘
```

## Comportamento Esperado

| Cenário | Antes | Depois |
|---------|-------|--------|
| Bloquear associado | Apenas status alterado | Status + veículos na blacklist |
| Página Blacklist | Sem categoria "Bloqueado" | Nova categoria com estatísticas |
| Nova cotação com placa bloqueada | Poderia continuar | Bloqueada automaticamente |

## Testes Recomendados

1. Bloquear um associado que possui veículo cadastrado
2. Verificar se o veículo aparece na página de Blacklist da Diretoria
3. Confirmar que o tipo exibido é "Associado Bloqueado"
4. Tentar fazer uma cotação com a placa bloqueada e verificar se o modal de bloqueio aparece
