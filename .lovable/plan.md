

# Registro de Imprevistos e Reagendamento Automatico de Vistorias

## Visao Geral

Implementar 3 funcionalidades interligadas:
1. **Botao de Imprevisto** no app do instalador/vistoriador (apos tarefa atribuida)
2. **Duplo Check** com o associado antes de finalizar o imprevisto
3. **Reagendamento automatico** via WhatsApp (link publico) + cron para vistorias nao iniciadas ate fim do expediente

---

## 1. Migracao de Banco de Dados

Adicionar colunas na tabela `servicos`:

```sql
ALTER TABLE servicos ADD COLUMN IF NOT EXISTS imprevisto_registrado_em timestamptz;
ALTER TABLE servicos ADD COLUMN IF NOT EXISTS imprevisto_motivo text;
ALTER TABLE servicos ADD COLUMN IF NOT EXISTS imprevisto_duplo_check boolean DEFAULT false;
ALTER TABLE servicos ADD COLUMN IF NOT EXISTS imprevisto_duplo_check_em timestamptz;
ALTER TABLE servicos ADD COLUMN IF NOT EXISTS reagendamento_token uuid DEFAULT gen_random_uuid();
ALTER TABLE servicos ADD COLUMN IF NOT EXISTS reagendamento_enviado_em timestamptz;
```

---

## 2. Componente: Botao de Imprevisto (`ImprevistoBotao.tsx`)

**Novo arquivo**: `src/components/vistoriador/ImprevistoBotao.tsx`

- Visivel no `TarefaAtualCard` quando status e `agendada`, `em_rota` ou `em_andamento` e a tarefa ja foi atribuida (tem `profissional_id`)
- Ao clicar, abre modal com:
  - Campo de motivo do imprevisto (select com opcoes: "Associado ausente", "Endereco incorreto", "Problema no veiculo", "Desistencia do associado", "Outro")
  - Campo de observacoes (textarea)
- Ao confirmar, grava `imprevisto_registrado_em` e `imprevisto_motivo` no servico
- Em seguida, abre a etapa de Duplo Check

---

## 3. Componente: Duplo Check (`DuploCheckImprevisto.tsx`)

**Novo arquivo**: `src/components/vistoriador/DuploCheckImprevisto.tsx`

- Modal/etapa que aparece apos registrar imprevisto
- Instrucao: "Confirme com o associado que nao sera possivel prosseguir"
- Botoes de contato: WhatsApp e Ligacao (reutiliza logica existente do `TarefaAtualCard`)
- Apos contato, botao "Confirmar Duplo Check" fica habilitado
- Ao confirmar:
  - Atualiza `imprevisto_duplo_check = true` e `imprevisto_duplo_check_em = now()`
  - Muda status do servico para `nao_compareceu`
  - Dispara envio de link de reagendamento via WhatsApp (chama edge function)

---

## 4. Edge Function: `enviar-link-reagendamento`

**Novo arquivo**: `supabase/functions/enviar-link-reagendamento/index.ts`

- Recebe `servico_id`
- Busca dados do servico (associado, telefone, token de reagendamento)
- Gera URL publica: `{APP_URL}/reagendar/{reagendamento_token}`
- Envia WhatsApp via `whatsapp-send-text` com mensagem:
  > "Ola [nome], sua vistoria nao pode ser realizada. Acesse o link abaixo para agendar um novo dia, horario e endereco: [LINK]"
- Atualiza `reagendamento_enviado_em` no servico

---

## 5. Pagina Publica: Reagendamento (`/reagendar/:token`)

**Novo arquivo**: `src/pages/ReagendarVistoria.tsx`

- Pagina publica (sem autenticacao)
- Valida token via query no banco (`servicos` onde `reagendamento_token = token`)
- Formulario com:
  - Selecao de nova data (calendario, excluindo domingos)
  - Selecao de periodo (Manha/Tarde)
  - Endereco completo (com busca por CEP, reutilizando logica existente do `AgendamentoVistoria`)
  - O endereco pode ser diferente do cadastro
- Ao confirmar:
  - Cria novo servico com os mesmos dados (associado, veiculo, tipo, cotacao) mas nova data/endereco
  - Marca servico antigo como `reagendada` com referencia ao novo
  - Exibe tela de sucesso

**Edge Function**: `reagendar-vistoria-publica` para processar o reagendamento server-side

---

## 6. Cron: Vistorias nao iniciadas no fim do expediente

**Novo arquivo**: `supabase/functions/cron-reagendamento-automatico/index.ts`

- Executado diariamente as 18h (fim do expediente)
- Busca servicos com:
  - `data_agendada = hoje`
  - `status = 'agendada'` (nunca foi iniciada)
  - `tipo` de vistoria (nao instalacao)
  - `reagendamento_enviado_em IS NULL` (evita duplicidade)
- Para cada servico encontrado:
  - Muda status para `nao_compareceu`
  - Chama `enviar-link-reagendamento` para enviar WhatsApp com link
- Registrar no cron via `pg_cron` + `pg_net`

---

## 7. Integracao no `TarefaAtualCard.tsx`

Modificar `src/components/vistoriador/TarefaAtualCard.tsx`:

- Adicionar botao "Comunicar Imprevisto" (icone AlertTriangle, cor amber) visivel quando:
  - Tarefa tem `profissional_id` (foi atribuida)
  - Status e `agendada`, `em_rota` ou `em_andamento`
  - Nao tem imprevisto ja registrado
- Botao abre o componente `ImprevistoBotao`

---

## 8. Rota no App.tsx

Adicionar rota publica:
```tsx
<Route path="/reagendar/:token" element={<ReagendarVistoria />} />
```

---

## Arquivos Criados (5)
1. `src/components/vistoriador/ImprevistoBotao.tsx`
2. `src/components/vistoriador/DuploCheckImprevisto.tsx`
3. `src/pages/ReagendarVistoria.tsx`
4. `supabase/functions/enviar-link-reagendamento/index.ts`
5. `supabase/functions/cron-reagendamento-automatico/index.ts`

## Arquivos Modificados (3)
1. `src/components/vistoriador/TarefaAtualCard.tsx` — botao de imprevisto
2. `src/App.tsx` — rota publica de reagendamento
3. `supabase/config.toml` — config da nova edge function

## Migracao SQL (1)
- Novas colunas em `servicos` + RLS para acesso publico ao reagendamento por token

