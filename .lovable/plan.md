

# Fases 3, 4 e 5 — Abas de Reparo, Portal Publico e Notificacoes

## Visao Geral

Com a Fase 1 (banco de dados) e Fase 2 (cadastro de terceiros) ja implementadas, agora implementaremos:

- **Fase 3**: Abas de reparo no detalhe do evento (analista)
- **Fase 4**: Portal publico do terceiro (link sem login)
- **Fase 5**: Notificacoes WhatsApp automaticas

---

## FASE 3: Abas de Reparo no Evento

### 3.1 Modificar `SinistroDetalhe.tsx`

Quando o sinistro tem terceiros (`tem_terceiro = true`), envolver a area de reparo (sidebar direita) com `Tabs` do Radix:

- Aba "Veiculo do Associado" — conteudo atual (CardControleReparo, CardOrcamentoReparo, TermoAssinaturaCard)
- Aba "Terceiro 1", "Terceiro 2", etc. — um componente `AbaTerceiroReparo` para cada

Quando nao tem terceiros: sem abas, tela identica a atual.

### 3.2 Novo componente `AbaTerceiroReparo.tsx`

Conteudo de cada aba de terceiro:

**Header com dados resumidos:**
- Nome, veiculo, placa
- Badges de culpa e status
- Limite de cobertura (consumido / disponivel)

**Condicoes por tipo de culpa:**
- `terceiro_culpado`: Card cinza "Sera feito regresso pos-evento", sem pipeline
- `a_definir`: Card amarelo "Fluxo bloqueado ate definicao de culpa"
- `associado_culpado` ou `compartilhada`: Pipeline completo

**Pipeline de status do terceiro (visual com etapas):**
Documentos -> Termo -> Oficina -> [Acordo] -> Regulagem -> Orcamento -> Pecas -> Reparo -> Entrega

**Acoes do analista:**
- Validar/rejeitar documentos (dialog com preview + motivo)
- Propor acordo (modal com valor + justificativa)
- Atualizar status manualmente
- Enviar lembrete WhatsApp
- Botao "Copiar link do portal"

### 3.3 Novo componente `ValidarDocumentosTerceiroDialog.tsx`

Dialog para o analista revisar cada documento enviado pelo terceiro:
- Preview da imagem/PDF
- Botoes Aprovar / Rejeitar (com campo motivo)
- Ao aprovar todos obrigatorios: atualiza status para `documentacao_enviada`

### 3.4 Novo componente `ProporAcordoModal.tsx`

Modal para o analista propor acordo:
- Campo valor (R$)
- Campo justificativa (textarea)
- Ao salvar: atualiza `acordo_valor`, `acordo_justificativa`, `acordo_status = 'proposto'`, status do terceiro para `acordo_proposto`

### 3.5 Novo componente `CardLimitesTerceiros.tsx`

Card fixo no topo da aba do terceiro mostrando:
- Limite total do plano
- Orcamento de cada terceiro
- Total consumido / disponivel
- Alerta de excedente se ultrapassar
- Cota do associado (valor, status paga/pendente, dobrada se aplicavel)

### 3.6 Hook `useAtualizarStatusTerceiro`

Mutation para atualizar o status de um terceiro no banco, com invalidacao de cache.

---

## FASE 4: Portal Publico do Terceiro

### 4.1 Nova rota em `App.tsx`

```text
/terceiro/:token -> PortalTerceiro.tsx
```

Rota publica, sem layout autenticado (mesmo padrao de `/evento/:token`).

### 4.2 Edge Function `validar-link-terceiro`

Seguindo o padrao de `validar-link-evento`:

- Recebe `{ token }` no body
- Busca em `sinistro_terceiros` pelo token
- Valida se o sinistro vinculado esta ativo (nao concluido/cancelado/arquivado)
- Retorna: dados do terceiro (nome, veiculo, status), documentos enviados, status do acordo (se houver), dados da oficina, etapa atual
- NAO retorna: dados do associado, valores de orcamento, dados de outros terceiros

### 4.3 Edge Function `salvar-etapa-terceiro`

Recebe `{ token, acao, dados }`:

**Acoes suportadas:**
- `assinar_termo`: Registra assinatura (nome digitado, IP, timestamp). Atualiza status para `termo_assinado`
- `escolher_oficina`: Salva tipo (credenciada/propria) + dados. Atualiza status para `oficina_definida`
- `responder_acordo`: Aceitar ou recusar. Se aceitar: status `acordo_aceito`. Se recusar: status `acordo_recusado`, segue para reparo

### 4.4 Edge Function `upload-documento-terceiro`

Recebe FormData com token + arquivo + tipo:
- Valida token
- Upload para bucket `sinistro-terceiros` (path: `{terceiro_id}/{tipo}/{filename}`)
- Cria registro em `sinistro_terceiro_documentos`
- Retorna URL do arquivo

### 4.5 Pagina `PortalTerceiro.tsx`

Layout mobile-first seguindo o padrao visual de `EventoColisao.tsx` e `EventoPosAprovacao.tsx`:

**Header fixo:** Logo Pratic Car + "Portal do Terceiro" + nome

**Stepper vertical** com etapas condicionais:

### 4.6 Componentes do Portal (pasta `src/components/terceiro/`)

