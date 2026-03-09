

# Template de Boas-Vindas com Botão URL Dinâmico

## Contexto

O template `boas_vindas_associado` atual é simples (nome + placa), sem link de acesso. O `cadastro_aprovado` foi rejeitado por conflito de nome. O sistema precisa de um template novo com botão URL dinâmico para o associado acessar o app.

## Formato do Template para a Meta

A Meta tem regras rígidas: emojis em excesso e links no corpo causam rejeição. O formato ideal é:

- **Categoria**: UTILITY
- **Nome**: `ativacao_conta_pratic`
- **Corpo** (com variáveis):
```
Parabéns {{1}}! Seu cadastro na PRATIC foi aprovado!

Veículo Protegido: {{2}}
Cobertura Ativa: {{3}}

Acesse o botão abaixo para criar sua senha e acessar o App PRATIC.
```
- **Rodapé**: `PRATIC - Proteção Veicular`
- **Botão**: Tipo URL — texto "Acessar meu App" — URL `https://pratic-connect-21.lovable.app/app/login/{{1}}`

As variáveis do corpo: `{{1}}` = nome, `{{2}}` = placa + modelo, `{{3}}` = cobertura.
O `{{1}}` do botão URL = token/path dinâmico (diferente das variáveis do corpo).

## Alterações

### 1. `whatsapp-send-text/index.ts` — Suporte a `template_button_params`

Na função `enviarViaMeta`, após montar os `components` de body (linha 140), adicionar suporte ao novo parâmetro:

```typescript
// Após body parameters
const templateButtonParams = body.template_button_params;
if (templateButtonParams?.length > 0) {
  templateButtonParams.forEach((param: string, index: number) => {
    components.push({
      type: "button",
      sub_type: "url",
      index,
      parameters: [{ type: "text", text: param }],
    });
  });
}
```

Aceitar `template_button_params` no body do request (linha ~245) e passá-lo para `enviarViaMeta`.

### 2. `ativar-associado/index.ts` — Usar novo template com botão

Na seção de envio WhatsApp (linhas 226-268), trocar de `boas_vindas_associado` para `ativacao_conta_pratic`:

- Buscar dados do veículo (placa + modelo)
- Buscar cobertura/plano do associado
- Enviar com `template_params` = [nome, "PLACA - Modelo", "Cobertura"]
- Enviar com `template_button_params` = [associado.id ou token de acesso]

O link do botão ficaria: `https://pratic-connect-21.lovable.app/app/login/{associado_id}`

### 3. Inserir template no banco (`whatsapp_meta_templates`)

Inserir via SQL (insert tool) o rascunho do template com:
- nome: `ativacao_conta_pratic`
- categoria: `UTILITY`
- corpo com as 3 variáveis
- botões com URL dinâmica
- status: `DRAFT`

Após inserido, o admin pode enviar para aprovação da Meta pelo painel existente.

## Arquivos

| Arquivo | Alteração |
|---|---|
| `supabase/functions/whatsapp-send-text/index.ts` | Aceitar `template_button_params` e montar componentes button/url |
| `supabase/functions/ativar-associado/index.ts` | Usar template `ativacao_conta_pratic` com botão dinâmico |
| BD: `whatsapp_meta_templates` | Inserir rascunho do template |

