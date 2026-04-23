
## Área de detalhes/auditoria antes de marcar comissão como paga

### Objetivo
Adicionar uma visualização de conferência para que o diretor/gestor veja exatamente por que a comissão foi gerada antes de liquidar o pagamento.

A ação “Pagar” deixará de marcar como paga diretamente. Primeiro abrirá um modal/drawer com:

```text
Comissão selecionada
  -> plano vendido
  -> grade aplicada
  -> snapshot/versionamento da grade
  -> parcela resolvida
  -> regra aplicada ao perfil
  -> vendedor de origem
  -> cadeia hierárquica
  -> valores base e cálculo
  -> status atual
  -> botão final "Confirmar pagamento"
```

---

## O que já existe e será reaproveitado

O sistema já possui parte dos dados necessários:

- `comissoes.grade_id`
- `comissoes.grade_versao_id`
- `comissoes.plano_id`
- `comissoes.plano_regra_id`
- `comissoes.role_destinatario`
- `comissoes.tipo_calculo`
- `comissoes.parcela_numero`
- `comissoes.valor_base`
- `comissoes.percentual_aplicado`
- `comissoes.valor_comissao`
- `comissoes.valor_total`
- `grades_comissao_versoes.snapshot`
- `grade_comissao_plano_regras`
- `contratos.vendedor_id`
- `hierarquia_vendas`

Hoje a tela de pagamentos já mostra base, percentual e valor, mas não mostra a auditoria completa antes de pagar.

---

## 1. Criar componente de detalhes da comissão

Novo componente:

- `src/components/comissoes/ComissaoDetalhesPagamentoModal.tsx`

Ele será aberto ao clicar em “Pagar” na tela:

- `src/pages/comissoes/Pagamentos.tsx`

### Conteúdo do modal

#### Resumo principal
Exibir:

- destinatário da comissão;
- perfil remunerado;
- status atual;
- valor final;
- data de geração;
- contrato/cobrança, quando houver;
- plano vendido;
- grade utilizada;
- versão da grade.

#### Regra aplicada
Exibir a regra que gerou aquela comissão:

```text
Plano: Select Exclusive
Grade: Grade Select RJ
Versão: v3
Parcela resolvida: 2ª parcela
Perfil remunerado: Supervisor de Vendas
Tipo de cálculo: Percentual
Regra configurada: 5%
Base de cálculo: R$ 250,00
Valor calculado: R$ 12,50
Valor final: R$ 12,50
```

Para valor fixo:

```text
Tipo de cálculo: Valor fixo
Regra configurada: R$ 30,00
Base de cálculo: R$ 250,00
Valor final: R$ 30,00
```

#### Snapshot da grade
Mostrar uma seção “Snapshot da grade no momento da geração”.

Usar `grades_comissao_versoes.snapshot`, não a configuração atual da grade, para evitar divergência quando a grade já tiver sido editada depois.

A visualização será resumida, por plano/parcela/perfil:

```text
Snapshot v3 — Grade Select RJ

Plano vendido:
- Select Exclusive

Parcela resolvida:
- 2ª Parcela

Perfis configurados na parcela:
- Vendedor CLT: 20%
- Supervisor: 5%
- Gerente: 3%
```

Se o snapshot antigo não tiver estrutura nova por plano, mostrar fallback com aviso:

```text
Snapshot antigo sem detalhamento por plano. Exibindo dados disponíveis da regra gravada.
```

#### Cadeia hierárquica
Exibir a cadeia da venda:

```text
Vendedor origem: João
Supervisor: Maria
Gerente: Carlos
Agência: Pratic Agência RJ
Destinatário desta comissão: Maria
```

Também mostrar a regra conceitual:

```text
Esta comissão foi calculada pela grade do vendedor de origem. Supervisor, gerente e agência não usam suas próprias grades nesta venda.
```

---

## 2. Criar hook para buscar auditoria da comissão

Novo hook:

- `src/hooks/useComissaoDetalhesPagamento.ts`

Esse hook receberá `comissaoId` e buscará:

- dados completos da comissão;
- destinatário (`profiles`);
- contrato;
- vendedor de origem do contrato;
- plano;
- grade;
- versão/snapshot da grade;
- regra aplicada (`grade_comissao_plano_regras`);
- cobrança;
- demais comissões irmãs da mesma cobrança para mostrar toda a cadeia remunerada;
- hierarquia vigente como fallback quando não houver dados irmãos suficientes.

Consulta principal esperada:

```text
comissoes
  -> vendedor/destinatário
  -> contrato
      -> vendedor origem
      -> associado
      -> veiculo
  -> plano
  -> grade
  -> grade_versao
  -> plano_regra
  -> cobranca
```

Para a cadeia hierárquica, priorizar:

1. comissões irmãs da mesma `cobranca_id`, porque representam quem efetivamente recebeu nessa geração;
2. `hierarquia_vendas` como fallback;
3. nomes vazios como “não configurado” quando o nível não existir.

---

## 3. Ajustar a tela de pagamentos para exigir conferência antes de pagar

Arquivo:

- `src/pages/comissoes/Pagamentos.tsx`

### Comportamento atual
Hoje o botão “Pagar” executa:

```text
updateStatus.mutate({ id, nextStatus: 'paga' })
```

### Novo comportamento
O botão passará a abrir o modal:

```text
Pagar -> abre detalhes/auditoria
```

