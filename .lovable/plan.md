
## Contexto rápido (LTC8G02)

Cruzando logs/payload do contrato **CTR-20260522123934-VXMCT0** (Daniele dos Santos Castro Monteiro / Fiat Siena Attractive / LTC8G02):

- `veiculo_categoria='taxi'` no DB **está correto** — o erro "ALUGUEL → PARTICULAR" foi na renderização do termo (mapeamento de `tipo_uso`/`categoria` no engine AF1 caindo no default "Particular"). Não há retroalimentação possível: termo já foi assinado em 22/05.
- Data de nascimento, RG e CNH no DB batem com OCR mas divergem do documento real → caso típico de OCR aprovado que precisaria de retoque pós-assinatura.
- Hoje **não existe** fluxo de retificação: a única saída seria cancelar + recriar contrato (perde adesão, taxa, histórico).

Por isso a feature abaixo. O fix do mapeamento "Particular vs Aluguel/Táxi" no engine AF1 fica registrado como **débito separado** (não escopo deste plano).

---

## Feature: Retificação de Termo de Filiação

### Localização

Detalhe do associado (`/cadastro/associados/:id`), menu "…" do `AssociadoHeroHeader.tsx`:

- **Remover**: item "Busca e Apreensão" (linhas 266–268).
- **Adicionar** no mesmo lugar: "Retificar Termo de Filiação" (ícone `FileSignature`), visível apenas para roles **Diretor/Admin** e **Cadastro** (`canManageCadastro`).

### Modal "Retificar Termo de Filiação"

Abre carregando o **snapshot do termo vigente** (lendo `contratos` + `associados` + `veiculos` + `planos`). Campos editáveis agrupados em accordion:

- **Dados pessoais**: nome, CPF (read-only), RG, órgão, data de nascimento, estado civil, profissão, e-mail, telefone, telefone secundário, CNH número/validade/categoria.
- **Endereço**: CEP, logradouro, número, complemento, bairro, cidade, UF.
- **Veículo**: marca, modelo, ano fab/mod, cor, placa, chassi, renavam, combustível, câmbio, FIPE, categoria (`particular | taxi | aluguel | leilao | ...`), `tipo_uso`, `tipo_placa`, flags de depreciação.
- **Contrato/Plano**: dia de vencimento, mensalidade, taxa de adesão (read-only — só exibido).
- **Motivo da retificação** (obrigatório, textarea ≥ 10 chars, vai para auditoria).

Botões: **Cancelar** | **Gerar Retificação e Enviar para Assinatura**.

### Pipeline ao confirmar

1. **Validação** Zod no front + edge.
2. Edge function **`retificar-termo-filiacao`** (nova) faz, transacionalmente:
   - `UPDATE associados` (campos pessoais/endereço/CNH) e `UPDATE veiculos` (dados do veículo + `tipo_placa`/`tipo_uso`) e `UPDATE contratos` (`dia_vencimento`, `veiculo_categoria`).
   - INSERT em **`contrato_retificacoes`** (nova tabela 1:N — ver "Banco" abaixo) com `versao = max(versao)+1`, snapshot **antes/depois** em JSONB, motivo, `criado_por`.
   - Reusa o engine **AF1** (`renderTermoFiliacao` em `_shared`) para gerar o HTML do termo com os novos valores.
   - Cria documento na Autentique via `autentique-criar-documento` (mesma rota usada hoje, **com `positions: gerarPosicoesAssinatura(...)` obrigatório** e biometria `PF_FACIAL`), nome do documento `Retificação Termo Filiação — CTR-… v{n}`.
   - Persiste `autentique_document_id`, `autentique_signer_id`, `short_link`, `status='enviado'` na linha de `contrato_retificacoes`.
   - Registra `logs_auditoria` (`acao='retificar_termo'`).
3. WhatsApp opcional: reaproveita `enviar-termo-filiacao-whatsapp` com o `short_link` da retificação (toggle no modal, default ON).

### Pipeline ao assinar (Autentique → webhook)

`autentique-webhook` já existente: estender para reconhecer `autentique_document_id` registrado em `contrato_retificacoes`:

- Atualiza `status='assinado'`, `pdf_assinado_url`, `data_assinatura`.
- Anexa o PDF assinado em **`contratos_documentos`** com `tipo='retificacao_termo_filiacao'` (novo valor) — assim aparece automaticamente na aba **Documentos** do detalhe do associado, em conjunto com CNH/CRLV/Comprovante etc.
- `logs_auditoria` (`acao='atualizar'`, descrição "Retificação v{n} assinada").
- **Não toca** em `contratos.pdf_assinado_url` original — o termo primário continua arquivado.

### UI complementar

