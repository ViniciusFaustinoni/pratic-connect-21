

# Plano: Redesign do Fluxo de Substituicao de Placa

## Problema

O fluxo atual de substituicao e um wizard interno de 8 etapas custom (elegibilidade, evento ativo, rastreador, novo veiculo, vistoria, beneficios, financeiro, conclusao). O usuario quer que ele siga a mesma logica da cotacao padrao: busca por placa → cotacao do novo veiculo → gera link publico → associado completa online.

## Nova Logica

```text
CONSULTOR (interno)                          ASSOCIADO (link publico)
─────────────────                          ──────────────────────────
1. Busca por PLACA (nao por associado)     
2. Sistema identifica associado + veiculo  
3. Valida elegibilidade (em dia, etc)      
4. Abre cotacao normal do novo veiculo     
   (cotador padrao, com tipo_entrada=      
    substituicao + associado_id + veiculo  
    _antigo_id nos dados_extras)           
5. Salva cotacao → gera link publico       
                                           6. Plano → Contrato → Vistoria
                                           7. AGENDAMENTO ESPECIAL:
                                              "Ambos veiculos estarao no
                                               mesmo local?"
                                              SIM → 1 agendamento 
                                                     (retirada + instalacao)
                                              NAO → 2 agendamentos separados
                                                     (instalacao novo +
                                                      retirada antigo)
                                           8. Pagamento → Conclusao

POS-EFETIVACAO:
- Veiculo antigo: desativado (ativo=false, status=inativo)
- Veiculo novo: ativado com carencia RESIDUAL para itens que existiam
  no plano anterior, e carencia PADRAO para itens novos
```

## Mudancas

### 1. OutrasEntradasMenu.tsx — Substituicao por PLACA

Quando `selectedTipo === 'substituicao'`:
- Trocar busca por associado para busca por PLACA (reutilizar `useBuscaPlaca`)
- Ao selecionar resultado da placa, preencher `selectedAssociadoId` e `veiculoAntigoId`
- Verificar debitos normalmente
- Ao clicar "Prosseguir": navegar para o cotador com query params:
  ```
  /vendas/cotacao?associado_id=X&tipo_entrada=substituicao&veiculo_antigo_id=Y
  ```

### 2. Cotador.tsx e Cotacao.tsx — Suporte a tipo_entrada=substituicao

- Detectar `tipo_entrada=substituicao` e `veiculo_antigo_id` dos search params
- Mesmo comportamento da inclusao: pular etapa 1 (dados do associado), pre-preencher com dados do associado existente
- Salvar `tipo_entrada: 'substituicao'` e `veiculo_antigo_id` em `dados_extras` da cotacao
- Na tela do Cotador, exibir banner informativo "Substituicao de Placa — Veiculo atual: [placa] [modelo]"

### 3. CotacaoContratacao.tsx (link publico) — Etapa de Agendamento Especial

Quando a cotacao tem `dados_extras.tipo_entrada === 'substituicao'`:
- Na etapa de Vistoria/Agendamento, ANTES do agendamento padrao, mostrar pergunta:
  **"Os dois veiculos estarao no mesmo local no dia do servico?"**
  - **SIM**: Segue agendamento normal (1 servico de retirada+instalacao)
  - **NAO**: Mostra 2 formularios de agendamento:
    1. "Agendamento de Instalacao (veiculo novo)" 
    2. "Agendamento de Retirada (veiculo antigo)"
- Criar registros na tabela `servicos` para cada agendamento

### 4. Logica de Carencia na Efetivacao

Criar/ajustar a logica de efetivacao da substituicao para:

1. Buscar o contrato/plano ANTERIOR do veiculo antigo
2. Buscar coberturas e beneficios do plano anterior (`planos_coberturas` + `planos_beneficios`)
3. Buscar coberturas e beneficios do plano NOVO
4. Para cada item do plano novo:
   - Se existia no plano anterior → herdar carencia RESIDUAL (dias restantes do contrato anterior)
   - Se e item NOVO (nao existia antes) → aplicar carencia padrao configurada no item (`carencia_dias`) ou fallback global (`carencia_dias_padrao`)
5. Gravar as datas de carencia individuais por item no contrato novo

### 5. Desativacao do Veiculo Antigo

Na efetivacao:
- `veiculos` SET `ativo = false, status = 'inativo'` WHERE `id = veiculo_antigo_id`
- Desativar protecao do veiculo antigo na tabela de monitoramento

### 6. Limpeza

- Remover ou depreciar os Steps internos que nao serao mais usados (`StepNovoVeiculo`, `StepBeneficios`, `StepFinanceiro`, etc.) — o fluxo agora e via cotacao padrao
- Manter `SubstituicaoVeiculoPage.tsx` mas simplificar para exibir apenas resumo/status (nao mais wizard completo)

## Arquivos Principais

**Modificados:**
- `src/components/vendas/OutrasEntradasMenu.tsx` — busca por placa + navegacao
- `src/pages/vendas/Cotador.tsx` — detectar substituicao, banner, dados_extras
- `src/pages/vendas/Cotacao.tsx` — detectar substituicao, pular etapa 1
- `src/pages/public/CotacaoContratacao.tsx` — pergunta "mesmo local?", 2 agendamentos
- `src/hooks/useSubstituicaoVeiculo.ts` — logica de efetivacao com carencia residual

**Criados:**
- `src/components/cotacao-publica/AgendamentoSubstituicao.tsx` — componente da pergunta "mesmo local?" + duplo agendamento

## Detalhes Tecnicos

### Carencia Residual

```text
Contrato anterior: data_carencia_inicio = 2026-01-01, data_carencia_fim = 2026-05-01
Hoje: 2026-04-08
Dias restantes: 23 dias

Item "Roubo/Furto" existia no plano anterior:
  → carencia = 23 dias (residual)

Item "Vidros e Farois" NAO existia no plano anterior:
  → carencia = carencia_dias do catalogo (ex: 120 dias)
```

### dados_extras na cotacao

```json
{
  "tipo_entrada": "substituicao",
  "associado_id": "uuid",
  "veiculo_antigo_id": "uuid",
  "veiculo_antigo_placa": "ABC1D23",
  "veiculo_antigo_modelo": "Honda Civic"
}
```