Dentro do modal haverá:

- “Fechar”
- “Confirmar pagamento”

Somente o botão “Confirmar pagamento” marcará a comissão como `paga`.

Isso garante que o gestor veja as regras antes de liquidar.

---

## 4. Adicionar snapshot de auditoria direto na comissão para novas gerações

Para novas comissões, vou adicionar um campo JSONB em `comissoes`, por exemplo:

```text
calculo_snapshot jsonb
```

Esse snapshot será preenchido no motor `fn_gerar_comissoes_por_pagamento`.

Conteúdo previsto:

```json
{
  "grade": {
    "id": "...",
    "nome": "Grade Select RJ",
    "versao_id": "...",
    "versao": 3
  },
  "plano": {
    "id": "...",
    "nome": "Select Exclusive"
  },
  "parcela": {
    "numero": 2,
    "vitalicia": false,
    "vitalicia_inicio_parcela": null
  },
  "regra_aplicada": {
    "id": "...",
    "role": "supervisor_vendas",
    "nome_nivel": "Supervisor",
    "tipo_comissao": "percentual",
    "valor": 5
  },
  "cadeia": {
    "vendedor_id": "...",
    "supervisor_id": "...",
    "gerente_id": "...",
    "agencia_id": "..."
  },
  "valores": {
    "valor_base": 250,
    "percentual_aplicado": 5,
    "valor_comissao": 12.5,
    "valor_total": 12.5
  }
}
```

### Por que adicionar esse campo
Embora `grade_versao_id` e `plano_regra_id` já existam, esse snapshot torna a auditoria mais forte e independente de alterações futuras em hierarquia, plano ou regra.

Para comissões antigas, o modal continuará funcionando com fallback usando joins e `grades_comissao_versoes.snapshot`.

---

## 5. Ajustar o motor de geração de comissões

Banco/Supabase:

- criar migration para adicionar `comissoes.calculo_snapshot`;
- atualizar `fn_gerar_comissoes_por_pagamento`.

Ao inserir cada comissão, a função também salvará:

- grade usada;
- versão da grade;
- regra aplicada;
- parcela resolvida;
- cadeia hierárquica resolvida na data da venda;
- valores usados no cálculo.

Isso garante que, no futuro, mesmo que a hierarquia do vendedor mude, a comissão paga continue auditável pelo cenário que existia na geração.

---

## 6. Melhorar o relatório com acesso ao detalhe

Arquivos:

- `src/pages/comissoes/Relatorio.tsx`
- `src/hooks/useRelatorioComissoes.ts`

Adicionar uma ação “Detalhes” em cada linha do relatório de comissões.

Assim a mesma auditoria poderá ser aberta também a partir do relatório, não apenas da tela de pagamentos.

No relatório, o botão será apenas para consulta; na tela de pagamentos, o modal também terá a ação de confirmar pagamento quando o status permitir.

---

## 7. Estados e mensagens de segurança

O modal terá estados claros:

### Quando tudo estiver completo
Mostrar:

```text
Dados auditáveis encontrados.
```

### Quando faltar snapshot novo
Mostrar:

```text
Esta comissão foi gerada antes do snapshot detalhado. Exibindo auditoria reconstruída com os dados disponíveis.
```

### Quando faltar regra/plano/grade
Mostrar alerta:

```text
A comissão não possui todos os vínculos de auditoria. Revise antes de marcar como paga.
```

Nesse caso, o botão “Confirmar pagamento” continuará disponível apenas se o usuário decidir prosseguir, mas com destaque visual de atenção.

---

## 8. Validação esperada

### Cenário 1: comissão nova com snapshot completo
- Gerar comissão por pagamento.
- Abrir “Pagar”.
- Confirmar que aparecem:
  - snapshot da grade;
  - plano;
  - parcela resolvida;
  - regra aplicada;
  - cadeia hierárquica;
  - valores base e calculado.
- Confirmar pagamento.

### Cenário 2: comissão antiga sem snapshot novo
- Abrir comissão antiga.
- Modal exibe dados reconstruídos via `grade_versao_id`, `plano_regra_id`, contrato e hierarquia.
- Mostra aviso de fallback.

### Cenário 3: comissão de supervisor
- Abrir comissão cujo destinatário é supervisor.
- Modal mostra:
  - vendedor de origem;
  - supervisor destinatário;
  - regra do perfil supervisor;
  - grade do vendedor de origem.

### Cenário 4: valor fixo
- Comissão gerada por regra de valor fixo.
- Modal mostra “Valor fixo” e o valor configurado, sem interpretar como percentual.

### Cenário 5: relatório
- Abrir relatório.
- Clicar em “Detalhes”.
- Ver a mesma auditoria, sem alterar status.

---

## Arquivos envolvidos

### Frontend
- `src/pages/comissoes/Pagamentos.tsx`
- `src/pages/comissoes/Relatorio.tsx`
- `src/hooks/useComissaoDetalhesPagamento.ts`
- `src/hooks/useRelatorioComissoes.ts`
- `src/components/comissoes/ComissaoDetalhesPagamentoModal.tsx`

### Banco/Supabase
- nova migration para `comissoes.calculo_snapshot`
- atualização de `fn_gerar_comissoes_por_pagamento`
- opcional: comentário/índice para facilitar auditoria por `cobranca_id`, `grade_id`, `plano_id` e `plano_regra_id`