- Aba **Documentos** do associado: novo grupo "**Retificações de Termo de Filiação**" listando cada versão com data, motivo, status (Enviado/Visualizado/Assinado), PDF original (HTML pré-assinatura) e PDF assinado quando concluída. Reaproveita `UnifiedDocumentUploader`/listagem existente.
- Aba **Histórico** do associado: entradas de auditoria já aparecem via `logs_auditoria` (sem trabalho extra).

### Banco

Migração **nova tabela** `contrato_retificacoes`:

```text
contrato_retificacoes
- id uuid pk
- contrato_id uuid → contratos
- associado_id uuid → associados
- versao int (unique por contrato)
- motivo text not null
- snapshot_anterior jsonb     (associado+veiculo+contrato relevantes)
- snapshot_novo jsonb
- autentique_document_id text
- autentique_signer_id text
- short_link text
- status text                 (rascunho|enviado|visualizado|assinado|cancelado)
- pdf_url text                (HTML/PDF gerado pré-assinatura)
- pdf_assinado_url text
- data_envio timestamptz
- data_assinatura timestamptz
- criado_por uuid (profiles)
- created_at / updated_at
```

RLS: SELECT/INSERT/UPDATE para roles `admin`, `diretor`, `cadastro` via `has_role`. Trigger `BEFORE INSERT` para calcular `versao`. `contratos_documentos.tipo` ganha valor novo `retificacao_termo_filiacao` (constraint atualizada).

### Engine de termo (AF1)

- O renderer atual já mapeia `cliente`, `veiculo`, `plano`, `contrato`, `empresa`. Reaproveitar como está; apenas garantir que o mapping de `veiculo_categoria` → label ("Particular/Táxi/Aluguel/Leilão") use o valor canônico do `tipo_placa`/`veiculo_categoria` corrigidos. **Não inventar render novo**, só passar o snapshot atualizado.

### Permissões

Gate no menu via `usePermissions` (cobre Diretor/Admin/Cadastro). Edge function valida o JWT do chamador e confirma a role via `has_role(uid, 'admin' | 'diretor' | 'cadastro')`.

---

## Arquivos / artefatos

**Migração (Supabase)**
- Cria `contrato_retificacoes` + RLS + trigger de versão.
- ALTER `contratos_documentos` para aceitar `retificacao_termo_filiacao`.

**Edge functions**
- `supabase/functions/retificar-termo-filiacao/index.ts` (novo) — orquestra update + render + Autentique.
- `supabase/functions/autentique-webhook/index.ts` — estender para tratar retificações.

**Frontend**
- `src/components/associados/detalhe/AssociadoHeroHeader.tsx` — remove "Busca e Apreensão", adiciona "Retificar Termo de Filiação".
- `src/components/associados/detalhe/RetificarTermoModal.tsx` (novo) — modal com accordion + react-hook-form + Zod, motivo obrigatório.
- `src/components/associados/detalhe/RetificacoesTermoList.tsx` (novo) — bloco na aba Documentos.
- Hook `src/hooks/useRetificarTermo.ts` — wrapper de `supabase.functions.invoke('retificar-termo-filiacao')` + invalidate queries.
- Atualizar `src/hooks/useDocumentos*` para listar `tipo='retificacao_termo_filiacao'` no agrupamento certo.

**Memória**
- Atualizar `mem://index.md` Core: "Retificação de Termo de Filiação substitui Busca e Apreensão no menu do associado; histórico em `contrato_retificacoes`; PDF assinado vai para `contratos_documentos.tipo='retificacao_termo_filiacao'`; engine AF1 reutilizado; cadastro/diretor/admin apenas."
- Criar `mem://features/contracts/retificacao-termo-filiacao.md` com pipeline detalhado.

---

## Fora de escopo (documentado como débito)

1. **Correção do mapeamento "Particular vs Táxi/Aluguel" no engine AF1** — bug que originou o caso LTC8G02; será aberto em ticket separado com regressão automatizada.
2. **Retificação de Termo de Cancelamento / Substituição / Troca** — pedido foi explícito: "Somente o termo de filiação".
3. **Re-sincronizar dados retificados com o SGA Hinova** — a sync já roda em `update_associado`/`update_veiculo`; só validar que o fluxo continua disparando após o UPDATE. Sem rework do SGA.

---

## Validação

- Abrir `Cadastro › Associados › LUIZ AMARAL` (caso de testes seguro), acionar "Retificar Termo de Filiação", editar RG, salvar.
- Verificar criação de linha em `contrato_retificacoes` (versao=1), `autentique_document_id` populado, e link enviado.
- Simular assinatura no Autentique (sandbox) → confirmar PDF aparece na aba Documentos como "Retificação de Termo de Filiação v1", `data_assinatura` preenchida e log de auditoria registrado.
- Confirmar que `pdf_assinado_url` original do contrato **não foi alterado**.
- Conferir que usuário sem role de Cadastro/Diretor **não vê** o item no menu.
