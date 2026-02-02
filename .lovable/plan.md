
# Plano: Exibir Botão de Contato do Vendedor no PDF

## Problema Identificado

O botão de WhatsApp não aparece no PDF porque a coluna `whatsapp` na tabela `profiles` está **vazia (null)** para todos os vendedores.

```
Consulta no banco:
| nome               | whatsapp |
|--------------------|----------|
| ALINE DE SOUZA     | null     |
| DB CAR RIO         | null     |
| DIEGO PEREIRA      | null     |
| ... (todos null)   | null     |
```

O código atual em `BotaoGerarPdf.tsx` só adiciona os dados do vendedor se `whatsapp` estiver preenchido:
```typescript
vendedor: cotacao.profiles?.whatsapp ? { nome, whatsapp } : null
```

## Solução

### 1. Permitir edição do WhatsApp no perfil do vendedor

Verificar se existe um campo para o vendedor cadastrar seu WhatsApp no sistema e, se não existir, adicionar.

### 2. Alternativa: Usar telefone do vendedor como fallback

Se o campo telefone do vendedor existir, usar como fallback quando WhatsApp não estiver preenchido.

---

## Próximos Passos

1. Verificar a página de perfil do usuário para adicionar/editar campo WhatsApp
2. Popular os WhatsApps existentes (ex: via SQL ou formulário)
3. Ajustar a lógica para usar telefone como fallback se necessário

---

## Pergunta

Para o botão de WhatsApp aparecer, preciso de uma das seguintes ações:

**Opção A**: Adicionar um campo no perfil do vendedor para ele cadastrar seu WhatsApp

**Opção B**: Usar o telefone do vendedor como número de WhatsApp (se existir)

**Opção C**: Popular manualmente os WhatsApps via SQL para os vendedores

Qual abordagem você prefere?
