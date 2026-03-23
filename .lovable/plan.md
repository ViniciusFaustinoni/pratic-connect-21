

# Plano: Inteligencia Geografica de Viagem — Regras Automaticas

## Resumo

Identificar automaticamente instalacoes em municipios de viagem, aplicar SLA diferenciado (72h default), exibir badge no painel do coordenador, registrar diarias na jornada do tecnico, e incluir prazo no contrato. Sem impacto na tela do consultor.

---

## PARTE 1 — Configs + Schema (Migration)

### 1a. Inserir configs padrao na tabela `configuracoes`

- `viagem_valor_diaria` = `0`
- `viagem_sla_horas` = `72`

### 1b. Novos campos no banco

**Tabela `servicos`**:
- `tipo_deslocamento text DEFAULT 'local'` — valores: `local`, `viagem`, `prestador`

**Tabela `turnos_profissionais`**:
- `em_viagem boolean DEFAULT false`
- `bonus_viagem numeric DEFAULT 0`

### 1c. Trigger: marcar tipo_deslocamento automaticamente

Criar trigger `set_tipo_deslocamento_on_servico()` que roda no INSERT/UPDATE da tabela `servicos`:
- Se `cidade` e `uf` preenchidos, buscar na `municipios_atendimento`
- Se `tipo_atendimento = 'viagem'`, setar `tipo_deslocamento = 'viagem'`
- Se `tipo_atendimento = 'prestador'`, setar `tipo_deslocamento = 'prestador'`
- Senao, manter `local`

Isso cobre todos os pontos de criacao de servico (trigger sync_instalacao_to_servicos, inserts manuais, etc).

---

## PARTE 2 — Secao "Regras de Viagem" no MapaAtendimento

**Arquivo**: `src/components/gestao-comercial/MapaAtendimento.tsx`

Adicionar Card abaixo da tabela de municipios com:
- Valor da diaria (R$): Input numerico, chave `viagem_valor_diaria`
- SLA viagem (horas): Input numerico, chave `viagem_sla_horas`
- Botao salvar (usa upsert/update na tabela `configuracoes`)
- Carregar valores via query existente

---

## PARTE 3 — SLA Diferenciado no SlaIndicador

**Arquivo**: `src/components/ui/SlaIndicador.tsx`

- Adicionar prop opcional `tipoDeslocamento?: string`
- No `useSlaConfig`, buscar tambem `viagem_sla_horas` da tabela `configuracoes`
- No calculo: se `tipoDeslocamento === 'viagem'` e tipo for instalacao, usar `viagem_sla_horas` em vez de `sla_horas_instalacao`

---

## PARTE 4 — Badge "Viagem" na Lista de Instalacoes

**Arquivo**: `src/pages/monitoramento/InstalacoesList.tsx`

Na celula de Endereco (linha ~293), buscar municipio da instalacao na `municipios_atendimento` e se tipo = viagem, exibir Badge laranja "Viagem" ao lado do texto do bairro/cidade. Query feita uma unica vez para todos os municipios (bulk), nao por linha.

Tambem passar `tipoDeslocamento` ao `SlaIndicador` na coluna Prazo.

---

## PARTE 5 — Info de Viagem no Detalhe da Instalacao

**Arquivo**: `src/pages/monitoramento/InstalacaoDetalhe.tsx`

No card Endereco (linha ~349), se o municipio for viagem:
- Badge "Viagem" laranja
- Texto: "SLA: [viagem_sla_horas]h uteis"
- Se `viagem_valor_diaria > 0`: "Diaria: R$ [valor]"

Query condicional na `municipios_atendimento` + `configuracoes`.

---

## PARTE 6 — Registro na Jornada do Tecnico

### 6a. JornadaProfissionalCard (RH)

**Arquivo**: `src/components/rh/JornadaProfissionalCard.tsx`

Adicionar props opcionais `emViagem?: boolean` e `bonusViagem?: number`:
- Se `emViagem`, exibir Badge discreto "Viagem" ao lado do nome
- Se `bonusViagem > 0`, exibir linha "+ R$ [valor] diaria de viagem" na secao de resultado

### 6b. JornadasProfissionais (RH)

**Arquivo**: `src/pages/rh/JornadasProfissionais.tsx`

O select de `turnos_profissionais` ja usa `*` — novos campos `em_viagem` e `bonus_viagem` virao automaticamente. Passar para o `JornadaProfissionalCard`.

### 6c. InstaladorPerfil (Tecnico)

**Arquivo**: `src/pages/instalador/InstaladorPerfil.tsx`

Na query de resumo do mes, buscar tambem `em_viagem, bonus_viagem`. Somar `bonus_viagem` dos turnos com `em_viagem = true`. Se total > 0, exibir: "Diarias de viagem no mes: R$ [total]".

---

## PARTE 7 — Prazo no Contrato (Autentique)

**Arquivo**: `supabase/functions/autentique-create/index.ts`

No `mapearDadosParaTemplate` ou antes de gerar HTML:
- Buscar `municipios_atendimento` pelo municipio do associado/contrato
- Se tipo = viagem, buscar `viagem_sla_horas` das configs
- Adicionar variavel `{{prazo_instalacao}}` com valor "72 horas uteis" (ou valor configurado)
- Para volante, usar o SLA padrao

O template HTML no banco (tabela `documento_templates`) devera conter a variavel `{{prazo_instalacao}}` na secao de condicoes. Sera um ajuste de dados, nao de estrutura.

---

## Arquivos afetados

| Arquivo | Alteracao |
|---|---|
| DB migration | Colunas servicos/turnos + configs + trigger |
| `src/components/gestao-comercial/MapaAtendimento.tsx` | Secao "Regras de Viagem" |
| `src/components/ui/SlaIndicador.tsx` | Prop tipoDeslocamento + SLA viagem |
| `src/pages/monitoramento/InstalacoesList.tsx` | Badge viagem + SLA diferenciado |
| `src/pages/monitoramento/InstalacaoDetalhe.tsx` | Info viagem no card endereco |
| `src/components/rh/JornadaProfissionalCard.tsx` | Badge viagem + bonus |
| `src/pages/rh/JornadasProfissionais.tsx` | Passar novos campos |
| `src/pages/instalador/InstaladorPerfil.tsx` | Total diarias do mes |
| `supabase/functions/autentique-create/index.ts` | Variavel prazo_instalacao |

