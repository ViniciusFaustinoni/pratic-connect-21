## Contexto: o que o SGA Hinova exige (fonte: `https://api.hinova.com.br/api/sga/v2/doc/`)

Toda nova adesão dispara dois POSTs na ordem:

**1) `/associado/cadastrar`** — campos obrigatórios e códigos exigidos:
- `codigo_conta` (Number) — obrigatório quando há mais de uma conta na regional
- `codigo_regional` (opcional)
- `codigo_cooperativa` (opcional)
- `codigo_voluntario` (opcional, mas é assim que a Hinova vincula a venda ao consultor — sem ele a comissão fica órfã)
- `codigo_profissao` (opcional)
- `codigo_como_conheceu` (opcional)
- `codigo_tipo_cobranca_recorrente` (opcional)
- `beneficios[].codigo_beneficio` (opcional, vincula benefícios direto no associado)

**2) `/veiculo/cadastrar`** — campos obrigatórios e códigos exigidos:
- `codigo_associado` (retorno do POST anterior — automático)
- `codigo_conta`, `codigo_voluntario`, `codigo_cooperativa`
- `codigo_cor`, `codigo_combustivel`, `codigo_tipo_veiculo` (de-para via `hinova_mapeamentos` — ✅ já populado)
- `codigo_plano` (Hinova) — define produto comercializado
- `produtos_vinculados[{codigo_produto, valor}]` — coberturas + benefícios do plano expandidos como produtos
- `codigo_situacao` (pendente/ativo — opcional, vem das credenciais)

---

## Onde precisa haver código manual no nosso sistema

| Entidade | Campo no banco | UI hoje | Bloqueia sync? | Pendentes |
|---|---|---|---|---|
| **Plano** | `planos.codigo_sga_plano` | ✅ `PlanFormModal` | **SIM** | 287/287 vazios |
| **Vendedor / Agência / Supervisor / Gerente** | `profiles.codigo_sga_voluntario` | ✅ `ConsultorEditSheet` | **SIM** | 9 ativos sem código |
| **Cobertura** | `coberturas.codigo_sga` | ✅ `CoberturaUnificadaFormModal` | Não (omite a cobertura no payload) | 2.865/2.865 vazios |
| **Benefício** | `benefits.codigo_sga` | ✅ `BeneficioFormModal` | Não (omite o benefício no payload) | 1.770/1.770 vazios |
| **Cor / Combustível / Tipo de veículo / Tipo de foto** | `hinova_mapeamentos` | ❌ sem tela admin | Não (vai `null`) | ✅ todos populados via seed |
| **Conta bancária / Regional / Cooperativa / Situação Pendente / Situação Ativo** | `integracoes_credenciais` (JSON) | ⚠️ parcial — só `codigo_conta` e `codigo_voluntario` | **SIM se houver mais de uma conta** | a definir |
| **Forma de pagamento (`codigo_tipo_cobranca_recorrente`)** | nenhum | ❌ inexistente | Não (Hinova usa default) | n/d |
| **Como conheceu (`codigo_como_conheceu`)** | nenhum | ❌ inexistente | Não | n/d |
| **Profissão (`codigo_profissao`)** | nenhum | ❌ inexistente | Não | n/d |

---

## Plano de implementação (4 frentes, ordem por impacto)

### Frente 1 — Completar formulário de credenciais Hinova (rápido, alto impacto)
Arquivo: `src/components/integracoes/ConfigurarIntegracaoSheet.tsx`

Adicionar ao array `camposPorIntegracao.hinova`:
- `codigo_regional` (text, opcional)
- `codigo_cooperativa` (text, opcional)
- `codigo_situacao_pendente` (text, opcional, default 1)
- `codigo_situacao_ativo` (text, opcional, default 2)
- Manter `codigo_conta` (✅ já existe)
- **Remover** `codigo_voluntario` daqui — voluntário é por vendedor, não global. Se quiser manter como **fallback** quando vendedor não tem código, renomear o label para "Código Voluntário Padrão (fallback)".

A edge `sga-hinova-sync` já lê esses campos do `credenciais_integracao` (linhas 333–341), então só faltava expor na UI.

### Frente 2 — Tela admin para mapeamentos de domínio (médio)
Nova rota: `/configuracoes/integracoes/hinova/mapeamentos`

CRUD da tabela `hinova_mapeamentos` (tipo, codigo_local, codigo_hinova, ativo) com:
- Filtro por `tipo` (combustivel, cor, tipo_veiculo, tipo_foto)
- Edição inline
- Botão "Adicionar mapeamento"

Já populado por seed mas hoje não há onde editar — se a Hinova mudar um código, exige migração SQL manual.

### Frente 3 — Forma de pagamento, profissão e "como conheceu" (médio, opcional Hinova)
Como esses três são opcionais no payload e a Hinova usa defaults, propor:

3.1 **Configuração global** em `Configurações > Integrações > Hinova > Defaults`:
- `codigo_tipo_cobranca_recorrente_padrao` (Number) — usado em todo associado novo
- `codigo_como_conheceu_padrao` (Number)
- `codigo_profissao_padrao` (Number)

3.2 Edge passa a injetar esses defaults no payload de `/associado/cadastrar` quando definidos.

(Não precisa de tela de profissão/cidade/parentesco completa — a Hinova só precisa do código numérico que ela mantém do lado dela; a equipe Pratic configura uma vez por conta.)

### Frente 4 — Validação preventiva no fluxo de venda (alto impacto)
Antes de permitir confirmar venda, bloquear com mensagem clara quando:
1. **Plano** sem `codigo_sga_plano` → "Plano X ainda não está mapeado no SGA. Avise a coordenação."
2. **Vendedor** sem `codigo_sga_voluntario` → bloqueia ao selecionar consultor.
3. **Credenciais Hinova** sem `codigo_conta` (quando >1 conta) → mostra alerta no painel admin.

Componentes alvo:
- `src/hooks/usePlansAdmin.ts` — exibir badge "Sem código SGA" ao lado de cada plano.
- `src/pages/vendas/Consultores.tsx` — destacar consultores ativos sem código.
- Já existe `useChecklistSGA` e `useVendedoresSemCodigoSga` — expandir para incluir planos.

---

## Backfill em massa (apoio operacional, fora de código)

Para os **287 planos** + **2.865 coberturas** + **1.770 benefícios** sem código, criar:
- Tela de import via CSV em `Configurações > Planos > Importar Códigos SGA` aceitando colunas `nome,codigo_sga`, com matching por nome.
- Botão "Aplicar mesmo código a todas as variantes da linha" (ex.: Select SP, Select RJ etc. compartilham `codigo_sga_plano` quando representam o mesmo produto Hinova).

---

## Resumo do que entra em código

1. Adicionar 4 campos ao `ConfigurarIntegracaoSheet.tsx` (Frente 1).
2. Criar página/rota admin de `hinova_mapeamentos` (Frente 2).
3. Adicionar 3 campos default + uso na edge `sga-hinova-sync` (Frente 3).
4. Adicionar guards visuais nos formulários de plano/consultor + alerta global de credenciais (Frente 4).
5. (Opcional) Criar tela de import CSV para backfill (Frente 5).

Aprovação para executar todas as 4 frentes? Ou prefere começar só pela Frente 1 + Frente 4 (correção mínima para destravar vendas com vendedor correto) e deixar 2/3/5 para depois?