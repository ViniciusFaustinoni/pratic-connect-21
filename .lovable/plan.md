

# Análise de Gap: Fluxo de Retirada de Rastreador

## Resumo da Situação Atual

Após análise detalhada do código, identifiquei o que **JÁ ESTÁ IMPLEMENTADO** vs o que **AINDA FALTA** no fluxo de retirada.

---

## O QUE JÁ ESTÁ IMPLEMENTADO

| Etapa do Fluxo | Status | Localização |
|----------------|--------|-------------|
| **Via Cadastro (cancelamento)** | ✅ Completo | `RastreadorVinculadoModal.tsx`, `AssociadoDetalhe.tsx` |
| **Via Monitoramento (manual)** | ✅ Completo | `AbrirRetiradaModal.tsx` no menu Rastreadores |
| **Modal unificado abertura+agendamento** | ✅ Completo | `AbrirRetiradaModal.tsx` (711 linhas) |
| **Motivo** | ✅ 5 opções implementadas | cancelamento, inadimplência, exclusão, substituição, busca |
| **Sub-tipo** | ✅ Implementado | somente_retirada, retirada_com_nova_instalacao |
| **Local Base/Volante** | ✅ Implementado | localTipo no modal |
| **Técnico + Data + Período** | ✅ Implementado | Agendamento no modal |
| **WhatsApp 48h** | ✅ Implementado | Edge function `notificar-retirada-whatsapp` |
| **Situação Financeira (filtro débitos)** | ✅ Implementado | RadioGroup com 3 opções no modal |
| **Execução pelo técnico** | ✅ Completo (789 linhas) | `ExecutarRetirada.tsx` |
| **Consulta localização (fotos instalação)** | ✅ Implementado | Query para `servico_fotos` da instalação original |
| **Checklist 6 itens** | ✅ Implementado | `ChecklistRetirada.tsx` |
| **Fotos obrigatórias (3)** | ✅ Implementado | rastreador_removido, fios_isolados, acabamento |
| **Vídeo 360° + Assinatura** | ✅ Implementado | VideoCapture + SignaturePad |
| **Seleção integridade aparelho** | ✅ Implementado | RadioGroup com 4 opções |
| **Resultado A) Íntegro → estoque** | ✅ Implementado | Edge function `concluir-retirada` |
| **Resultado B) Danificado → retorno_base** | ✅ Implementado | Edge function |
| **Resultado C) Ausente** | ✅ Parcial | Botão no ExecutarRetirada, mas **FALTA TratarAusenciaRetirada modal** |
| **Resultado E) Substituição** | ✅ Implementado | Cria novo serviço de instalação |
| **Multa R$400** | ✅ Completo | `useMultaRetirada.ts` + `AplicarMultaModal.tsx` |
| **Cobrança ASAAS automática** | ✅ Implementado | Integração via `useAsaas` |
| **Cobrança manual (financeiro)** | ✅ Implementado | Opção no modal |
| **Desbloqueio cancelamento** | ✅ Implementado | Edge function `concluir-retirada` atualiza `pendencia_rastreador` |
| **Desativação plataforma externa** | ✅ Implementado | Chamadas para Rede Veículos e Softruck |

---

## O QUE AINDA FALTA IMPLEMENTAR

### 1. Página de Gestão de Retiradas (RetiradasPage) — ALTA PRIORIDADE

**Problema:** Não existe uma página dedicada para coordenadores gerenciarem retiradas. Atualmente aparecem na `FilaVistorias.tsx` misturadas com manutenções.

**O que criar:**
- Página `/monitoramento/retiradas` com:
  - Tabela com filtros (status, motivo, data, profissional)
  - Indicadores visuais de multa (💰) e bloqueio (🔒)
  - Ações: Agendar, Tratar Ausência, Aplicar Multa, Reagendar
  - Banner de alertas: "X retiradas vindas do Cadastro aguardando agendamento"
  - Métricas: Pendentes, Agendadas, Concluídas, Com Multa

