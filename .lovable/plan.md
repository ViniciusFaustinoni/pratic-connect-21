

# Fluxo de Migração no ContratoWizard

## Resumo

Quando o consultor seleciona "Migração" como tipo de operação no Step 3 do `ContratoWizard`, o sistema deve: (1) verificar bloqueios por CPF (débitos anteriores e vínculo ativo), (2) exibir formulário de migração com upload de comprovantes e boleto, (3) validar documentos via OCR, e (4) criar uma solicitação pendente que bloqueia o avanço até aprovação.

## Mudanças no banco de dados

### Nova tabela: `solicitacoes_migracao`

```sql
create table public.solicitacoes_migracao (
  id uuid primary key default gen_random_uuid(),
  cotacao_id uuid references cotacoes(id) not null,
  associado_cpf text not null,
  associado_nome text,
  veiculo_placa text,
  associacao_origem text not null,
  consultor_id text references profiles(id),
  status text not null default 'pendente' check (status in ('pendente','aprovada','reprovada')),
  motivo_reprovacao text,
  aprovado_por text references profiles(id),
  aprovado_em timestamptz,
  prazo_resposta_horas int not null default 48,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.solicitacoes_migracao enable row level security;
```

### Nova tabela: `solicitacoes_migracao_documentos`

```sql
create table public.solicitacoes_migracao_documentos (
  id uuid primary key default gen_random_uuid(),
  solicitacao_id uuid references solicitacoes_migracao(id) on delete cascade not null,
  tipo text not null check (tipo in ('comprovante_pagamento','boleto_referencia')),
  arquivo_url text not null,
  nome_arquivo text,
  cpf_detectado text,
  placa_detectada text,
  legivel boolean default true,
  validacao_ok boolean,
  validacao_erro text,
  created_at timestamptz default now()
);
```

RLS: authenticated users can read/insert their own solicitações (by `consultor_id`); admins can read/update all.

## Mudanças no frontend

### 1. Mover seleção de tipo de operação para o Step 1

Atualmente o select de tipo de operação fica no Step 3 (Revisão). Para migração funcionar, precisa ser escolhido **antes** do Step 2 (Documentos), pois o formulário de migração aparece entre Steps 1 e 2.

**Arquivo:** `src/components/contratos/ContratoWizard.tsx`
- Mover o `<Select>` de `tipoOperacao` para dentro do Step 1, abaixo do resumo da cotação
- Quando `tipoOperacao === 'migracao'`, inserir um novo step intermediário (Step "Migração") entre os steps atuais

### 2. Novo componente: `MigracaoStepForm`

**Arquivo:** `src/components/contratos/MigracaoStepForm.tsx`

Fluxo interno:
1. **Verificação automática de bloqueios** (ao montar, usando o CPF da cotação/lead):
   - Query `associados` por CPF com `status = 'ativo'` → bloqueia se encontrar ("vínculo ativo existente")
   - Query `cobrancas` por CPF com status `vencido` → bloqueia se encontrar ("débitos pendentes")
   - Se bloqueado: exibe Alert com mensagem específica, botão "Próximo" desabilitado

2. **Formulário de migração** (se sem bloqueio):
   - Campo texto: "Associação de origem"
   - Upload de comprovantes de pagamento (mínimo lido de `useMigracaoConfig().comprovantes`)
   - Contador: "X de Y comprovantes enviados"
   - Upload de boleto de referência (1 obrigatório)
   - Cada upload envia para o storage `documentos` e chama `document-ocr` para extrair CPF e placa

3. **Validação automática** ao clicar "Validar e Enviar":
   - Quantidade de comprovantes >= config
   - Todos os comprovantes com CPF detectado === CPF do formulário
   - Todos os comprovantes com placa detectada === placa do veículo
   - Boleto presente e legível
   - Se falha: exibe qual documento tem problema e o que corrigir
   - Se sucesso: cria registro em `solicitacoes_migracao` + documentos em `solicitacoes_migracao_documentos`

4. **Status em tempo real** (após envio):
   - Subscribe via realtime ou polling na `solicitacoes_migracao` pelo `cotacao_id`
   - Exibe badge: Pendente (amarelo), Aprovada (verde), Reprovada (vermelho)
   - Enquanto `pendente`: botão "Próximo" desabilitado
   - Se `aprovada`: libera avanço, tipoOperacao permanece 'migracao'
   - Se `reprovada`: exibe motivo, permite reenviar

### 3. Hook: `useSolicitacaoMigracao`

**Arquivo:** `src/hooks/useSolicitacaoMigracao.ts`

- `useVerificarBloqueiosMigracao(cpf)` — verifica débitos e vínculo ativo
- `useCriarSolicitacaoMigracao()` — mutation para inserir solicitação + documentos
- `useSolicitacaoMigracaoByCotacao(cotacaoId)` — query com refetch interval para status em tempo real

### 4. Ajuste no wizard steps

O wizard passa de 3 steps para 4 quando `tipoOperacao === 'migracao'`:
1. Cotação + Tipo de Operação
2. **Migração** (novo — só aparece se migração)
3. Documentos (CNH, CRLV, etc.)
4. Revisão

## Arquivos a criar/modificar

| Arquivo | Ação |
|---------|------|
| `src/components/contratos/MigracaoStepForm.tsx` | Criar |
| `src/hooks/useSolicitacaoMigracao.ts` | Criar |
| `src/components/contratos/ContratoWizard.tsx` | Modificar (mover select, adicionar step condicional) |
| Migration SQL | Criar tabelas + RLS |

## Valores dinâmicos

Todos os valores lidos via `useMigracaoConfig()`:
- `comprovantes` (qtd mínima de comprovantes)
- `prazo_horas` (prazo de resposta para a análise)
- `isentar_carencia` (se migração aprovada isenta carência)

Nenhum valor fixo no código.

