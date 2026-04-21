

## Plano corrigido — 4 cenários de Adesão + integração com módulo Financeiro

### Tabela de regras (fonte de verdade — versão corrigida pelo usuário)

| Cenário | Cliente paga | Empresa recebe | Crédito consultor (adesão) | Débito recorrente consultor |
|---|---|---|---|---|
| **Cobrar + Base** | sim | 0 | **adesão integral** | 0 |
| **Cobrar + Rota** | sim (≥ R$ 50) | **R$ 50** (repasse volante) | adesão − R$ 50 (mín. 0) | 0 |
| **Isentar + Base** | 0 | 0 | 0 | 0 |
| **Isentar + Rota** | 0 | 0 | 0 | **R$ 50 lançado no recorrente** (abate dos próximos pagamentos) |

R$ 50 vem da configuração `comissao_ext_valor_volante` (não fixo no código).

### O que está errado hoje

1. **Textos dos cards no Cotador estão invertidos** — descrevem regras opostas às reais.
2. **Cenário não é persistido** na cotação — só `tipo_instalacao` é salvo, e o "isenta vs cobra" é inferido por `valor_adesao > 0` (frágil).
3. **Edge function aplica regras invertidas** — hoje cobra+rota dá 100% pro consultor; cobra+base dá 100% também. Repasse de R$ 50 é lançado em qualquer rota (inclusive cobra+rota).
4. **Isenta+Rota não cria débito recorrente real** — gera lançamento avulso sem vínculo com o motor de recorrente.
5. **Regras só rodam para `vendedor_externo`** — Diretor/Gerente/CLT testando: seletor aparece, mas nada acontece.
6. **Módulo Financeiro não enxerga essas movimentações** — os lançamentos vão só para `cc_vendedor_lancamentos` (extrato do consultor). O Financeiro da empresa não recebe entrada do repasse de R$ 50 nem registro do débito recorrente.

### Mudanças

#### 1. Persistir o cenário escolhido
- Migration: adicionar coluna `cenario_adesao text` em `cotacoes` (valores: `cobra_rota | cobra_base | isenta_rota | isenta_base`).
- `Cotador.tsx` e `CotacaoFormDialog.tsx`: enviar `cenario_adesao` no payload.
- Manter `tipo_instalacao` por compatibilidade.

#### 2. Corrigir textos dos 4 cards no Cotador
- **Cobrar + Base** → "Cobrar adesão + Instalação na base — Adesão integral fica com você. Nada para a empresa."
- **Cobrar + Rota** → "Cobrar adesão + Instalação na rota — R$ 50 vai para a empresa, restante fica com você. Se cobrar exatamente R$ 50, tudo vai para a empresa."
- **Isentar + Base** → "Isentar adesão + Instalação na base — Nenhuma cobrança. Zero a zero."
- **Isentar + Rota** → "Isentar adesão + Instalação na rota — R$ 50 será descontado do seu próximo recorrente."

#### 3. Reescrever bloco financeiro em `criar-instalacao-pos-pagamento`

Ler `cotacao.cenario_adesao` (com fallback `tipo_instalacao + valor_adesao` para cotações antigas) e aplicar:

- **cobra_base**:
  - `cc_vendedor_lancamentos`: 1 crédito de adesão = `valor_adesao` integral, status `a_pagar`.
  - **Financeiro empresa**: nenhuma entrada (adesão é toda do consultor).
  
- **cobra_rota**:
  - `cc_vendedor_lancamentos`: 1 crédito de adesão = `max(valor_adesao − 50, 0)`, status `a_pagar`.
  - **Financeiro empresa**: 1 entrada em `financeiro_movimentacoes` (ou tabela equivalente já usada pelo módulo Financeiro) categoria "Repasse Volante", valor R$ 50, vinculada ao contrato/instalação.
  
- **isenta_base**:
  - Nenhum lançamento. Nenhuma entrada no Financeiro.
  
- **isenta_rota**:
  - `cc_vendedor_lancamentos`: 1 débito recorrente = R$ 50, marcado com `abate_recorrente=true` (o motor existente em `useContaCorrenteVendedor.recalcularSaldos` abate dos próximos créditos recorrentes).
  - **Financeiro empresa**: 1 entrada **prevista/pendente** em `financeiro_movimentacoes` categoria "Repasse Volante (a receber do consultor)", valor R$ 50, status `pendente`, conciliada quando o débito for efetivamente abatido.

#### 4. Integração com módulo Financeiro (novo)
- Identificar a tabela atual usada pelo módulo Financeiro para entradas operacionais (auditar `financeiro_movimentacoes` / `financeiro_lancamentos` / equivalente — o nome exato será confirmado durante a leitura da estrutura na fase de implementação).
- Para cada cenário com fluxo financeiro (cobra_rota e isenta_rota), criar a entrada correspondente com:
  - Categoria fixa "Repasse Volante".
  - Vínculo com `contrato_id`, `cotacao_id`, `vendedor_id`, `cenario_adesao`.
  - Status: `recebido` (cobra_rota — entrou no caixa via cliente) ou `pendente` (isenta_rota — será abatido do recorrente do consultor).
- Garantir que o módulo Financeiro liste e filtre essas entradas por categoria.

#### 5. Estender execução para todos os perfis comerciais
- Remover o gate `role = 'vendedor_externo'` da edge function.
- Aplicar regras para qualquer vendedor responsável (Externo, CLT, Interno).
- Diretor/Gerente que cria cotação atribuindo a um consultor: as regras seguem o **vendedor atribuído**.
- Mostrar o seletor dos 4 cards para todos os papéis comerciais no Cotador (não só externo).

#### 6. Suprimir alertas indevidos
- Cotador e popup mobile "Confirmar Taxa de Filiação": não exibir "valor abaixo do sugerido" quando cenário ∈ {`isenta_base`, `isenta_rota`}.

### Critérios de aceitação

1. Diretor cria cotação para placa **QOO5C17** nos 4 cenários — cada cenário fica salvo em `cotacoes.cenario_adesao`.
2. **Cobrar + Base**: consultor recebe 100% da adesão. Financeiro empresa: nenhuma entrada.
3. **Cobrar + Rota**: consultor recebe `adesão − 50`. Financeiro empresa: entrada de R$ 50 categoria "Repasse Volante", status recebido.
4. **Isentar + Base**: nenhum lançamento em lugar nenhum.
5. **Isentar + Rota**: débito de R$ 50 no recorrente do consultor + entrada pendente de R$ 50 no Financeiro empresa, conciliada quando o abatimento ocorrer.
6. Regras valem para Externo, CLT e cotações criadas por Diretor/Gerente.
7. Seletor dos 4 cards visível para todos os perfis comerciais no Cotador.
8. Popup mobile não alerta "abaixo do sugerido" em cenários isentos.
9. Módulo Financeiro lista as movimentações de "Repasse Volante" filtráveis por período/vendedor/contrato.

### Fora de escopo

- Refatorar tabelas de comissão.
- Backfill de cotações antigas (continuam usando fallback `tipo_instalacao + valor_adesao`).
- Criar módulo Financeiro do zero (apenas integrar com a tabela já existente).
- Conciliação automática bancária (a entrada é registrada; conciliação manual segue o fluxo atual do Financeiro).

