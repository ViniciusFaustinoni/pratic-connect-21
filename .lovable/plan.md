

# Plano: 3 Ajustes no Fluxo de Manutenção

## 1. Taxa de visita — decisão do técnico, sem mostrar valor

**Em `AgendamentoManutencaoForm.tsx`:**
- Remover todo o card amarelo da taxa (linhas 222-246)
- Remover os campos `taxaVisitaAplicar` e `taxaVisitaObservacao` do formulário e do `AgendamentoFormData`

**Em `ResultadoVisitaForm.tsx`:**
- Remover o card amarelo atual com o valor de R$ 50,00 (linhas 143-171)
- Substituir por lógica automática: quando o técnico seleciona resultado `sem_problema_rastreador`, o sistema marca `taxaVisitaAplicar = true` automaticamente
- Exibir apenas um texto informativo sem valor: "O problema identificado não está relacionado ao rastreador. A taxa de visita técnica será aplicada conforme regulamento."
- Campo de observação do técnico continua obrigatório nesse caso
- Para outros resultados, taxa não se aplica — sem toggle visível

## 2. Checklist — preenchido pelo técnico no resultado

**Em `AgendamentoManutencaoForm.tsx`:**
- Remover a seção "O que será verificado?" com os checkboxes (linhas 206-220)
- Remover `tiposOcorrencia` do state e do `canSubmit`

**Em `ResultadoVisitaForm.tsx`:**
- Adicionar seção "O que foi verificado?" com os mesmos checkboxes (`TIPOS_OCORRENCIA`) logo antes do campo de resultado
- Incluir `tiposVerificados` no payload de submit
- Obrigatório marcar pelo menos 1

## 3. Atribuição automática do técnico

**Em `AgendamentoManutencaoForm.tsx`:**
- Mudar o default de `tecnicoId` de `'a_definir'` para `'automatico'`
- Renomear a opção "A definir" para "Atribuição automática" no Select
- Manter a lista de técnicos para atribuição manual como alternativa
- Quando `tecnicoId === 'automatico'`, salvar `tecnicoId: null` no serviço (igual ao fluxo normal de instalações — o cron de atribuição automática pega)

## Arquivos modificados

- `src/components/monitoramento/manutencao-rastreadores/AgendamentoManutencaoForm.tsx` — remover taxa e checklist, ajustar técnico
- `src/components/monitoramento/manutencao-rastreadores/ResultadoVisitaForm.tsx` — adicionar checklist, lógica automática de taxa
- `src/hooks/useTratativaDrawer.ts` — ajustar payload (remover taxa do agendamento, adicionar `tiposVerificados` ao resultado)

