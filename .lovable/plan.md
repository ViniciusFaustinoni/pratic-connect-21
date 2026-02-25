
# Modulo de Cobertura de Terceiros -- Plano de Implementacao

Este e o modulo mais complexo do sistema ate agora. Sera dividido em **5 fases incrementais**, cada uma entregando valor funcional independente.

---

## FASE 1: Banco de Dados e Infraestrutura

### 1.1 Nova tabela `sinistro_terceiros`

Tabela principal para armazenar cada terceiro vinculado a um evento:

```text
sinistro_terceiros
├── id (uuid, PK)
├── sinistro_id (FK -> sinistros)
├── numero_sequencial (int) -- 1, 2, 3...
├── nome (text, NOT NULL)
├── cpf (text, NOT NULL)
├── telefone (text, NOT NULL)
├── whatsapp (text, NOT NULL)
├── email (text, nullable)
├── veiculo_placa (text, NOT NULL)
├── veiculo_marca (text, NOT NULL)
├── veiculo_modelo (text, NOT NULL)
├── veiculo_ano (text, NOT NULL)
├── veiculo_cor (text, NOT NULL)
├── veiculo_fipe (numeric, nullable)
├── culpa (text) -- 'associado_culpado', 'terceiro_culpado', 'compartilhada', 'a_definir'
├── parentesco (boolean, default false)
├── parentesco_descricao (text, nullable)
├── tipo_dano (text, default 'veiculo') -- 'veiculo' ou 'nao_veicular'
├── observacoes (text, nullable)
├── token (uuid, unique, default gen_random_uuid())
├── status (text, default 'cadastrado')
│   -- Valores: cadastrado, documentacao_pendente, documentacao_enviada,
│   --          termo_pendente, termo_assinado, oficina_pendente, oficina_definida,
│   --          acordo_proposto, acordo_aceito, acordo_recusado,
│   --          regulagem, orcamento, pecas, em_reparo, concluido, arquivado
├── oficina_tipo (text, nullable) -- 'credenciada' ou 'propria'
├── oficina_nome (text, nullable)
├── oficina_endereco (text, nullable)
├── oficina_telefone (text, nullable)
├── orcamento_valor (numeric, nullable)
├── acordo_valor (numeric, nullable)
├── acordo_justificativa (text, nullable)
├── acordo_status (text, nullable) -- 'proposto', 'aceito', 'recusado'
├── acordo_respondido_em (timestamp, nullable)
├── termo_assinado_em (timestamp, nullable)
├── termo_assinatura_ip (text, nullable)
├── termo_assinatura_nome (text, nullable)
├── documentos_aprovados_em (timestamp, nullable)
├── reparo_concluido_em (timestamp, nullable)
├── entrega_em (timestamp, nullable)
├── created_at (timestamp, default now())
├── created_by (uuid, nullable)
├── updated_at (timestamp, default now())
```

### 1.2 Nova tabela `sinistro_terceiro_documentos`

Documentos enviados pelo terceiro via portal publico:

```text
sinistro_terceiro_documentos
├── id (uuid, PK)
├── terceiro_id (FK -> sinistro_terceiros)
├── tipo (text) -- 'cnh', 'crlv', 'bo', 'foto_dano', 'video', 'orcamento_1', 'orcamento_2', 'orcamento_3'
├── nome (text)
├── url (text)
├── status (text, default 'pendente') -- 'pendente', 'aprovado', 'rejeitado'
├── motivo_rejeicao (text, nullable)
├── aprovado_por (uuid, nullable)
├── aprovado_em (timestamp, nullable)
├── created_at (timestamp, default now())
```

### 1.3 Novas colunas na tabela `planos`

Adicionar campos estruturados para limites de terceiros (atualmente esta apenas no array de `coberturas` como texto):

```text
planos (ALTER TABLE)
├── limite_terceiros (numeric, nullable) -- R$ 10000, 15000, 35000, 40000, 100000
├── cota_terceiros (numeric, nullable)   -- R$ 750 ou 0 (isento)
├── cota_terceiros_isento (boolean, default false)
```

### 1.4 Nova coluna na tabela `sinistros`

```text
sinistros (ALTER TABLE)
├── tem_terceiro (boolean, default false)
```

### 1.5 Novo bucket de storage

`sinistro-terceiros` -- bucket publico para documentos enviados pelo terceiro via portal.

### 1.6 Politicas RLS

- `sinistro_terceiros`: leitura autenticada, escrita para analistas/admins/diretores
- `sinistro_terceiro_documentos`: leitura autenticada + insercao anonima (via token)
- Storage `sinistro-terceiros`: upload anonimo (tamanho limitado), leitura autenticada

