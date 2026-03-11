
Objetivo
Corrigir o Erro 1: mensagem enviada ao associado com nomes invertidos no momento da atribuição de tarefa.

Diagnóstico (confirmado no código e dados)
1) Em `supabase/functions/atribuir-proxima-tarefa/index.ts`, a notificação de WhatsApp do profissional usa o template `assistencia_confirmada` (template de cliente), com estes parâmetros:
- `{{1}} = nome do vistoriador`
- `{{2}} = "Instalação - {nome do associado}"`
Isso gera exatamente o texto reportado (“Olá [Vistoriador] ... prestador Instalação - [Associado] ...”).

2) Esse envio é feito para o telefone do profissional, mas se cliente e profissional estiverem com o mesmo número (cenário de teste comum), o associado recebe essa mensagem errada e parece “nome trocado”.

3) A notificação correta do associado já existe (tipo `tecnico_em_rota` via `notificar-cliente`), mas o fluxo do profissional está semanticamente incorreto por reutilizar template de cliente.

Plano de implementação
1) Ajustar notificação do profissional em `atribuir-proxima-tarefa`
- Remover uso de `assistencia_confirmada` para o profissional.
- Trocar por:
  - template próprio `tarefa_vistoriador` quando estiver aprovado, ou
  - fallback para texto (`allow_text: true`) com a mensagem detalhada já montada no código.
- Resultado: o profissional não recebe mais texto “seu pedido de assistência foi confirmado”.

2) Adicionar proteção de destinatário (anti-confusão / anti-vazamento)
- Normalizar telefones de cliente e profissional.
- Se forem iguais, não disparar a mensagem “de profissional” para WhatsApp (manter push já existente).
- Logar evento com motivo (`telefone_profissional_igual_cliente`) para auditoria.

3) Reforçar mapeamento da notificação do associado (consistência de nomes)
- Garantir que o payload do associado continue:
  - nome saudação = associado
  - nome prestador/técnico = vistoriador
- Validar que não existe inversão de campos ao montar `dados.tecnico_nome`.

Validação (fim a fim)
1) Cenário A (telefones diferentes)
- Atribuir tarefa.
- Associado recebe mensagem com:
  - saudação do associado
  - técnico/vistoriador correto.
- Profissional recebe tarefa com dados do cliente (sem template de cliente).

2) Cenário B (telefones iguais)
- Atribuir tarefa.
- Não enviar mensagem de profissional por WhatsApp para evitar confusão.
- Confirmar push para profissional e mensagem correta do associado.

3) Conferência técnica
- Consultar `whatsapp_mensagens` após teste e validar:
  - não há mensagem “assistencia_confirmada” no fluxo do profissional com parâmetros invertidos;
  - há mensagem correta para associado no evento de atribuição.

Arquivos previstos para alteração
- `supabase/functions/atribuir-proxima-tarefa/index.ts`
(opcional, apenas se necessário para consistência do fluxo do associado)
- `supabase/functions/notificar-cliente/index.ts`

Detalhes técnicos
- Regra principal: template de cliente não deve ser reutilizado para comunicação operacional de profissional.
- Fallback sugerido:
  - tentar template profissional aprovado (`tarefa_vistoriador`);
  - se indisponível/não aprovado, usar `allow_text: true` com texto operacional.
- Guard de segurança:
  - `normalizePhone(telefone).replace(/\D/g, '')`
  - `if (telProf === telAssoc) skip envio WhatsApp profissional`.
