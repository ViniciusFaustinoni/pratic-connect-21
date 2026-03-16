

## Plano: Template Meta + Envio WhatsApp do Link de Assinatura Autentique

### Contexto

Atualmente, quando um documento é criado no Autentique (contrato, vistoria, sinistro), o associado recebe o link de assinatura **apenas por email** (enviado automaticamente pelo Autentique). O pedido é:

1. Criar um template Meta com botão de URL dinâmica para o link de assinatura
2. Enviar via WhatsApp no **mesmo momento** em que o documento é criado no Autentique
3. Usar a mutation `createLinkToSignature` da API Autentique para gerar o `short_link` exclusivo do signatário

### Análise

As Edge Functions `autentique-create`, `autentique-create-by-token`, `autentique-evento-create` e `autentique-vistoria-create` já recebem o `short_link` na resposta do `createDocument` (via `document.signatures[0].link.short_link`). Portanto, **não é necessário** chamar `createLinkToSignature` separadamente — o link já está disponível.

O envio via WhatsApp será adicionado diretamente nessas funções, logo após a criação bem-sucedida do documento.

### Edições

**1. Inserir template Meta na tabela `whatsapp_meta_templates`**

Template `assinatura_documento` com botão de URL dinâmica:

```
Corpo:
Olá {{1}}! 📄

Você tem um documento pendente de assinatura:
📋 *{{2}}*

Clique no botão abaixo para assinar digitalmente. É rápido e seguro!

Equipe PRATIC 🛡️

Botão: [Assinar Agora] → URL: https://assina.ae/{{1}}
```

Variáveis: `1=nome`, `2=nome_documento`, botão `1=código_link`

**2. Modificar `autentique-create/index.ts`**

Após criar o documento e obter `signatureLink`, disparar WhatsApp:
- Buscar telefone do associado (já disponível no contrato)
- Chamar `whatsapp-send-text` com template `assinatura_documento`
- Extrair o código do link (`short_link` sem o domínio) para o botão dinâmico
- Tratamento fire-and-forget (não falha se WhatsApp der erro)

**3. Modificar `autentique-create-by-token/index.ts`**

Mesma lógica — enviar WhatsApp após criação do documento.

**4. Modificar `autentique-evento-create/index.ts`**

Mesma lógica para termos de sinistro.

**5. Modificar `autentique-vistoria-create/index.ts`**

Mesma lógica para termos de vistoria (buscar telefone do cliente nos params ou no banco).

### Lógica comum (adicionada em cada função)

```typescript
// Enviar link de assinatura via WhatsApp (fire-and-forget)
if (signatureLink && telefone) {
  try {
    const linkCode = signatureLink.replace('https://assina.ae/', '');
    await supabase.functions.invoke('whatsapp-send-text', {
      body: {
        telefone,
        template_name: 'assinatura_documento',
        params: [nomeCliente, nomeDocumento],
        button_params: [linkCode],
      }
    });
  } catch (err) {
    console.error('[fn] Erro ao enviar WhatsApp assinatura:', err);
  }
}
```

### Template Meta a ser submetido

O template precisa ser criado na Meta com botão do tipo URL dinâmica. Será inserido no banco com status `PENDING` para posterior aprovação pela Meta.

### Resultado

- Associado recebe email (Autentique) + WhatsApp (template Meta) simultaneamente
- O link é o mesmo em ambos os canais
- Se o WhatsApp falhar, o fluxo não é interrompido

