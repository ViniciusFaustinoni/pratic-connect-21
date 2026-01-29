
# Plano de Revisao do Modulo Juridico

## Analise Comparativa: PDF vs Codigo Atual

Apos revisar detalhadamente o documento "MODULO JURIDICO - SGA Pratic 2.0" (44 paginas) e comparar com o codigo existente, identifiquei os gaps e melhorias necessarias para alinhar o modulo com as especificacoes do PDF.

---

## RESUMO EXECUTIVO

### Status Atual por Area

| Area | Conformidade | Gaps Principais |
|------|--------------|-----------------|
| Dashboard | 75% | Falta card "Valor em Disputa", graficos pizza/barras, secao prazos hoje |
| Processos | 80% | Falta checkbox lote, acoes em lote, filtro por advogado/periodo |
| Detalhe Processo | 85% | Falta secao Risco/Provisao, resumo caso, indicador vencido |
| Advogados | 70% | Falta estatisticas (taxa sucesso), aba honorarios, dados bancarios |
| Prazos | 85% | Falta visao calendario, modal cumprir com protocolo/anexo |
| Audiencias | 90% | Falta campo preposto, resultado detalhado (acordo, nova data) |
| Consultas | 75% | Falta tipo consulta, conclusao (favoravel/desfavoravel), recomendacoes |

---

## 1. DASHBOARD JURIDICO

**Arquivo:** `src/pages/juridico/JuridicoDashboard.tsx`

### Gaps Identificados

| Item PDF | Status Atual | Acao Necessaria |
|----------|--------------|-----------------|
| Card "Valor em Disputa" (soma todas causas) | Ausente | Adicionar query soma valor_causa |
| Sub-info cards (Passivos/Ativos, Hoje/Amanha) | Parcial | Expandir detalhamento |
| Grafico Pizza: Processos por Tipo | Ausente | Implementar com recharts |
| Grafico Barras: Processos por Status | Ausente | Implementar com recharts |
| Secao "Prazos Vencendo Hoje" com tabela | Parcial | Criar secao separada |
| Link "Ver no Financeiro" em cada card | Ausente | Adicionar navegacao |

### Implementacao

1. Adicionar card "Valor em Disputa" com query:
```
SELECT 
  SUM(CASE WHEN natureza = 'reu' THEN valor_causa ELSE 0 END) as risco,
  SUM(CASE WHEN natureza = 'autor' THEN valor_causa ELSE 0 END) as a_receber
FROM processos WHERE status = 'ativo'
```

2. Criar componentes de grafico:
- `GraficoProcessosPorTipo` - Pizza com Civel, Trabalhista, Criminal, etc
- `GraficoProcessosPorStatus` - Barras com Ativos, Suspensos, Encerrados

3. Expandir cards com sub-informacoes:
- Processos Ativos: "Passivos: 89 | Ativos: 58"
- Prazos Urgentes: "Hoje: 5 | Amanha: 8 | 3 vencidos!"
- Audiencias: "Realizadas: 12 | Pendentes: 6"

---

## 2. LISTA DE PROCESSOS

**Arquivo:** `src/pages/juridico/ProcessosList.tsx`

### Gaps Identificados

| Item PDF | Status Atual | Acao Necessaria |
|----------|--------------|-----------------|
| Checkbox para selecao em lote | Ausente | Adicionar coluna checkbox |
| Acoes em lote (Exportar, Enviar, Arquivar) | Ausente | Criar barra acoes |
| Filtro por Advogado (dropdown) | Ausente | Adicionar filtro |
| Filtro por Periodo (data distribuicao) | Ausente | Adicionar date range |
| Coluna "Proximo Prazo" | Ausente | Adicionar join com prazos |
| Resumo topo (Passivos R$ | Ativos R$) | Parcial | Incluir valores monetarios |
| Icones acao: Ver documentos, Ver prazos, Arquivar | Parcial | Expandir menu acoes |

### Implementacao

1. Adicionar estado `selectedItems` e checkbox na primeira coluna
2. Criar barra de acoes flutuante quando itens selecionados:
   - Exportar Lista (Excel/PDF)
   - Enviar para Advogado (email)
   - Arquivar Selecionados
3. Adicionar filtros de advogado e periodo
4. Expandir query para trazer proximo prazo pendente
5. Atualizar cards de resumo com valores monetarios

---

## 3. DETALHE DO PROCESSO

**Arquivo:** `src/pages/juridico/ProcessoDetalhe.tsx`

### Gaps Identificados