---

## FASE 2: Cadastro de Terceiros na Tela de Eventos

### 2.1 Componente `SecaoTerceiros`

Novo componente que sera adicionado a pagina `SinistroDetalhe.tsx`:

- Toggle "Houve terceiro envolvido?" (salva `tem_terceiro` no sinistro)
- Se sim: lista de terceiros cadastrados + botao "+ Adicionar terceiro"
- Mini-cards com resumo de cada terceiro (nome, placa, culpa, status docs, status termo)

### 2.2 Modal `CadastrarTerceiroModal`

Formulario completo dividido em secoes:

- **Dados pessoais:** Nome, CPF (com mascara/validacao), Telefone, WhatsApp, Email
- **Dados do veiculo:** Placa (mascara), Marca/Modelo, Ano, Cor, FIPE estimado
- **Culpa:** Radio group (associado culpado / terceiro culpado / compartilhada / a definir)
- **Parentesco:** Toggle + campo texto (gera alerta automatico)
- **Tipo de dano:** Veiculo automotor / Nao veicular (nao veicular = card de alerta "Nao coberto")
- **Observacoes:** Textarea

Validacoes:
- CPF: formato + digitos verificadores
- Placa: formato valido, diferente da placa do associado
- Parentesco = sim: alerta de analise interna

### 2.3 Card `CoberturaTerceirosInfo`

Card informativo que aparece ao cadastrar terceiro:

- Nome do plano do associado (via join contratos -> planos)
- Limite de cobertura de terceiros do plano
- Cota do associado (com verificacao de cota dobrada)
- Se multiplos terceiros: soma dos orcamentos vs limite
- Alertas: excedente, cota dobrada (reincidencia 12 meses / primeiros 120 dias)

### 2.4 Verificacao automatica de cota dobrada

Funcao que consulta:
- Historico de sinistros do associado nos ultimos 12 meses (reincidencia)
- Data de ativacao do contrato vs data atual (primeiros 120 dias)
- Retorna multiplicador (1x ou 2x) + motivo

---

## FASE 3: Abas de Reparo no Evento

### 3.1 Sistema de abas no `SinistroDetalhe.tsx`

Quando `tem_terceiro = true`:

- Adicionar `Tabs` do Radix UI envolvendo a secao de reparo
- Aba "Veiculo do Associado" (conteudo atual inalterado)
- Aba "Terceiro 1", "Terceiro 2", etc. (uma por terceiro)

Quando `tem_terceiro = false`:
- Sem abas, tela exatamente como esta hoje

### 3.2 Componente `AbaTerceiroReparo`

Conteudo de cada aba de terceiro:

**Header:** Card com dados resumidos do terceiro (nome, veiculo, culpa badge, status)

**Card de limites** (fixo no topo):
- Limite total do plano
- Orcamento de cada terceiro
- Total consumido / disponivel
- Cota do associado (paga/pendente)
- Alerta de excedente se aplicavel

**Condicoes por culpa:**
- "Terceiro culpado": card cinza, sem fluxo de reparo, apenas registro para regresso
- "A definir": card amarelo, fluxo bloqueado ate definicao
- "Associado culpado": fluxo completo de reparo (sem etapa de cota, direto para termo)

**Pipeline de reparo do terceiro:**
Documentos -> Termo -> Oficina -> [Acordo?] -> Regulagem -> Orcamento -> Pecas -> Reparo -> Entrega

Cada etapa atualiza o `status` do registro `sinistro_terceiros`.

### 3.3 Acoes do analista na aba do terceiro

- Validar/rejeitar documentos (abre cada documento, aprova ou rejeita com motivo)
- Enviar lembrete WhatsApp
- Propor acordo (modal: valor + justificativa)
- Definir oficina / validar orcamentos
- Todas as acoes de reparo padrao

---

## FASE 4: Portal Publico do Terceiro

### 4.1 Rota publica

Nova rota: `/terceiro/:token` (adicionar ao App.tsx)

### 4.2 Pagina `PortalTerceiro.tsx`

Layout mobile-first, sem login, validacao por token:

**Header:** Logo Pratic Car + "Portal do Terceiro" + nome do terceiro

**Stepper vertical** mostrando etapas e progresso:

1. **Envio de Documentos** -- Uploads individuais (CNH, CRLV, B.O., fotos, video, orcamentos)
2. **Termo de Anuencia** -- Texto legal + aceite digital (nome + CPF + confirmacao)
3. **Escolha de Oficina** -- Credenciada (recomendado) ou propria
4. **Proposta de Acordo** -- Condicional (so aparece se analista propor)
5. **Acompanhamento** -- Pipeline visual de status (sem valores)
6. **Entrega** -- Informacoes da oficina para retirada

