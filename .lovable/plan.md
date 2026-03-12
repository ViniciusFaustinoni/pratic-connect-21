
Diagnóstico definitivo (raiz)
- O template foi recriado em rascunho, mas o corpo salvo não inclui o link explícito (só menciona “acesse o botão”).
- Além disso, o JSON de `botoes` foi salvo no formato `type/text` (estilo Meta API), enquanto o app/função usam `tipo/texto`. Isso pode ocultar/quebrar o link no editor e no envio.

Plano de correção
1) Corrigir o registro `boas_vindas_associado_v2` no banco (UPDATE de dados)
- Atualizar `corpo` para incluir o link dentro da mensagem antes do envio para aprovação.
- Para manter link dinâmico e funcional, o corpo passará a usar uma 5ª variável:
  - `🔗 Link direto de acesso: {{5}}`
- Normalizar `botoes` para o padrão do app:
  - `[{ "tipo":"url", "texto":"📱 Criar Conta no App", "url":"https://pratic-connect-21.lovable.app/primeiro-acesso?id={{1}}" }]`
- Atualizar `variaveis_exemplo` incluindo a variável `5` com URL de exemplo.
- Manter status em `DRAFT`.

2) Ajustar os callers que enviam o template (para casar com 5 vars no corpo + 1 var no botão)
- `supabase/functions/ativar-associado/index.ts`
  - Enviar `template_params` com 6 itens:
    1 nome, 2 veículo, 3 cobertura, 4 próximo passo, 5 link completo, 6 id para botão.
- `supabase/functions/notificar-cliente/index.ts`
  - Atualizar todos os `getParams()` que usam `boas_vindas_associado_v2` para também enviar o link completo como 5º parâmetro de corpo.

3) Blindagem de compatibilidade (evitar regressão)
- `supabase/functions/whatsapp-meta-templates/index.ts`
  - Aceitar ambos os formatos de botão ao montar payload (`tipo/texto` e `type/text`) para não quebrar se houver legado.
- `src/components/integracoes/WhatsAppMetaTemplateDrawer.tsx`
  - Normalizar ao carregar template (se vier `type/text`, converter para `tipo/texto` no estado local).

4) Validação final (fim a fim)
- Abrir template no drawer e confirmar que o corpo mostra o link explícito.
- Confirmar que o botão URL aparece corretamente.
- Clicar “Enviar” e validar que foi para `PENDING` sem erro de estrutura.
- Após aprovação Meta, disparar teste real e confirmar que mensagem chega com:
  - link no corpo (variável 5) + botão dinâmico funcional.

Detalhes técnicos (resumo)
- Mudança principal: estrutura de variáveis do template de “4 corpo + 1 botão” para “5 corpo + 1 botão”.
- Benefício: resolve sua exigência de “link dentro da mensagem” sem perder o CTA por botão.
- Correção complementar crítica: padronização de `botoes` evita que o link “desapareça” no editor/envio.
