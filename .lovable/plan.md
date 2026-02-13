
# Adicionar "Usar como padrao para Termo de Saida de Evento" + Fluxo completo de liberacao de veiculo

## Resumo

Tres alteracoes integradas:

1. **Novo checkbox no formulario de templates**: "Usar como padrao para Termo de Saida de Evento" (campo `is_default_saida`)
2. **Edge function `autentique-os-saida-create`**: priorizar template com `is_default_saida = true`
3. **Modal `OSConclusaoModal`**: apos assinatura, exibir botao "Liberar Veiculo" que marca sinistro como `encerrado` e OS como finalizada

## Alteracoes

| Arquivo / Recurso | Descricao |
|---|---|
| **SQL (Migration)** | Adicionar coluna `is_default_saida` (boolean, default false) com unique index parcial |
| **`src/pages/documentos/TemplateForm.tsx`** | Novo checkbox com icone Car e cor verde: "Usar como padrao para Termo de Saida de Evento" |
| **`src/hooks/useDocumentoTemplates.ts`** | Adicionar `is_default_saida` nos tipos, interfaces e mutations |
| **`supabase/functions/autentique-os-saida-create/index.ts`** | Priorizar template com `is_default_saida = true` antes do fallback por `document_type_id` |
| **`src/components/oficinas/OSConclusaoModal.tsx`** | Adicionar botao "Liberar Veiculo" que aparece apos assinatura; ao confirmar, atualiza sinistro para `encerrado` e OS para finalizado |

## Detalhes tecnicos

### 1. Migration SQL

```sql
ALTER TABLE public.documento_templates
  ADD COLUMN IF NOT EXISTS is_default_saida BOOLEAN DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS idx_template_default_saida
  ON public.documento_templates (is_default_saida)
  WHERE is_default_saida = true AND ativo = true;
```

### 2. TemplateForm.tsx

Adicionar novo checkbox abaixo do `is_default_evento`, com borda verde e icone `Car`:
- Titulo: "Usar como padrao para Termo de Saida de Evento"
- Descricao: "Este template sera usado para gerar o Termo de Saida de Veiculo quando uma Ordem de Servico de reparo de sinistro for concluida. Apenas um template pode ser marcado."
- Campo: `is_default_saida: z.boolean().default(false)` no schema Zod

### 3. useDocumentoTemplates.ts

Adicionar `is_default_saida?: boolean` em:
- `TemplateFromDB` (linha 35)
- `DocumentoTemplateView` (linha 65)
- `transformTemplate` (linha 88)
- `CreateTemplateInput` (linha 169)
- `UpdateTemplateInput` (linha 231)
- `useCreateTemplate` insert (linha 196)
- `useUpdateTemplate` update (linha 257)

### 4. Edge function autentique-os-saida-create

Antes da busca por `document_type_id` (linhas 99-113), adicionar:

```typescript
// Priorizar template marcado como default para saida
const { data: templateSaida } = await supabase
  .from("documento_templates")
  .select("id, codigo, nome, conteudo")
  .eq("is_default_saida", true)
  .eq("ativo", true)
  .maybeSingle();

if (templateSaida?.conteudo) {
  templateConteudo = templateSaida.conteudo;
  templateNome = templateSaida.nome;
} else if (docType) {
  // fallback existente...
}
```

### 5. OSConclusaoModal - Botao "Liberar Veiculo"

Quando `assinado === true`, alem do botao de visualizar PDF, exibir:

```typescript
// Botao "Liberar Veiculo" com confirmacao
<Button className="w-full" variant="default" onClick={handleLiberarVeiculo}>
  <Car className="mr-2 h-4 w-4" />
  Liberar Veiculo
</Button>
```

A funcao `handleLiberarVeiculo`:
1. Confirma via `window.confirm`
2. Atualiza OS para status `finalizado` (ou o equivalente no sistema)
3. Se a OS possui sinistro vinculado (`os.sinistro_id`), atualiza o sinistro para status `encerrado`
4. Registra historico em ambas as tabelas
5. Invalida queries e fecha o modal
6. Exibe toast de sucesso

```typescript
const handleLiberarVeiculo = async () => {
  if (!window.confirm('Confirma a liberacao do veiculo? O sinistro e a OS serao encerrados.')) return;
  
  setLiberando(true);
  try {
    // 1. Finalizar OS
    await supabase.from('ordens_servico').update({
      status: 'finalizado',
      updated_at: new Date().toISOString(),
    }).eq('id', os.id);

    // 2. Encerrar sinistro vinculado
    if (os.sinistro_id) {
      await supabase.from('sinistros').update({
        status: 'encerrado',
        updated_at: new Date().toISOString(),
      }).eq('id', os.sinistro_id);
      
      // Historico sinistro
      await supabase.from('sinistros_historico').insert({
        sinistro_id: os.sinistro_id,
        status_novo: 'encerrado',
        observacao: 'Veiculo liberado apos assinatura do Termo de Saida',
      });
    }

    // 3. Historico OS
    await supabase.from('ordens_servico_historico').insert({
      ordem_servico_id: os.id,
      status_novo: 'finalizado',
      observacao: 'Veiculo liberado - Termo de Saida assinado',
    });

    queryClient.invalidateQueries({ queryKey: ['ordem_servico'] });
    queryClient.invalidateQueries({ queryKey: ['sinistros'] });
    toast.success('Veiculo liberado! Sinistro e OS encerrados.');
    onOpenChange(false);
  } catch (err) {
    toast.error('Erro ao liberar veiculo');
  } finally {
    setLiberando(false);
  }
};
```
