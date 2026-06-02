## Auditoria — Relacionamento › Chat

Análise estática já feita. Plano abaixo descreve o que vou validar em runtime (queries read-only + logs do edge) antes de mexer em código. Sem alterações nesta etapa.

### Estado atual por item

**#1 — Número da IA no chat**
- `ConversasList.tsx` L132-140 mostra badge com `metaConfig.display_phone_number` no header "Conversas IA".
- Tem backfill silencioso via `useTestarMetaConexao` se o campo estiver vazio.
- **A validar:** se `whatsapp_meta_config.display_phone_number` está populado em produção (se vazio, badge não aparece).

**#2 — Botão "Concluir atendimento" durante interação humana**
- `ChatPanel.tsx` L348-365 — renderiza só quando `iaPausada && pausa` (qualquer pausa: transbordo humano, transbordo boleto, intervenção manual).
- Chama `useConcluirTransbordo` que reativa a IA.
- **A validar:** se aparece nos 3 motivos (`transbordo_humano`, `transbordo_boleto`, `intervencao_humana`).

**#3 — Entendimento de contexto da IA**
- `whatsapp-webhook/index.ts` L273 — system prompt instrui a IA a usar conteúdo+variáveis do template Meta para entender o assunto (instalação, vistoria, boleto, etc.) antes de responder.
- **A validar:** olhar 5–10 conversas recentes na `whatsapp_mensagens` p/ ver se respostas batem com o template enviado (ex.: cobrança, agendamento).

**#4 — Mensagem padrão de boas-vindas**
- Achei UMA mensagem de boas-vindas (L4139) — mas é **fallback de erro** quando o `agente-consultor-ia` falha. Não é boas-vindas canônica de primeiro contato.
- **A validar:** confirmar se existe (ou não) uma boas-vindas explícita no primeiro contato com associado conhecido — se o user esperava uma e não existe, fica como gap a implementar.

**#5 — Busca de boletos (2ª via SGA)**
- Fluxo canônico no system prompt L283-292: pede CPF → `buscar_associado_sga_por_cpf` → confirma placa → `consultar_boletos_sga_por_placa` → envia linha digitável + link + PIX, OU faz transbordo se vencido ≥6 dias.
- Tools registradas L729-770.
- **A validar:** invocar `consultar_boletos_sga_por_placa` direto via curl com placa de teste e verificar resposta; checar logs recentes do edge.

**#6 — Transbordo quando não for boleto**
- Tool `transbordo_atendimento_humano` (L757-770) tem enum `categoria=['boleto_vencido','outro']`. O caminho "outro" existe.
- Memória canônica diz que IA NUNCA promete ação humana sem chamar `solicitar_atendente_humano` na mesma rodada.
- **A validar:** ver últimos transbordos em `whatsapp_ia_pausas` filtrando `motivo='transbordo_humano'` p/ confirmar que está sendo disparado em casos não-boleto.

### Plano de validação (read-only, sem alterar nada)

1. **Query `whatsapp_meta_config`** → checar `display_phone_number` (item #1).
2. **Query `whatsapp_ia_pausas`** últimos 7 dias agrupado por motivo → confirmar que `transbordo_humano` (item #6) e `transbordo_boleto` (item #5) estão acontecendo, e que botão concluir (item #2) tem casos vivos.
3. **Curl `consultar_boletos_sga_por_placa`** com placa real de teste → confirma item #5 ponta a ponta.
4. **Logs edge `whatsapp-webhook`** últimas 24h filtrando por chamadas de tool → ver se IA usa contexto (item #3) e dispara as tools certas.
5. **Inspeção `whatsapp_mensagens`** das últimas 3-5 conversas que tiveram transbordo → confirmar se IA explicou antes de transferir (item #6) e se reconheceu o template (item #3).

### Entrega

Ao final da auditoria, devolvo um relatório curto por item: ✅ funcional, ⚠️ funcional com ressalva (ex.: campo vazio que precisa de backfill), ou ❌ quebrado (com causa raiz). Só depois dessa confirmação proponho correções específicas — uma por vez, conforme o padrão das levas anteriores.

**Nada de código será alterado nesta fase.** Confirma que posso rodar as queries/curl/logs?