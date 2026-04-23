
## Implementação/ajuste da tela de Pagamentos de Comissões

### Observação importante
A tela `/comissoes/pagamentos` já existe parcialmente. Ela já lista comissões do mês, permite aprovar e abre o modal de conferência antes de marcar como paga.

O ajuste será evoluir essa tela para o fluxo completo solicitado:

```text
Pagamentos de Comissões
  -> lista paginada
  -> filtros
  -> conferência/auditoria
  -> marcar como paga
  -> registrar lançamento de pagamento
  -> gerar recibo
  -> manter histórico auditável
```

---

## 1. Criar hook próprio para pagamentos paginados

Criar/ajustar um hook específico, por exemplo:

- `src/hooks/usePagamentosComissoes.ts`

Ele substituirá o uso atual de `useComissoesDashboard()` na tela de pagamentos, porque hoje a página carrega os itens do mês inteiro e filtra em memória.

### O hook terá filtros server-side
Filtros previstos:

- período inicial;
- período final;
- status;
- vendedor/destinatário;
- grade;
- plano;
- parcela;
- busca por nome/email;
- página;
- quantidade por página.

### Retorno
O hook retornará:

```text
items
total
page
pageSize
totalPages
kpis
isLoading
marcarComoPaga
gerarRecibo
```

Isso evita limite de 1000 registros e prepara a tela para volume real.

---

## 2. Ajustar a tela `/comissoes/pagamentos`

Arquivo:

- `src/pages/comissoes/Pagamentos.tsx`

### Mudanças principais
A tela passará a ter:

#### Cards de resumo
- total pendente/aprovado para pagar;
- total pago no período;
- quantidade de comissões;
- quantidade de destinatários.

#### Filtros
- busca por usuário;
- status;
- período;
- plano;
- grade;
- parcela;
- tamanho da página.

#### Lista paginada
Usar o componente já existente:

- `src/components/ui/pagination.tsx`

A tabela exibirá:

- data de geração;
- destinatário;
- perfil remunerado;
- vendedor de origem, quando disponível;
- plano;
- grade;
- parcela;
- status;
- valor base;
- regra aplicada;
- valor final;
- pagamento/recibo;
- ações.

---

## 3. Ajustar a ação “Marcar como paga”

Hoje o botão “Pagar” abre o modal de detalhes e confirma o pagamento.

Vou manter esse fluxo, mas a confirmação passará a fazer mais do que apenas atualizar `comissoes.status`.

### Novo comportamento ao confirmar pagamento

Ao clicar em “Confirmar pagamento”:

1. validar que a comissão ainda não está paga;
2. atualizar a comissão:
   - `status = 'paga'`;
   - `pago_em = now()`;
   - `updated_at = now()`;
3. criar um lançamento em `comissoes_pagamentos`;
4. vincular o pagamento à comissão liquidada;
5. gerar/registrar recibo;
6. invalidar os caches de:
   - pagamentos de comissões;
   - relatório de comissões;
   - dashboard de comissões;
   - detalhes da comissão.

---

## 4. Completar o histórico de pagamentos

A tabela `comissoes_pagamentos` já existe e será reaproveitada, mas hoje ela guarda apenas o resumo por vendedor/período.

Para deixar o vínculo auditável, será criada uma tabela auxiliar:

```text
comissoes_pagamento_itens
- id
- pagamento_id
- comissao_id
- vendedor_id
- valor_pago
- status_anterior
- created_at
```

### Motivo
Isso permite responder:

```text
Qual pagamento liquidou esta comissão?
Quais comissões compõem este recibo?
Qual valor foi pago em cada item?
```

Também evita depender apenas de `status = paga` na tabela `comissoes`.

---

## 5. Gerar recibo de pagamento

Adicionar geração de recibo em PDF no frontend usando o padrão já utilizado no projeto com:

- `jspdf`;
- `jspdf-autotable`.

### Conteúdo do recibo
O recibo terá:

```text
Recibo de Pagamento de Comissão

Número do recibo/pagamento
Data do pagamento
Destinatário
E-mail
Período de referência
Quantidade de comissões
Valor total pago

Itens:
- comissão
- contrato/cobrança
- plano
- grade
- parcela
- perfil
- valor base
- regra aplicada
- valor pago
```

