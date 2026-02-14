
# Revisao FINAL: Atualizacoes Diarias, Conclusao, Retirada, Garantia e Timeline

## Resultado da Verificacao Completa

### 1. Atualizacao Diaria Obrigatoria

| Item | Status |
|---|---|
| Botao "Registrar Atualizacao" em cada card | OK (linha 390) |
| Upload fotos: min 2, max 10, obrigatorio | OK (dropzone, slice(0,10), canSave: fotos >= 2) |
| Upload video: opcional | OK |
| Descricao (textarea, obrigatorio) | OK (canSave: descricao.trim().length > 0) |
| Toggle "etapa concluida?" so se ha etapa | OK (condicao `etapaAtual &&`) |
| Problemas: tipo + descricao | OK |
| **"Aguardando peca" muda status da OS** | **FALTANDO -- select option existe mas nao atualiza status para aguardando_peca** |
| Botao salvar so habilita com 2+ fotos E descricao | OK |
| **NAO pode avancar etapa sem fotos** | **BUG -- concluirEtapa pode ser true mesmo com 0 fotos (canSave bloqueia salvar, mas a mensagem especifica nao existe)** |
| Badge verde "Atualizado" / vermelho "Pendente!" | OK (linhas 313-317) |
| **Apos 17h, IA alerta regulador** | **FALTANDO -- nao existe cron/logica para alertar regulador** |

### 2. Mensagens da IA por Etapa Concluida

| Item | Status |
|---|---|
| Lanternagem: mensagem personalizada | OK |
| Pintura: mensagem personalizada | OK |
| Mecanica: mensagem personalizada | OK |
| Eletrica: mensagem personalizada | OK |
| Polimento: mensagem personalizada | OK |
| Lavagem (especial): "OTIMA NOTICIA!" | OK |
| Mensagens usam nome, placa e proxima etapa | OK |

### 3. Vistoria Presencial do Regulador

| Item | Status |
|---|---|
| Botao separado "Vistoria" | OK |
| Grava 1 video (ate 3 min) | OK (timer 179s) |
| Salvo no Supabase Storage | OK (sinistro-eventos bucket) |
| Video INTERNO (associado nao ve) | OK (nao aparece em paginas publicas) |
| Registra data, hora e GPS | OK (created_at + lat/long) |
| Aparece na timeline da OS | OK (os_vistorias_presenciais na TimelineEventoTab) |

### 4. Conclusao do Reparo

| Item | Status |
|---|---|
| Ao concluir ultima etapa: status "concluido" | OK (isUltimaEtapa -> status = concluido) |
| Data/hora de conclusao registrada | OK (data_conclusao_real) |
| **Tempo total em oficina calculado** | **PARCIAL -- calculado na pagina de retirada, mas nao salvo na OS no momento da conclusao** |
| **30 min depois: IA envia WhatsApp com Link 3** | **BUG -- link e enviado IMEDIATAMENTE (sem delay de 30min)** |

### 5. Link de Retirada (Link 3)

| Item | Status |
|---|---|
| Link unico, expiravel (72h), validado por token | OK |
| Logo, "Veiculo pronto!", placa/marca/modelo | OK |
| Oficina + endereco + "Ver no Mapa" | OK |
| Resumo das etapas com datas de conclusao | OK |
| Tempo total em oficina | OK (calculado no frontend) |
| Data (preenchida com hoje, editavel) | OK |
| Observacoes (opcional) | OK |
| Checkbox "Recebi em perfeitas condicoes" | OK |
| Checkbox "Ciente da garantia de 90 dias" | OK |
| Assinatura digital (canvas) | OK |
| Botao "Confirmar Retirada" | OK |
| Ao confirmar: OS "entregue", Sinistro "em_garantia", inicia 90d | OK (confirmar-retirada edge function) |
| IA envia mensagem final sobre garantia | OK |
| **Se nao retirar em 7 dias: lembretes diarios** | **FALTANDO -- nao existe logica de lembrete** |

### 6. Garantia de 90 Dias

| Item | Status |
|---|---|
| Periodo de 90 dias contados da data de retirada | OK (confirmar-retirada calcula garantia_ate) |
| Alerta no painel: garantias vencendo em 7 dias | OK (badge vermelho se diasRestantes <= 7) |
| **Possibilidade de abrir "retorno de garantia"** | **FALTANDO -- nao existe funcionalidade** |
| **Dano pertinente volta a oficina sem custo** | **FALTANDO** |
| **Dano nao pertinente negado** | **FALTANDO** |

### 7. Timeline Completa do Evento