**Arquivos a criar:**
- `src/pages/monitoramento/RetiradasPage.tsx`
- Adicionar rota no `App.tsx`
- Adicionar menu no sidebar de Monitoramento

---

### 2. Modal TratarAusenciaRetirada — MÉDIA PRIORIDADE

**Problema:** Quando técnico marca "Associado Ausente", o coordenador não tem modal específico para tratar (apenas existe `TratarAusenciaModal` para manutenção).

**O que criar:**
- Modal similar ao de manutenção com opções:
  1. Reagendar (nova data)
  2. Aplicar multa (48h) — abre `AplicarMultaModal`
  3. Escalar para diretoria

**Arquivos a criar:**
- `src/components/monitoramento/retirada/TratarAusenciaRetiradaModal.tsx`

---

### 3. Resultado D) "RECUSOU" — BAIXA PRIORIDADE

**Problema:** Não existe opção para técnico registrar quando associado **se recusa** a permitir a retirada (diferente de ausente).

**O que adicionar:**
- Botão "Associado Recusou" em `ExecutarRetirada.tsx`
- Status: `recusado` ou tratar como ausência com flag
- Fluxo: Multa R$400 + Escalar para diretoria/jurídico

---

### 4. Alerta Pós-Retirada Danificada na Gestão — BAIXA PRIORIDADE

**Problema:** Quando técnico conclui com `integridade !== 'integro'`, falta destacar na tabela de gestão.

**O que adicionar:**
- Na `RetiradasPage`, linha com cor amarela/laranja
- Toast automático para coordenador online
- Ícone de dano na tabela

---

### 5. Integração Completa do Menu Lateral — BAIXA PRIORIDADE

**Problema:** Verificar se menu de Monitoramento tem link para "Retiradas" quando página for criada.

---

## RESUMO DE PRIORIDADES

| Prioridade | Item | Esforço Estimado |
|------------|------|------------------|
| 🔴 ALTA | RetiradasPage (página gestão) | 3-4 horas |
| 🟡 MÉDIA | TratarAusenciaRetiradaModal | 1-2 horas |
| 🟢 BAIXA | Resultado "Recusou" | 1 hora |
| 🟢 BAIXA | Alertas visuais pós-dano | 30 min |
| 🟢 BAIXA | Menu lateral | 15 min |

---

## FLUXO ATUALIZADO COM GAPS

```text
GATILHO (qualquer saída)
│
├── VIA CADASTRO ✅ Implementado
│   └── Modal detecta rastreador → RastreadorVinculadoModal
│
└── VIA MONITORAMENTO ✅ Implementado
    └── AbrirRetiradaModal no menu Rastreadores
│
▼
FILTRO FINANCEIRO ✅ Implementado (3 opções no modal)
│
▼
ABERTURA + AGENDAMENTO ✅ Implementado (modal unificado 711 linhas)
│
▼
EXECUÇÃO ✅ Implementado (ExecutarRetirada.tsx 789 linhas)
│
▼
RESULTADO
│
├── A) ÍNTEGRO → estoque ✅
├── B) DANIFICADO → retorno_base + multa sugerida ✅
├── C) AUSENTE → status muda ✅ | ⚠️ FALTA TratarAusenciaRetiradaModal
├── D) RECUSOU → ❌ NÃO IMPLEMENTADO
└── E) SUBSTITUIÇÃO → cria instalação ✅
│
▼
PÓS-RETIRADA
├── Rastreador: estoque/triagem ✅
├── Plataforma: desativada ✅
├── Associado: pendência resolvida ✅
├── Multa: hooks + modal ✅
└── ⚠️ FALTA: Página de gestão (RetiradasPage)
```

---

## RECOMENDAÇÃO

Sugiro implementar na seguinte ordem:

1. **RetiradasPage** — Dá visibilidade completa ao coordenador
2. **TratarAusenciaRetiradaModal** — Fecha o ciclo de ausências
3. **Menu lateral** — Link para nova página
4. **Opcionais:** Recusa e alertas visuais

Deseja que eu implemente a **RetiradasPage** primeiro?