**`TerceiroDocumentos.tsx`**
- Lista de documentos obrigatorios (CNH, CRLV, B.O., fotos) e opcionais (video, orcamentos)
- Upload individual com preview
- Status de cada documento (pendente/aprovado/rejeitado com motivo)
- Barra de progresso "X de Y enviados"
- Botao "Confirmar envio"

**`TerceiroTermo.tsx`**
- Texto legal do termo de anuencia (scrollavel)
- Resumo em linguagem simples
- Checkbox "Li e concordo"
- Campos pre-preenchidos (nome, CPF)
- Campo "assinatura digital" (digitar nome completo)
- Botao "Assinar Termo"

**`TerceiroOficina.tsx`**
- Dois cards selecionaveis:
  - Oficina credenciada Pratic (recomendado)
  - Oficina propria (com alerta sobre regras)
- Se propria: campos nome/endereco/telefone
- Botao "Confirmar escolha"

**`TerceiroAcordo.tsx`**
- Card com valor proposto e detalhes
- Botoes "Aceitar Acordo" (verde) e "Recusar — Quero o reparo" (vermelho)
- Feedback apos resposta

**`TerceiroAcompanhamento.tsx`**
- Pipeline visual horizontal com icones
- Etapas: Regulagem -> Orcamento -> Pecas -> Em Reparo -> Concluido
- Status visual (verde concluida, azul atual, cinza futura)
- Info da oficina e previsao
- NAO mostra valores

**`TerceiroEntrega.tsx`**
- Card "Veiculo pronto!"
- Dados da oficina para retirada
- Apos entrega registrada: mensagem de conclusao

### 4.7 Config `supabase/config.toml`

Adicionar as 3 novas edge functions com `verify_jwt = false` (sao publicas).

---

## FASE 5: Notificacoes WhatsApp

### 5.1 Integrar com `disparar-notificacao` ou `whatsapp-send-text`

Usando a infraestrutura existente de envio de WhatsApp, disparar mensagens automaticas nos seguintes momentos:

1. **Cadastro do terceiro**: Mensagem com link do portal (disparada pelo analista via botao "Enviar Link WhatsApp" na SecaoTerceiros)
2. **Documentos aprovados**: Apos analista aprovar todos os obrigatorios
3. **Documento rejeitado**: Com motivo, pedindo reenvio
4. **Proposta de acordo**: Notificar terceiro que ha proposta
5. **Reparo iniciado**: Informar oficina
6. **Veiculo pronto**: Informar para retirada

### 5.2 Botao "Enviar Link WhatsApp" na SecaoTerceiros

Na lista de terceiros, adicionar botao que abre WhatsApp Web com mensagem pre-formatada contendo o link do portal.

### 5.3 Notificacoes automaticas nas Edge Functions

Nas edge functions `salvar-etapa-terceiro` e nas acoes do analista (validar documentos, propor acordo, atualizar status), chamar `whatsapp-send-text` para notificar o terceiro.

---

## Arquivos a Criar

| Arquivo | Descricao |
|---------|-----------|
| `src/components/sinistros/AbaTerceiroReparo.tsx` | Conteudo da aba de reparo do terceiro |
| `src/components/sinistros/CardLimitesTerceiros.tsx` | Card de limites de cobertura |
| `src/components/sinistros/ProporAcordoModal.tsx` | Modal para propor acordo |
| `src/components/sinistros/ValidarDocumentosTerceiroDialog.tsx` | Dialog para validar documentos |
| `src/pages/public/PortalTerceiro.tsx` | Pagina principal do portal publico |
| `src/components/terceiro/TerceiroDocumentos.tsx` | Etapa de upload de documentos |
| `src/components/terceiro/TerceiroTermo.tsx` | Etapa do termo de anuencia |
| `src/components/terceiro/TerceiroOficina.tsx` | Etapa de escolha de oficina |
| `src/components/terceiro/TerceiroAcordo.tsx` | Etapa de proposta de acordo |
| `src/components/terceiro/TerceiroAcompanhamento.tsx` | Etapa de acompanhamento |
| `src/components/terceiro/TerceiroEntrega.tsx` | Etapa de entrega |
| `supabase/functions/validar-link-terceiro/index.ts` | Validacao do token publico |
| `supabase/functions/salvar-etapa-terceiro/index.ts` | Processar acoes do terceiro |
| `supabase/functions/upload-documento-terceiro/index.ts` | Upload de documentos |

## Arquivos a Modificar

| Arquivo | Modificacao |
|---------|-------------|
| `src/pages/eventos/SinistroDetalhe.tsx` | Adicionar sistema de abas quando tem terceiro |
| `src/components/sinistros/SecaoTerceiros.tsx` | Adicionar botao "Enviar Link WhatsApp" |
| `src/hooks/useTerceiros.ts` | Adicionar mutation para atualizar status |
| `src/App.tsx` | Adicionar rota `/terceiro/:token` |
| `supabase/config.toml` | Registrar 3 novas edge functions |

## Ordem de Implementacao

1. **Primeiro**: Edge functions (validar-link-terceiro, salvar-etapa-terceiro, upload-documento-terceiro)
2. **Segundo**: Componentes do portal publico (PortalTerceiro + sub-componentes)
3. **Terceiro**: Abas no SinistroDetalhe + AbaTerceiroReparo
4. **Quarto**: Componentes auxiliares (ValidarDocumentos, ProporAcordo, CardLimites)
5. **Quinto**: Botoes de WhatsApp e notificacoes automaticas

