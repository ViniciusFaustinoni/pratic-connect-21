

## Plano: Ativar `new_signature_style` e posicionamento de rubricas em todos os documentos Autentique

### Diagnóstico

O código em `autentique-positions.ts` já gera corretamente as posições com `INITIALS` em todas as páginas e `SIGNATURE` na última. Porém, **nenhuma** edge function envia `new_signature_style: true` no objeto `document`. Conforme a documentação oficial da Autentique, essa flag é necessária para que os campos posicionados (INITIALS, SIGNATURE) sejam habilitados. Sem ela, o Autentique ignora as posições e usa o fluxo padrão de assinatura simples.

### Alteração

Adicionar `new_signature_style: true` ao objeto `document` em **todas** as 7 edge functions que criam documentos:

| Edge Function | Linha (approx) | Alteração |
|---|---|---|
| `autentique-create` | 776-778 | `{ name: documentName }` → `{ name: documentName, new_signature_style: true }` |
| `autentique-create-by-token` | 609 | idem |
| `autentique-evento-create` | 410 | idem |
| `autentique-cancelamento-create` | 223 | idem |
| `autentique-os-saida-create` | 389 | idem |
| `autentique-create-laudo` | 124-126 | idem |
| `autentique-vistoria-create` | 293-295 | idem |

**Nota**: `autentique-documento` (linha 51) usa inline GraphQL sem variáveis — será atualizado para incluir `new_signature_style: true` no objeto document inline.

### Resultado
- O Autentique exibirá campos de rubrica (INITIALS) em todas as páginas do documento
- Na última página, exibirá o campo de assinatura completa (SIGNATURE)
- O signatário será solicitado a fornecer tanto a rubrica quanto a assinatura ao assinar

### Deploy
Todas as 7+ edge functions serão redeployadas após a alteração.