### 4.3 Edge Function `validar-link-terceiro`

- Recebe token
- Valida: token existe, evento ativo (nao concluido/cancelado)
- Retorna: dados do terceiro (nome, veiculo), status atual, etapa atual, documentos enviados

### 4.4 Edge Function `salvar-etapa-terceiro`

- Recebe token + tipo de acao (upload_documento, assinar_termo, escolher_oficina, responder_acordo)
- Valida token
- Processa a acao
- Atualiza status do terceiro
- Dispara notificacao ao analista

### 4.5 Edge Function `upload-documento-terceiro`

- Recebe token + arquivo
- Valida token e tipo de documento
- Faz upload ao bucket `sinistro-terceiros`
- Cria registro em `sinistro_terceiro_documentos`

### 4.6 Bucket storage `sinistro-terceiros`

- Bucket publico para leitura (analista precisa ver)
- RLS para upload anonimo limitado (imagens e PDFs, max 10MB)

---

## FASE 5: Notificacoes WhatsApp e Integracao

### 5.1 Mensagens automaticas ao terceiro

Utilizando a infraestrutura existente (`disparar-notificacao` + Evolution API / Meta):

1. Cadastro: link inicial do portal
2. Documentos aprovados
3. Documento rejeitado (com motivo)
4. Proposta de acordo
5. Reparo iniciado
6. Veiculo pronto

### 5.2 Edge Function `gerar-link-terceiro`

- Chamada pelo analista ao cadastrar o terceiro
- Gera o token (ja feito no insert)
- Monta URL do portal
- Dispara WhatsApp com mensagem formatada

### 5.3 Integracoes com fluxo existente

- Na cota do associado: incluir "inclui cobertura de terceiro" quando aplicavel
- No rateio mensal: contabilizar custos de terceiros
- No App do associado: mostrar status resumido do terceiro (sem dados pessoais/valores)

---

## Ordem de Implementacao Recomendada

Dado o tamanho, sugiro implementar em **3 etapas de entrega**:

**Entrega 1** (Fases 1 + 2): Banco de dados + Cadastro de terceiros
- Resultado: analista ja consegue cadastrar terceiros no evento e ver limites

**Entrega 2** (Fase 3): Abas de reparo
- Resultado: fluxo completo de reparo do terceiro dentro do evento

**Entrega 3** (Fases 4 + 5): Portal publico + Notificacoes
- Resultado: terceiro interage pelo link, recebe notificacoes

---

## Arquivos Afetados (Estimativa)

### Novos arquivos (~15):
- `src/components/sinistros/SecaoTerceiros.tsx`
- `src/components/sinistros/CadastrarTerceiroModal.tsx`
- `src/components/sinistros/CoberturaTerceirosInfo.tsx`
- `src/components/sinistros/AbaTerceiroReparo.tsx`
- `src/components/sinistros/CardLimitesTerceiros.tsx`
- `src/components/sinistros/ProporAcordoModal.tsx`
- `src/components/sinistros/ValidarDocumentosTerceiroDialog.tsx`
- `src/pages/public/PortalTerceiro.tsx`
- `src/components/terceiro/TerceiroDocumentos.tsx`
- `src/components/terceiro/TerceiroTermo.tsx`
- `src/components/terceiro/TerceiroOficina.tsx`
- `src/components/terceiro/TerceiroAcordo.tsx`
- `src/components/terceiro/TerceiroAcompanhamento.tsx`
- `supabase/functions/validar-link-terceiro/index.ts`
- `supabase/functions/salvar-etapa-terceiro/index.ts`
- `supabase/functions/upload-documento-terceiro/index.ts`

### Arquivos modificados (~5):
- `src/pages/eventos/SinistroDetalhe.tsx` (adicionar secao terceiros + abas)
- `src/App.tsx` (nova rota `/terceiro/:token`)
- `supabase/config.toml` (novas edge functions, verify_jwt=false para as publicas)
- `src/hooks/useSinistros.ts` (ou novo hook `useTerceiros.ts`)
- `src/types/sinistros.ts` (novos tipos/enums)

### Migracoes SQL (~3):
1. Criar tabelas `sinistro_terceiros` e `sinistro_terceiro_documentos`
2. Alterar `planos` (limite_terceiros, cota_terceiros) e `sinistros` (tem_terceiro)
3. Criar bucket storage + politicas RLS
