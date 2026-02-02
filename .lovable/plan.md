
# Plano: Corrigir Rastreadores Órfãos e Ajustar Lógica de Exclusão

## Diagnóstico

### Problema 1: Rastreador "Sem placa" Aparecendo na Lista
- **IMEI**: `862667083403686`
- **Status atual**: `instalado` 
- **veiculo_id**: `null`
- **Causa raiz**: A função `delete-associado` desvincula o `veiculo_id` do rastreador, mas mantém o `status = instalado`. Como a view `view_rastreadores_posicao` filtra por `status = 'instalado'`, esse rastreador órfão continua aparecendo.

### Problema 2: LTB4J74 com Badge "Atenção"  
- **Não é um bug** - comportamento esperado
- O badge "Atenção" indica comunicação entre 1-24h atrás
- Última comunicação: 16:29 (há ~3 horas)
- Isso não tem relação com o status de ativação do rastreador

---

## Correções

### 1. Edge Function `delete-associado` - Voltar rastreador para estoque

**Arquivo:** `supabase/functions/delete-associado/index.ts`

**Mudança (linha ~251):**

```typescript
// ANTES (só desvincula):
await supabaseAdmin
  .from("rastreadores")
  .update({ veiculo_id: null })
  .eq("veiculo_id", veiculo.id);

// DEPOIS (desvincula E volta para estoque):
await supabaseAdmin
  .from("rastreadores")
  .update({ 
    veiculo_id: null,
    associado_id: null,
    associado_email: null,
    status: 'estoque',  // Volta para estoque
    updated_at: new Date().toISOString()
  })
  .eq("veiculo_id", veiculo.id);
```

### 2. Script de Correção Manual - Limpar rastreador órfão atual

Executar no banco de dados para corrigir o rastreador existente:

```sql
UPDATE rastreadores 
SET 
  status = 'estoque',
  veiculo_id = null,
  associado_id = null,
  associado_email = null,
  updated_at = now()
WHERE 
  imei = '862667083403686'
  AND veiculo_id IS NULL 
  AND status = 'instalado';
```

---

## Resultado Esperado

1. O rastreador `862667083403686` ("Sem placa") desaparecerá da lista de veículos em tempo real
2. O rastreador voltará para o estoque, disponível para nova instalação
3. Futuras exclusões de associados voltarão os rastreadores automaticamente para estoque
4. O badge "Atenção" do LTB4J74 é comportamento normal - indica apenas que não comunicou na última hora (pode ajustar regra se desejado)

---

## Detalhes Técnicos

### View `view_rastreadores_posicao`
```sql
-- Lógica atual de status_comunicacao:
CASE
  WHEN ultima_comunicacao IS NULL THEN 'sem_dados'
  WHEN ultima_comunicacao > (now() - '01:00:00') THEN 'online'
  WHEN ultima_comunicacao > (now() - '24:00:00') THEN 'atencao'  -- 1-24h
  ELSE 'offline'
END
```

### Opcional: Ajustar período de "Atenção"
Se desejar que o veículo fique "online" por mais tempo antes de ir para "Atenção", posso alterar o intervalo de 1 hora para 2 ou 3 horas.