| Item PDF | Status Atual | Acao Necessaria |
|----------|--------------|-----------------|
| Secao Valores com Risco de Perda e Provisao | Ausente | Adicionar campos |
| Calculo automatico provisao (Valor x % Risco) | Ausente | Implementar formula |
| Secao "Resumo do Caso" com estrategia | Parcial | Expandir campo |
| Aba Movimentacoes com origem (Tribunal/Interno) | Ausente | Adicionar coluna origem |
| Botao "Atualizar do Tribunal" | Ausente | Criar integracao |
| Vinculo visual Sinistro/Cobranca | Parcial | Melhorar UI |
| Badge status encerramento (Ganho/Perda/Acordo) | Parcial | Adicionar icones |

### Novos Campos na Tabela `processos`

- `risco_perda` (enum: baixo/medio/alto)
- `percentual_risco` (numeric)
- `provisao_estimada` (numeric, calculado)
- `estrategia_defesa` (text)

### Implementacao

1. Adicionar card "Valores e Risco" com:
   - Valor da Causa
   - Risco de Perda (Baixo/Medio/Alto com cores)
   - Provisao Estimada (calculada automaticamente)
   - Custas Pagas / Honorarios Previstos

2. Na aba Movimentacoes, adicionar coluna "Origem":
   - Tribunal = Publicacao oficial
   - Interno = Registrado manualmente

3. Adicionar campo `estrategia` na aba Resumo

---

## 4. FORMULARIO DE PROCESSO

**Arquivo:** `src/pages/juridico/ProcessoForm.tsx`

### Gaps Identificados

| Item PDF | Status Atual | Acao Necessaria |
|----------|--------------|-----------------|
| Campo "Estado" (UF do processo) | Ausente | Adicionar select estados |
| Campo "Juiz" | Ausente | Adicionar campo texto |
| Tipo de Acao especifico (dropdown) | Ausente | Adicionar campo |
| Risco de Perda (radio: Baixo/Medio/Alto) | Ausente | Adicionar campo |
| Provisao Estimada (calculada) | Ausente | Adicionar campo calculado |
| Vinculo Cobranca/Inadimplencia | Ausente | Adicionar combobox |
| Vinculo Funcionario (trabalhista) | Ausente | Adicionar combobox |
| Dados advogado parte contraria (OAB, telefone, email) | Parcial | Expandir campos |

### Implementacao

1. Adicionar secao "Classificacao de Risco":
```
Risco de Perda:
○ Baixo (0-30%) - Provavel vitoria
○ Medio (31-70%) - Incerto  
○ Alto (71-100%) - Provavel perda

Provisao Estimada: R$ [calculado] (Valor x % Risco)
```

2. Adicionar campo `tipo_acao`:
- Acao de Indenizacao
- Acao de Obrigacao de Fazer
- Acao de Cobranca
- Acao de Regresso
- Execucao de Titulo
- Reclamacao Trabalhista
- Outros

3. Expandir campos da parte contraria:
- Telefone, Email, Endereco

---

## 5. CADASTRO DE ADVOGADOS

**Arquivo:** `src/pages/juridico/AdvogadosList.tsx`

### Gaps Identificados

| Item PDF | Status Atual | Acao Necessaria |
|----------|--------------|-----------------|
| Card com foto/avatar | Parcial | Melhorar layout |
| Taxa de Sucesso (%) | Ausente | Calcular estatistica |
| Tempo Medio de Processo | Ausente | Calcular estatistica |
| Dados Bancarios (banco, agencia, conta, pix) | Ausente | Adicionar campos |
| Tabela de Honorarios por tipo de acao | Ausente | Criar estrutura |
| Aba Estatisticas com graficos | Ausente | Criar componente |
| Historico de Resultados (Ganhos/Perdas/Acordos) | Ausente | Criar query |

### Novos Campos na Tabela `advogados`

- Dados bancarios ja existem no schema
- Precisa criar tabela `advogados_honorarios` para tabela de valores

### Implementacao

1. Criar modal/pagina detalhe do advogado com abas:
   - Dados: Informacoes pessoais e profissionais
   - Processos: Lista de processos atribuidos
   - Honorarios: Tabela de valores por tipo de acao
   - Estatisticas: Graficos de performance

2. Calcular metricas:
```
Taxa Sucesso = (Ganhos / (Ganhos + Perdas)) * 100
Tempo Medio = AVG(data_encerramento - data_distribuicao)
```

3. Adicionar graficos:
- Barras de resultados (Ganhos/Perdas/Acordos)
- Pizza de processos por area

---

## 6. CONTROLE DE PRAZOS

**Arquivo:** `src/pages/juridico/PrazosControl.tsx`