| Item | Status |
|---|---|
| 1. Data/hora do evento | OK |
| 2. Data/hora comunicacao | OK |
| **3. Tempo entre evento e comunicacao** | **FALTANDO** |
| 4. Envio do link 1 | OK (sinistro_evento_links) |
| **5. Conclusao de cada etapa do link (fotos, BO, relato)** | **FALTANDO -- so mostra link enviado, nao detalha etapas** |
| **6. Agendamento da vistoria** | **PARCIAL -- mostra vistoria, mas nao o agendamento separado** |
| 7. Vistoria do regulador | OK |
| 8. Analise (aprovacao/reprovacao) | OK (via sinistro_historico) |
| **9. Envio do link 2 (pagamento)** | **FALTANDO -- nao diferencia link 2** |
| **10. Pagamento confirmado** | **FALTANDO -- nao busca cota_paga_em** |
| **11. Envio do termo (Autentique)** | **FALTANDO -- nao busca termo_anuencia_criado_em** |
| **12. Assinatura do termo** | **FALTANDO -- nao busca termo_anuencia_assinado_em** |
| **13. Atribuicao de fornecedores** | **FALTANDO -- nao busca oficina/prestadores atribuidos** |
| **14. Envio de cotacoes para auto centers** | OK (evento_cotacoes_pecas) |
| 15. Cotacao aprovada | OK |
| 16. Geracao da OS | OK |
| 17. Entrada na oficina | OK |
| 18. Cada etapa concluida | OK (os_atualizacoes_diarias) |
| 19. Cada atualizacao diaria | OK |
| 20. Cada vistoria presencial | OK |
| 21. Conclusao do reparo | OK |
| 22. Retirada pelo associado | OK |
| 23. Inicio da garantia | OK |
| **Itens clicaveis para ver detalhes (fotos, videos)** | **FALTANDO -- timeline nao e clicavel** |

---

## 8 Correcoes Necessarias

### Correcao 1 — "Aguardando peca" deve mudar status da OS

**Arquivo:** `src/components/sinistros/RegistrarAtualizacaoDialog.tsx`

Quando o problema "Aguardando peca" e selecionado e o formulario salvo, o status da OS deve ser atualizado para `aguardando_peca`. Adicionar apos a insercao da atualizacao:

```text
if (temProblema && tipoProblema === 'Aguardando peça') {
  await supabase.from('ordens_servico')
    .update({ status: 'aguardando_peca' as any, updated_at: new Date().toISOString() })
    .eq('id', ordemServico.id);
  await supabase.from('ordens_servico_historico').insert({
    ordem_servico_id: ordemServico.id,
    status_novo: 'aguardando_peca',
    observacao: descricaoProblema || 'Aguardando peça',
  });
}
```

### Correcao 2 — Impedir avancar etapa sem fotos (mensagem explicita)

**Arquivo:** `src/components/sinistros/RegistrarAtualizacaoDialog.tsx`

Embora o botao salvar ja exija 2+ fotos, o toggle de concluir etapa nao tem feedback especifico. Adicionar validacao visual:

```text
{concluirEtapa && fotos.length < 2 && (
  <p className="text-xs text-destructive">Registre a atualização com fotos antes de avançar a etapa</p>
)}
```

### Correcao 3 — Agendar link de retirada com delay de 30 minutos

**Arquivo:** `src/components/sinistros/RegistrarAtualizacaoDialog.tsx`

Atualmente o link e gerado imediatamente na conclusao (linha 141). Alterar para agendar via `sinistro_contatos_agendados` com `agendado_para = now + 30min` e `mensagem_enviada` pre-preenchida. O cron-contato-sinistro ja suporta mensagens pre-definidas (correcao anterior).

Alternativa mais simples: manter a geracao imediata do link (token criado na hora) mas agendar o ENVIO da mensagem WhatsApp para 30min depois. Como o token ja fica salvo na OS, basta:
1. No `gerar-link-retirada`, NAO enviar WhatsApp imediatamente
2. Em vez disso, inserir na `sinistro_contatos_agendados` com delay de 30min

**Arquivo principal:** `supabase/functions/gerar-link-retirada/index.ts` -- remover envio direto de WhatsApp e agendar na tabela.

### Correcao 4 — Timeline: adicionar pontos faltantes (pagamento, termo, tempo, fornecedores)

**Arquivo:** `src/components/sinistros/TimelineEventoTab.tsx`

Adicionar ao queryFn:

1. **Tempo entre evento e comunicacao**: calcular diferenca entre `data_ocorrencia` e `created_at` e exibir como descricao do item "Comunicacao registrada"
2. **Pagamento confirmado**: buscar `cota_paga_em` do sinistro e adicionar item
3. **Termo enviado e assinado**: buscar `termo_anuencia_criado_em` e `termo_anuencia_assinado_em`
4. **Atribuicao de fornecedores**: buscar `oficina_id`, `auto_center_id` do sinistro quando preenchidos (via sinistro_historico com observacao contendo "oficina" ou "fornecedor")
5. **Link 2 diferenciado**: os links do tipo `sinistro_evento_links` ja tem campo `tipo` -- garantir que Link 2 (pos-aprovacao) apareca separado

### Correcao 5 — Lembretes diarios se nao retirar em 7 dias

**Arquivo:** `supabase/functions/gerar-link-retirada/index.ts`

Apos gerar o link, agendar lembretes diarios (dias 1 a 7) na tabela `sinistro_contatos_agendados`. Cada agendamento tera `mensagem_enviada` pre-preenchida com "Lembrete: seu veiculo esta pronto para retirada". O cron existente processara automaticamente.

Alternativa: adicionar logica ao cron-contato-sinistro para buscar OS com status "concluido" ha mais de 24h sem retirada e enviar lembrete. Isso e mais eficiente do que criar 7 registros.

**Recomendacao:** Adicionar ao `cron-contato-sinistro` uma verificacao de OS concluidas com `data_conclusao_real` > 24h e `status != 'entregue'` para enviar 1 lembrete/dia.

### Correcao 6 — Retorno de garantia (funcionalidade nova minima)

**Arquivo:** `src/pages/regulador/ReguladorOficina.tsx`

Na secao "Garantias Ativas", adicionar botao "Abrir Retorno" em cada garantia. Ao clicar:
1. Abrir dialog com opcoes: "Dano pertinente" (volta a oficina) ou "Dano nao pertinente" (negado)
2. Se pertinente: criar nova OS vinculada a OS original com status `aguardando_entrada` e flag `retorno_garantia = true`
3. Se nao pertinente: registrar no historico da OS original como "Retorno de garantia negado"

Nota: isso requer uma coluna `retorno_garantia_os_id` (uuid nullable FK) na tabela `ordens_servico` para vincular a OS de retorno a original.

### Correcao 7 — Alerta as 17h para veiculos nao atualizados

Isso requer um cron job que rode as 17h (horario de Brasilia). A abordagem mais pratica: adicionar ao `cron-contato-sinistro` existente uma verificacao especifica para o horario.

Porem, o cron roda a cada minuto. Adicionar condicao:

```text
const agora = new Date();
const horaBrasilia = agora.getUTCHours() - 3; // simplificado
if (horaBrasilia === 17 && agora.getUTCMinutes() === 0) {
  // Buscar OS em_execucao sem atualizacao hoje
  // Enviar alerta ao regulador (notificacao interna ou WhatsApp)
}
```

**Abordagem mais robusta:** Criar cron separado `cron-alerta-atualizacao-oficina` que rode 1x/dia as 17h (BRT) e envie notificacao ao regulador para cada OS em_execucao sem registro em `os_atualizacoes_diarias` no dia.

**Recomendacao:** Adicionar logica simples ao cron existente (nao criar novo edge function, conforme instrucao de "nao criar nada novo"). Usar flag de hora para executar apenas as 17h.

### Correcao 8 — Timeline clicavel (expandir detalhes)

**Arquivo:** `src/components/sinistros/TimelineEventoTab.tsx`

Tornar cada item da timeline clicavel para expandir detalhes. Para itens com fotos (atualizacoes diarias), exibir as imagens. Para vistorias, exibir o video.

Adicionar:
1. Campo `fotos_urls` e `video_url` na query de `os_atualizacoes_diarias`
2. Campo `video_url` na query de `os_vistorias_presenciais`
3. Estado `expandedId` para controlar qual item esta expandido
4. Ao clicar: mostrar fotos em grid e/ou link do video

---

## Arquivos Afetados

| Acao | Arquivo |
|---|---|
| Modificar | `src/components/sinistros/RegistrarAtualizacaoDialog.tsx` -- status aguardando_peca + msg etapa sem fotos |
| Modificar | `supabase/functions/gerar-link-retirada/index.ts` -- agendar envio com 30min delay em vez de envio imediato |
| Modificar | `src/components/sinistros/TimelineEventoTab.tsx` -- adicionar pontos faltantes + tornar clicavel |
| Modificar | `src/pages/regulador/ReguladorOficina.tsx` -- botao retorno garantia + dialog |
| Modificar | `supabase/functions/cron-contato-sinistro/index.ts` -- alerta 17h + lembretes retirada |
| Migracao | Adicionar coluna `retorno_garantia_os_id uuid references ordens_servico(id)` na tabela `ordens_servico` |