### Ações na tela
Na tabela:

- “Detalhes” abre auditoria;
- “Pagar” abre auditoria e confirma pagamento;
- “Recibo” baixa o PDF quando a comissão já estiver paga.

Na listagem de pagamentos/histórico:

- baixar recibo novamente.

---

## 6. Persistir referência do recibo

A tabela `comissoes_pagamentos` já possui:

```text
comprovante_url
observacoes
```

Para o primeiro ajuste, o recibo pode ser gerado sob demanda no navegador a partir dos dados do pagamento.

Se for necessário persistir o arquivo, será usado o campo `comprovante_url` com upload em bucket de storage. Nesta etapa, a prioridade será:

```text
registrar o lançamento + permitir baixar recibo gerado com os dados auditáveis
```

Sem depender de storage para o fluxo funcionar.

---

## 7. Permitir pagamento individual e preparar pagamento em lote

### Nesta implementação
Foco em pagamento individual por comissão, que é o fluxo direto do botão “Pagar”.

### Estrutura preparada para lote
A tabela `comissoes_pagamentos` + `comissoes_pagamento_itens` já permitirá futuramente:

```text
selecionar várias comissões do mesmo destinatário
-> pagar em lote
-> gerar um único recibo consolidado
```

A interface já será organizada para não bloquear essa evolução.

---

## 8. Ajustar o modal de detalhes/auditoria

Arquivo:

- `src/components/comissoes/ComissaoDetalhesPagamentoModal.tsx`

### Ajustes
Manter o modal existente, mas adicionar:

- informação se já existe pagamento registrado;
- número/id do lançamento em `comissoes_pagamentos`;
- botão “Baixar recibo” quando já estiver paga;
- botão “Confirmar pagamento” apenas quando o status permitir.

---

## 9. Banco de dados

Criar migration para:

### Nova tabela
```text
comissoes_pagamento_itens
```

Com RLS seguindo a lógica atual:

- diretor/admin/desenvolvedor/gerente podem visualizar;
- diretor/admin/desenvolvedor podem inserir;
- vendedor pode visualizar apenas itens próprios.

### Índices
Criar índices para:

```text
pagamento_id
comissao_id
vendedor_id
created_at
```

### Unicidade
Adicionar restrição para evitar pagamento duplicado da mesma comissão:

```text
unique (comissao_id)
```

Assim uma comissão não entra em dois recibos diferentes.

---

## 10. Arquivos envolvidos

### Frontend
- `src/pages/comissoes/Pagamentos.tsx`
- `src/hooks/usePagamentosComissoes.ts`
- `src/components/comissoes/ComissaoDetalhesPagamentoModal.tsx`
- novo utilitário, por exemplo:
  - `src/lib/comissoes-recibo.ts`

### Banco/Supabase
- nova migration para `comissoes_pagamento_itens`;
- RLS da nova tabela;
- índices e constraint de unicidade.

---

## 11. Validação esperada

### Cenário 1: lista paginada
- Acessar `/comissoes/pagamentos`.
- Ver lista com paginação real.
- Trocar página sem perder filtros.

### Cenário 2: filtros
- Filtrar por status, período, vendedor, plano, grade e parcela.
- Conferir que os totais e a tabela acompanham os filtros.

### Cenário 3: marcar como paga
- Clicar em “Pagar”.
- Ver modal de auditoria.
- Confirmar pagamento.
- Comissão muda para `paga`.
- `pago_em` é preenchido.
- Lançamento é criado em `comissoes_pagamentos`.
- Item é criado em `comissoes_pagamento_itens`.

### Cenário 4: evitar duplicidade
- Tentar pagar novamente a mesma comissão.
- Sistema não duplica pagamento/recibo.

### Cenário 5: recibo
- Comissão paga exibe ação “Recibo”.
- Baixar PDF com dados do destinatário, valor, regra, grade, plano e parcela.

### Cenário 6: auditoria
- Abrir detalhes de comissão paga.
- Ver regra aplicada, snapshot, cadeia hierárquica e lançamento de pagamento vinculado.
