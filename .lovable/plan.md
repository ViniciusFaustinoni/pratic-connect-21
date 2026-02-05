
## Diagnóstico e Correção: Sincronização de Email não está Funcionando

### Problema Confirmado
- **Cotação:** Email `viniciusfaustinoni@gmail.com`
- **Associado no BD:** Email `marcosdativo@gmail.com` (desatualizado!)
- **Contrato:** Criado em 2026-02-05 19:46:25 (5 min após a cotação)
- **Resultado:** O formulário de criação de conta exibe email incorreto → login falha

### Investigação Realizada

#### 1. Verificação do Código
- ✅ Edge Function `contrato-gerar/index.ts` foi modificada (linhas 174-223)
- ✅ Código contém toda a lógica de sincronização
- ✅ CPF é buscado corretamente (sem formatação)
- ✅ Email é extraído corretamente da cotação
- ✅ Comparação está implementada (emailFinal !== associadoExistente.email)

#### 2. Dados do Banco
- ✅ Cotação `e7587904-9e47-4860-aa37-4a802a9f1204`: Email = `viniciusfaustinoni@gmail.com` (28 caracteres, sem whitespace)
- ✅ Associado `9e104716-7b29-4666-9b2f-baeb53862c79`: Email = `marcosdativo@gmail.com` (22 caracteres)
- ✅ Contratos/Associado criados em 2026-02-05 19:46:25
- ✅ Associado.cpf = `12493649737` (sem formatação)
- ✅ Cotação.cliente_cpf = `124.936.497-37` (formatado)

#### 3. Análise de Logs
- ❌ **CRÍTICO:** Nenhum log encontrado para a Edge Function `contrato-gerar`
  - Verificado em: function_edge_logs analytics (query vazia)
  - Verificado em: supabase--edge-function-logs (sem matches)
  - Isso sugere que **a função nunca é executada completamente ou não está deployada**

### Causas Potenciais

#### Causa 1: Edge Function não está deployada
**Probabilidade: 60%**
- O arquivo foi modificado, mas a deploy pode ter falhado silenciosamente
- Sintomas: Nenhum log na função
- Resolução: Verificar deploy status e redeployer se necessário

#### Causa 2: Erro no início da função antes dos logs
**Probabilidade: 25%**
- A função falha no parsing do JSON ou em uma query inicial
- Os logs de console.log() (linhas 31, 182, 193, etc.) nunca são alcançados
- Resolução: Adicionar logs mais cedo na execução

#### Causa 3: Erro de RLS (Row Level Security)
**Probabilidade: 10%**
- A função consegue ler o associado, mas não consegue atualizar (erro silencioso)
- A linha 212 `.update(updateData)` falha silenciosamente
- Resolução: Verificar RLS na tabela `associados` ou adicionar erro logging

#### Causa 4: CPF desformatado vs formatado
**Probabilidade: 5%**
- O CPF na cotação é `124.936.497-37` (formatado)
- O CPF buscado é `.replace(/\D/g, '')` = `12493649737` (correto)
- Mas pode haver erro em como a cotação obtém o CPF original

### Plano de Resolução (2 fases)

#### Fase 1: Diagnóstico (Imediato)
1. **Redeployer a Edge Function** - Força novo build/deploy
2. **Adicionar logging mais detalhado** - Inserir logs no INÍCIO da função antes de qualquer query
3. **Testar Edge Function manualmente** - Chamar a função com dados conhecidos via `supabase--curl_edge_functions`
4. **Verificar RLS na tabela `associados`** - Confirmar se o serviço role consegue fazer UPDATE

#### Fase 2: Correção
Se o diagnóstico revelar o problema:
- **Se for deploy:** Redeployer será suficiente
- **Se for erro inicial:** Adicionar try-catch com logging detalhado
- **Se for RLS:** Ajustar políticas ou usar serviço role correto
- **Se for parsing do CPF:** Tratar melhor o CPF da cotação

### Modificações Necessárias em `contrato-gerar/index.ts`

#### Adicionar logging mais robusto (no início, linha ~30):
```typescript
console.log('[CONTRATO-GERAR] Iniciando função...');
console.log('[CONTRATO-GERAR] SUPABASE_URL:', Deno.env.get('SUPABASE_URL'));

// Logging imediato do payload recebido
const { cotacao_id, vendedor_id } = await req.json() as GerarContratoPayload;
console.log('[CONTRATO-GERAR] Payload recebido:', { cotacao_id, vendedor_id });
```

#### Adicionar tratamento de erro para o UPDATE (linha ~217):
```typescript
if (updateAssociadoError) {
  console.error('[ERRO] Falha ao sincronizar dados:', {
    erro: updateAssociadoError.message,
    code: updateAssociadoError.code,
    details: updateAssociadoError.details,
    hint: updateAssociadoError.hint,
    updateData,
    associadoId
  });
  // Não interrompe o fluxo
} else {
  console.log('[OK] Sincronização bem-sucedida para associado:', associadoId);
}
```

#### Verificar se os campos estão sendo populados corretamente:
```typescript
console.log('[DEBUG] Valores extraídos da cotação:', {
  emailFinal,
  emailFinal_length: emailFinal?.length,
  emailFinal_trimmed: emailFinal?.trim(),
  telefoneFinal,
  cpfFinal,
  cpfLimpo
});

if (associadoExistente) {
  console.log('[DEBUG] Associado existente encontrado:', {
    id: associadoExistente.id,
    email_atual: associadoExistente.email,
    email_nova: emailFinal,
    emails_iguais: emailFinal === associadoExistente.email
  });
}
```

### Próximos Passos
1. ✅ **Redeployer Edge Function** `contrato-gerar`
2. ✅ **Adicionar logging detalhado** conforme sugerido acima
3. ✅ **Testar manualmente** com curl/invoke
4. ✅ **Reprocessar a cotação** do associado para verificar se sincroniza
5. ✅ **Validar na página de acompanhamento** se o email foi atualizado
6. ✅ **Verificar RLS policies** na tabela `associados`

### Impacto da Correção
- ✅ Email será sincronizado automaticamente ao gerar contrato
- ✅ Formulário de criação de conta exibirá email correto
- ✅ Login funcionará com email correto
- ✅ Associados não ficarão com dados desatualizados
