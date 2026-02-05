
## Correção: Sincronização de Email/Telefone do Associado

### Problema Identificado
Quando um contrato já existe para uma cotação, a função `contrato-gerar` retornava imediatamente SEM sincronizar os dados de email/telefone do associado.

**Dados do caso reportado:**
- **Cotação:** Email `viniciusfaustinoni@gmail.com`
- **Associado no BD:** Email `marcosdativo@gmail.com` (desatualizado!)
- **Resultado:** O formulário de criação de conta exibia email incorreto → login falha

### Causa Raiz
A lógica de sincronização (linhas 184-261) estava **APÓS** a verificação de contrato existente (linhas 138-148), que fazia `return` antes de executar a sincronização.

```typescript
// ANTES: Retornava sem sincronizar
if (contratoExistente) {
  return new Response({ already_exists: true, ... });
}
// A sincronização só executava se o contrato NÃO existisse
```

### Correção Implementada
Adicionada lógica de sincronização **DENTRO** do bloco `if (contratoExistente)`, garantindo que email e telefone são atualizados mesmo quando o contrato já existe:

```typescript
if (contratoExistente) {
  console.log('[CONTRATO-GERAR] Contrato já existe...');
  
  // ✅ NOVO: Sincronizar email/telefone mesmo com contrato existente
  const lead = cotacao.lead;
  const clienteEmail = lead?.email || cotacao.email_solicitante;
  const clienteTelefone = lead?.telefone || cotacao.telefone1_solicitante;
  const clienteCpf = lead?.cpf || cotacao.cliente_cpf;
  
  if (clienteCpf) {
    const cpfLimpo = clienteCpf.replace(/\D/g, '');
    const { data: associadoExistente } = await supabase
      .from('associados')
      .select('id, email, telefone')
      .eq('cpf', cpfLimpo)
      .maybeSingle();
    
    if (associadoExistente) {
      const updateData = {};
      if (clienteEmail && clienteEmail !== associadoExistente.email) {
        updateData.email = clienteEmail;
      }
      if (clienteTelefone && clienteTelefone !== associadoExistente.telefone) {
        updateData.telefone = clienteTelefone;
      }
      
      if (Object.keys(updateData).length > 0) {
        await supabase.from('associados').update(updateData).eq('id', associadoExistente.id);
      }
    }
  }
  
  return new Response({ already_exists: true, ... });
}
```

### Status
- ✅ Código corrigido em `supabase/functions/contrato-gerar/index.ts`
- ⏳ Aguardando deploy automático (deploy manual está dando timeout)
- 📊 Logs detalhados adicionados para diagnóstico futuro

### Fluxo Corrigido
```
1. Cliente faz cotação com email: viniciusfaustinoni@gmail.com
2. Contrato é gerado (associado já existe com email antigo)
3. ✅ Sistema sincroniza email do associado para o da cotação
4. Formulário de criação de conta exibe email correto
5. Login funciona com email correto
```

### Arquivos Modificados
- `supabase/functions/contrato-gerar/index.ts`: Sincronização de email/telefone no bloco de contrato existente (linhas 138-203)
