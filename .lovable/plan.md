

# Fix: Meta exige 4 semanas após exclusão do template

## Problema

A Meta excluiu o template `boas_vindas_associado` (via nosso auto-delete), mas informa que a exclusão leva **4 semanas** para ser processada. Durante esse período, não é possível recriar um template com o mesmo nome.

## Solução

Criar o template com um **novo nome** (ex: `boas_vindas_associado_v2`) que contém exatamente o mesmo conteúdo. Isso contorna a restrição da Meta.

### Alterações

**1. SQL Migration** — Renomear o template no banco:
```sql
UPDATE whatsapp_meta_templates 
SET nome = 'boas_vindas_associado_v2',
    status = 'DRAFT',
    meta_template_id = NULL
WHERE nome = 'boas_vindas_associado';
```

**2. `supabase/functions/whatsapp-send-text/index.ts`** — Atualizar o mapeamento de template para usar o novo nome. Buscar onde `boas_vindas_associado` é referenciado e mapear para `boas_vindas_associado_v2`.

**3. Qualquer outro caller** (ex: `notificar-cliente`, `ativar-associado`) — Verificar se referenciam o template por nome e atualizar.

### Resultado
- Template aparece como DRAFT com nome `boas_vindas_associado_v2`
- Usuário clica "Enviar para aprovação" — cria template novo na Meta sem conflito
- Todas as funções que enviam boas-vindas usam o novo nome automaticamente

