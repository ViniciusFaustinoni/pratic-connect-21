

# Sincronizar templates da Meta que não existem no banco local

## Problema
A ação `sincronizar` (linhas 48-83 de `whatsapp-meta-templates/index.ts`) apenas faz `UPDATE ... WHERE nome = mt.name`. Templates que existem na Meta mas **não** existem no banco local são silenciosamente ignorados -- nunca são inseridos.

## Solução

Alterar a lógica de sincronização para:
1. Buscar templates da Meta (como já faz)
2. Para cada template da Meta, tentar UPDATE pelo nome
3. Se o UPDATE não afetou nenhuma linha (template novo), fazer INSERT com os dados extraídos da resposta da Meta

### Alteração em `supabase/functions/whatsapp-meta-templates/index.ts`

Na seção `sincronizar` (linhas 62-75), substituir o loop por:

```typescript
for (const mt of metaTemplates) {
  // Tentar atualizar existente
  const { data: updated } = await supabase
    .from("whatsapp_meta_templates")
    .update({
      status: mt.status?.toUpperCase() || "PENDING",
      meta_template_id: mt.id,
      motivo_rejeicao: mt.rejected_reason || null,
      aprovado_em: mt.status === "APPROVED" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("nome", mt.name)
    .select("id");

  if (updated && updated.length > 0) {
    atualizados++;
  } else {
    // Template existe na Meta mas não no banco — inserir
    // Extrair corpo e botões dos componentes
    const bodyComp = mt.components?.find(c => c.type === "BODY");
    const headerComp = mt.components?.find(c => c.type === "HEADER");
    const footerComp = mt.components?.find(c => c.type === "FOOTER");
    const buttonsComp = mt.components?.find(c => c.type === "BUTTONS");

    let botoes = null;
    if (buttonsComp?.buttons) {
      botoes = buttonsComp.buttons.map(b => ({
        tipo: b.type?.toLowerCase(),
        texto: b.text || "",
        url: b.url || "",
        telefone: b.phone_number || "",
      }));
    }

    const { error: insertErr } = await supabase
      .from("whatsapp_meta_templates")
      .insert({
        nome: mt.name,
        categoria: mt.category || "UTILITY",
        idioma: mt.language || "pt_BR",
        status: mt.status?.toUpperCase() || "PENDING",
        meta_template_id: mt.id,
        header_tipo: headerComp ? headerComp.format?.toLowerCase() : "none",
        header_texto: headerComp?.text || null,
        corpo: bodyComp?.text || "",
        rodape: footerComp?.text || null,
        botoes: botoes,
        motivo_rejeicao: mt.rejected_reason || null,
        aprovado_em: mt.status === "APPROVED" ? new Date().toISOString() : null,
      });

    if (!insertErr) novos++;
  }
}
```

Adicionar contador `novos` e retornar no response.

### Resultado
- Ao clicar "Sincronizar", templates que existem na Meta mas não no banco serão automaticamente inseridos
- Templates já existentes continuam sendo atualizados normalmente
- O toast mostrará "X atualizados, Y novos importados"

