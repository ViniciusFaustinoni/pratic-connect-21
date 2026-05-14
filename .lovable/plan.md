
## Causa raiz — Termo de Cancelamento (Troca KOU6D37) sem assinatura visível

O termo do KOU6D37 foi gerado pela edge function **`enviar-termo-cancelamento-troca`** (fluxo de troca de titularidade), não pela `autentique-cancelamento-create` que o cancelamento "padrão" usa.

Comparando com o padrão de **nova adesão** (`autentique-create`) e cancelamento direto (`autentique-cancelamento-create`):

| Edge function | `gerarPosicoesAssinatura()` (SIGNATURE/INITIALS nativos) |
|---|---|
| `autentique-create` (nova adesão) | ✅ |
| `autentique-cancelamento-create` (cancelamento direto) | ✅ |
| `autentique-os-saida-create` (saída de OS) | ✅ |
| `autentique-evento-create` (evento) | ✅ |
| `autentique-create-by-token` | ✅ |
| **`enviar-termo-cancelamento-troca`** | ❌ |
| **`enviar-termo-cancelamento-substituicao`** | ❌ |

Sem o array `positions` no `signer`, o Autentique não injeta o widget nativo de SIGNATURE — então:
1. Nada na visualização indica "assinado" depois que o associado conclui.
2. A imagem da assinatura não aparece em nenhuma página do PDF.

A imagem que você anexou confirma: o documento está renderizado, com botão "Opções" (ainda assinável), e o rodapé do template tem só o texto "ASSINATURA DO ASSOCIADO" (texto estático), sem o widget nativo. Esse é o sintoma exato de signer sem `positions`.

## Correção

Padronizar **todas** as gerações de documento Autentique para o mesmo padrão da nova adesão: signer com `positions: gerarPosicoesAssinatura(posConfig)` calculado via `estimarPaginasHTML(html)` + `buscarPosicoesConfig(supabase)`.

### Arquivos alterados

1. **`supabase/functions/enviar-termo-cancelamento-troca/index.ts`** (caso reportado)
   - Importar `gerarPosicoesAssinatura, buscarPosicoesConfig, estimarPaginasHTML` de `_shared/autentique-positions.ts`.
   - Após montar `html`, calcular `posConfig.totalPaginas = estimarPaginasHTML(html)`.
   - No `signerObj`, adicionar `positions: gerarPosicoesAssinatura(posConfig)` (manter `delivery_method: DELIVERY_METHOD_EMAIL` e `security_verifications: [{ type: 'PF_FACIAL' }]` — exigência do core memory de Autentique).

2. **`supabase/functions/enviar-termo-cancelamento-substituicao/index.ts`** (mesmo bug latente)
   - Aplicar a mesma mudança.

3. **Reenvio do termo do KOU6D37**
   - Após o deploy, chamar `enviar-termo-cancelamento-troca` com `force_resend: true` para a `solicitacao_id` do MARCOS VINICIUS DATIVO MACHADO. A função já deleta o doc anterior no Autentique e cria um novo — que dessa vez nascerá com o widget nativo. (Fica a seu cargo disparar via UI de "Reenviar termo" na tela da troca; ou eu posso disparar pelo edge se preferir.)

### Não vou tocar

- Templates de markdown (`TERMO_CANCELAMENTO_V1`) — eles continuam com texto "ASSINATURA DO ASSOCIADO" como fallback visual; o widget nativo do Autentique cai por cima na coordenada configurada.
- `autentique-cancelamento-create`, `autentique-create`, `autentique-evento-create`, `autentique-os-saida-create`, `autentique-create-by-token` — já estão no padrão correto.

### Validação

1. Reenviar termo do KOU6D37 → assinar → conferir no Autentique:
   - Status do documento muda para "Assinado" no painel.
   - PDF gerado mostra a imagem da assinatura na última página (e rubrica nas demais).
2. Disparar uma substituição de teste para validar `enviar-termo-cancelamento-substituicao`.
3. Memória a registrar (Core ou leaf): "Toda criação de documento Autentique DEVE usar `gerarPosicoesAssinatura` — sem isso o doc fica sem widget de assinatura mesmo após assinado."

### Riscos

- Posições padrão (`buscarPosicoesConfig` lê de `configuracoes`) podem cair em cima de texto do template. Já é o mesmo cálculo dos outros fluxos em produção, então o risco é baixo.
- `estimarPaginasHTML` adiciona +2 de margem; páginas inexistentes são ignoradas pela API — sem impacto.