### Gaps Identificados

| Item PDF | Status Atual | Acao Necessaria |
|----------|--------------|-----------------|
| Visao em Calendario (grid mensal) | Ausente | Implementar calendario |
| Toggle Calendario/Lista | Ausente | Adicionar tabs |
| Filtro por Advogado | Ausente | Adicionar dropdown |
| Card "Cumpridos no Mes" | Ausente | Adicionar contagem |
| Modal cumprir com campo Protocolo | Ausente | Expandir modal |
| Anexar peticao protocolada | Ausente | Adicionar upload |
| Opcao "Gerar proximo prazo automaticamente" | Ausente | Adicionar checkbox |
| Alertas configurados (7d, 3d, 1d antes) | Ausente | Adicionar configuracao |

### Implementacao

1. Criar visualizacao calendario similar a AudienciasAgenda:
- Grid mensal com dias
- Indicador de quantidade de prazos por dia
- Cores por urgencia (vermelho=vencido, amarelo=proximo)

2. Expandir modal "Cumprir Prazo":
```
Data do Cumprimento: [campo data]
Protocolo/Numero: [texto]
Observacoes: [textarea]

DOCUMENTO
[Anexar peticao protocolada]

PROXIMO PRAZO (opcional)
[ ] Gerar proximo prazo automaticamente
Tipo: [dropdown]
Dias: [numero] dias uteis
```

3. Adicionar sistema de notificacoes/alertas

---

## 7. AGENDA DE AUDIENCIAS

**Arquivo:** `src/pages/juridico/AudienciasAgenda.tsx`

### Gaps Identificados

| Item PDF | Status Atual | Acao Necessaria |
|----------|--------------|-----------------|
| Campo "Sera necessario preposto" | Ausente | Adicionar checkbox e nome |
| Resultado detalhado (acordo, valor, nova data) | Parcial | Expandir modal |
| Opcao "Audiencia virtual" com link | OK | Ja implementado |
| Resumo/Ata da audiencia | Parcial | Expandir campo |
| Notificacoes configuradas (7d, 1d, 2h antes) | Ausente | Adicionar |

### Implementacao

1. No modal Nova Audiencia, adicionar:
```
[ ] Sera necessario preposto
Nome do preposto: [texto]
```

2. Expandir modal Registrar Resultado:
```
Status:
○ Realizada
○ Redesignada (nova data)
○ Cancelada
○ Nao realizada (ausencia)

SE REALIZADA:
○ Acordo realizado - Valor: R$ [campo]
○ Sem acordo - Prosseguimento
○ Sentenca em audiencia
○ Instrucao concluida - Concluso

SE REDESIGNADA:
Nova Data: [campo]
Nova Hora: [campo]
Motivo: [texto]
```

---

## 8. CONSULTAS JURIDICAS

**Arquivo:** `src/pages/juridico/ConsultasJuridicas.tsx`

### Gaps Identificados

| Item PDF | Status Atual | Acao Necessaria |
|----------|--------------|-----------------|
| Tipo de Consulta (parecer, analise, orientacao) | Ausente | Adicionar campo |
| Setor solicitante com dropdown | Parcial | Melhorar options |
| Urgencia (Normal 5d, Urgente 2d, Imediata) | Parcial | Expandir opcoes |
| Conclusao do Parecer (Favoravel/Desfavoravel/Parcial) | Ausente | Adicionar campo |
| Recomendacoes (checkboxes) | Ausente | Adicionar estrutura |
| Anexar parecer em PDF | Ausente | Adicionar upload |
| KPI "Tempo medio resposta" | Ausente | Calcular metrica |
| Notificacao ao solicitante (email/whatsapp) | Ausente | Integrar |

### Novos Campos na Tabela `consultas_juridicas`

- `tipo_consulta` (enum)
- `conclusao_parecer` (enum: favoravel/desfavoravel/parcial/informativo)
- `recomendacoes` (jsonb array)
- `parecer_arquivo_url` (text)

### Implementacao

1. Adicionar campo tipo consulta:
- Parecer sobre cobertura
- Analise contratual
- Orientacao trabalhista
- Consulta tributaria
- Analise de risco
- Outros

2. Expandir modal Responder Consulta:
```
CONCLUSAO:
○ FAVORAVEL (pode/deve ser feito)
○ DESFAVORAVEL (nao pode/nao deve)
○ PARCIALMENTE FAVORAVEL (com ressalvas)
○ APENAS INFORMATIVO

RECOMENDACOES:
[ ] Aprovar cobertura
[ ] Negar cobertura
[ ] Solicitar laudo complementar
[ ] Encaminhar para diretoria
[ ] Outro: [texto]

[Anexar parecer em PDF]
```

