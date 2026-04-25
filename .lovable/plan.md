## Diagnóstico atual

A régua de cobrança **já existe e está funcional**, alinhada aos dados do SGA:

- ✅ **18 etapas configuradas** (D-6 lembrete até D+61 reativação) na tabela `reguas_cobranca`
- ✅ **13 templates Meta WhatsApp APROVADOS** (`d_6_lembrete_desconto_v1`, `d0_boleto_vence_hoje_v1`, etc.) — não precisa criar nenhum
- ✅ **Edge function `executar-regua-cobranca`** já busca cobranças de duas fontes (`asaas_cobrancas` + `cobrancas` com `origem='sga_hinova'`), agrupa por associado, calcula dias de atraso e dispara WhatsApp com a linha digitável correta
- ✅ **Cron diário às 12h** já agendado (`executar-regua-cobranca-diario`)
- ✅ **141.512 cobranças SGA importadas**, **2.868 em aberto**, **100% com linha digitável**

**O que falta** (foco desta entrega): controle global de Ativar/Desativar a régua sem precisar mexer em etapas individuais.

---

## Mudanças propostas

### 1. Botão global "Ativar / Desativar régua"
Topo da aba `Régua` (`src/pages/cobranca/ReguaCobranca.tsx`):

- **Switch grande** com rótulo dinâmico ("Régua ATIVA" verde / "Régua DESATIVADA" cinza)
- **Tooltip explicativo** quando desativada: "Nenhuma mensagem, ligação ou ação será disparada — incluindo execução manual e cron diário"
- **Confirmação modal** ao desativar (impacto alto, evita clique acidental)
- Persiste no campo `reguas_cobranca.ativa` (já existe no schema)

### 2. Bloqueio absoluto na edge function
`supabase/functions/executar-regua-cobranca/index.ts`:

- Lógica atual já busca `.eq('ativa', true)` e retorna sem fazer nada se não achar régua
- **Reforçar**: log explícito `"Régua DESATIVADA — execução abortada"` + retorno padronizado `{ ativa: false, message: 'Régua desativada — nenhuma ação executada' }`
- Vale tanto para o cron diário quanto para o botão "Executar agora"

### 3. Bloqueio no botão "Executar agora"
- Se régua estiver desativada, botão fica `disabled` com tooltip "Ative a régua para executar"
- Garantia dupla: front bloqueia + back valida

### 4. Indicador visual no header
- Badge de status no topo da página `/financeiro/regua`
- Quando desativada: banner amarelo "⚠️ Régua de cobrança DESATIVADA — nenhum disparo automático ocorrerá"

### 5. Auditoria
- Toda mudança no toggle grava evento em `cobranca_eventos` com `tipo='regua_status'` e `dados.acao='ativada'|'desativada'` + `usuario_id` para rastreabilidade

---

## Detalhes técnicos

**Arquivos alterados:**
- `src/pages/cobranca/ReguaCobranca.tsx` — toggle + confirmação + banner + bloqueio do botão
- `supabase/functions/executar-regua-cobranca/index.ts` — log explícito + retorno padronizado quando desativada

**Sem mudanças necessárias em:**
- Schema (campo `ativa` já existe em `reguas_cobranca`)
- Templates Meta (todos os 13 já APROVED)
- Cron (já configurado)
- Mapeamento de variáveis (`linha_digitavel` já busca de SGA primeiro)

**Sem migrations** — apenas mutation no `ativa` via `supabase.from('reguas_cobranca').update({ ativa: false })`.

---

## Validação pós-implementação

1. Ativar régua → executar manual → ver eventos criados em `cobranca_eventos`
2. Desativar régua → executar manual → confirmar retorno `{ ativa: false }` e zero eventos
3. Aguardar próxima execução do cron → confirmar nos logs da edge function que aborta
4. Reativar → próxima execução volta a disparar normalmente

## Observação sobre os valores divergentes (faturas)

Continua pendente o reenvio da planilha `INADIMPLENTES_ABRIL_DE_2026.xlsx` em CSV para investigar a divergência específica de valores. Esta entrega trata da **régua** (controle de envio); a investigação de **valores** continua aguardando o arquivo legível.
