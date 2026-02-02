
# Plano: Corrigir Exibição de Rastreadores e Adicionar Coluna Veículo

## Problema Identificado

### 1. Rastreador 4305 - Dados Corretos no Banco
O rastreador com IMEI `862667083494305` **já está atualizado** no banco de dados:
- **Status**: `instalado` ✅
- **Veículo vinculado**: `LTB4J74` (Corolla XEi Flex) ✅
- **veiculo_id**: `a2bb7db1-96b1-4507-8912-4137d3d8abca` ✅

O problema é que a **interface não está refletindo os dados atualizados** - provavelmente cache da query React Query.

### 2. Coluna Veículo Não Exibindo
A coluna "Veículo" já existe no código, mas não está funcionando porque:
- **Não existe Foreign Key** entre `rastreadores.veiculo_id` e `veiculos.id`
- A sintaxe do Supabase `veiculos (placa, modelo)` depende de uma FK para funcionar automaticamente

---

## Solução

### Parte 1: Criar Foreign Key no Banco de Dados

Adicionar a constraint de FK faltante via migração:

```sql
ALTER TABLE rastreadores
ADD CONSTRAINT rastreadores_veiculo_id_fkey
FOREIGN KEY (veiculo_id) REFERENCES veiculos(id)
ON DELETE SET NULL;
```

### Parte 2: Ajustar Query com Hint Explícito (Fallback)

Se a FK não puder ser criada imediatamente, ajustar a query para usar hint explícito:

**Arquivo:** `src/components/monitoramento/estoque/ListaRastreadores.tsx`

```typescript
// Antes (linha 132):
veiculos (placa, modelo)

// Depois (com hint explícito):
veiculos:veiculos!veiculo_id(placa, modelo)
```

### Parte 3: Garantir Atualização em Tempo Real

Adicionar invalidação de queries quando rastreadores são atualizados em outras partes do sistema para evitar dados desatualizados.

---

## Resumo de Mudanças

| Arquivo | Mudança |
|---------|---------|
| Migração SQL | Criar FK `rastreadores_veiculo_id_fkey` |
| `ListaRastreadores.tsx` | Ajustar sintaxe da query para veículos |

## Resultado Esperado

1. O rastreador 4305 aparecerá com status "Instalado" ✅
2. Todos os rastreadores instalados mostrarão o veículo na coluna "Veículo" ✅
3. Dados ficarão sincronizados automaticamente após alterações