3. Adicionar KPI "Tempo medio resposta":
```
AVG(respondido_em - created_at) em dias
```

---

## 9. COMPONENTES/MODAIS A CRIAR/MODIFICAR

| Componente | Acao |
|------------|------|
| `src/components/juridico/GraficosJuridico.tsx` | Criar - Pizza e Barras para dashboard |
| `src/components/juridico/BatchActionsBarProcessos.tsx` | Criar - Acoes em lote |
| `src/components/juridico/RiscoProvisaoCard.tsx` | Criar - Card valores/risco |
| `src/components/juridico/CalendarioPrazos.tsx` | Criar - Visao calendario |
| `src/components/juridico/CumprirPrazoModal.tsx` | Expandir - Protocolo e anexo |
| `NovaAudienciaModal.tsx` | Modificar - Adicionar preposto |
| `ResponderConsultaModal.tsx` | Modificar - Adicionar conclusao/recomendacoes |
| `AdvogadoDetalheModal.tsx` | Criar - Abas com estatisticas |

---

## 10. INTEGRACAO ENTRE MODULOS (FLUXOS)

### Fluxo 1: Sinistro Negado -> Processo

Verificar se ao criar processo vinculado a sinistro:
1. Dados do sinistro sao pre-preenchidos
2. Associado e preenchido automaticamente
3. Notificacao para setor de eventos

### Fluxo 2: Sinistro Pago -> Acao de Regresso

Criar gatilho quando sinistro e encerrado com terceiro culpado:
1. Notificar Juridico
2. Sugerir criacao de processo ATIVO

### Fluxo 3: Inadimplente -> Execucao Judicial

Criar botao em Cobranca para solicitar execucao:
1. Link de Cobranca para Juridico
2. Pre-preencher dados do devedor

### Fluxo 4: Processo -> Financeiro

Quando registrar custa/honorario:
1. Criar automaticamente conta a pagar no Financeiro
2. Vincular processo_id

---

## PRIORIDADES DE IMPLEMENTACAO

### Fase 1 - Essencial (Esta sessao)

1. Dashboard: Card Valor em Disputa + Graficos Pizza/Barras
2. Processos: Checkbox lote + Acoes em lote
3. Consultas: Tipo consulta + Conclusao parecer + Recomendacoes

### Fase 2 - Importante

1. Prazos: Visao Calendario
2. Detalhe Processo: Risco/Provisao
3. Audiencias: Preposto + Resultado detalhado

### Fase 3 - Melhorias

1. Advogados: Estatisticas e Honorarios
2. Form Processo: Campos expandidos
3. Integracoes entre modulos

---

## DETALHES TECNICOS

### Query Valor em Disputa

```sql
SELECT 
  SUM(CASE WHEN natureza = 'reu' THEN valor_causa ELSE 0 END) as valor_risco,
  SUM(CASE WHEN natureza = 'autor' THEN valor_causa ELSE 0 END) as valor_a_receber,
  COUNT(*) as total_processos
FROM processos 
WHERE status = 'ativo'
```

### Calculo Taxa Sucesso Advogado

```sql
SELECT 
  a.id,
  a.nome,
  COUNT(*) FILTER (WHERE p.status IN ('encerrado_procedente', 'acordo')) as ganhos,
  COUNT(*) FILTER (WHERE p.status = 'encerrado_improcedente') as perdas,
  ROUND(
    COUNT(*) FILTER (WHERE p.status IN ('encerrado_procedente', 'acordo'))::numeric * 100 / 
    NULLIF(COUNT(*) FILTER (WHERE p.status IN ('encerrado_procedente', 'encerrado_improcedente', 'acordo')), 0)
  , 1) as taxa_sucesso
FROM advogados a
LEFT JOIN processos p ON p.advogado_id = a.id
GROUP BY a.id, a.nome
```

### Estrutura Tipo Consulta

```typescript
export type TipoConsulta = 
  | 'parecer_cobertura'
  | 'analise_contratual'
  | 'orientacao_trabalhista'
  | 'consulta_tributaria'
  | 'analise_risco'
  | 'outros';

export type ConclusaoParecer = 
  | 'favoravel'
  | 'desfavoravel'
  | 'parcial'
  | 'informativo';
```

### Campos Preposto para Audiencias

```typescript
// Adicionar em processos_audiencias
preposto_necessario: boolean;
preposto_nome?: string;
preposto_documento?: string;
```
