## Problema

A cotação `COT-20260508-181403289-174` foi criada como **adesão normal** (não é troca de titularidade) com a placa **LTB4J74**. Porém essa placa já pertence ao associado **RODOLFO MARCOS DA SILVA** (CPF 123.143.117-28, status ativo), e o solicitante atual é outro CPF (124.936.497-37 / MARCUS VINICIUS).

Hoje o sistema só descobre essa colisão lá no fim do funil, dentro de `contrato-gerar`, onde dispara `[BLOQUEIO-DONO]` e devolve HTTP 409 com a mensagem "Edge Function returned a non-2xx status code" — uma falha opaca, exibida só na Etapa 3 (Contrato → Autentique), depois do cliente já ter percorrido todo o fluxo.

## Causa

A verificação de "placa pertence a outro associado" existe apenas na edge `contrato-gerar`. Os pontos de criação de cotação (`Cotador.tsx` e `CotacaoFormDialog.tsx`) verificam:

1. Blacklist
2. Cotação duplicada (mesma placa em outro vendedor)
3. SGA Hinova (`useVerificarVeiculoSGA`) — checa se a placa existe no SGA externo

Mas **não** checam a tabela local `veiculos` para detectar que a placa já tem um `associado_id` diferente do CPF da cotação atual.

## Mudança

### 1. Novo hook `useVerificarPlacaOutroAssociado`

Arquivo: `src/hooks/useVerificarPlacaOutroAssociado.ts` (novo)

- Recebe `{ placa, cpfSolicitante }`.
- `SELECT v.id, v.associado_id, a.nome, a.cpf, a.status FROM veiculos v JOIN associados a ON a.id=v.associado_id WHERE v.placa = :placa`.
- Se existe e `a.cpf` (limpo) ≠ `cpfSolicitante` (limpo), retorna `{ conflito: true, associadoNome, cpfMascarado, status }`.
- Se mesmo CPF, retorna `{ conflito: false, mesmoTitular: true }` (sinaliza para sugerir Inclusão de Veículo).
- Senão, `null`.

### 2. Bloqueio pré-criação no Cotador (`src/pages/vendas/Cotador.tsx`)

No `handleBuscarPlaca` (após o passo 3 do SGA, antes do passo 4 "Continuar com a busca"):

- Se o CPF do solicitante já estiver preenchido, chamar o novo hook.
- Se `conflito === true`, abrir um modal de erro claro (novo componente `PlacaOutroAssociadoModal`) com:
  - Título: **"Placa já pertence a outro associado"**
  - Texto: *"A placa LTB4J74 está vinculada a {NOME} (CPF ***.143.***-28, status: ativo). Não é possível criar uma cotação de adesão para essa placa."*
  - Dois botões de ação:
    - **"Iniciar Troca de Titularidade"** → leva para `/cobranca/troca-titularidade` ou abre o `TrocaTitularidadeDialog` daquele associado.
    - **"Cancelar"** → fecha o modal e limpa o campo de placa.
- Se `mesmoTitular === true`, exibir toast informativo: "Esta placa já está cadastrada para este CPF. Use Inclusão de Veículo no perfil do associado."
- Quando o CPF ainda não estiver preenchido, repetir a checagem no `handleSalvarCotacao` (gate final antes de gravar).

### 3. Mesmo bloqueio no `CotacaoFormDialog.tsx`

Aplicar a mesma verificação no fluxo do dialog (após `verificarVeiculoSGA`, antes de prosseguir para os planos).

### 4. Mensagem clara em `contrato-gerar` (defesa em profundidade)

Manter o bloqueio (não remover — segue como guardrail), mas trocar a string de erro pelas variáveis disponíveis para que, se ainda escapar, o front mostre algo útil:

```
"A placa {PLACA} pertence a outro associado ({NOME_OU_ID_MASCARADO}). 
Esta cotação foi criada como adesão, mas o veículo já existe no sistema. 
Cancele a cotação e use Troca de Titularidade."
```

E no `EtapaAssinaturaContrato.tsx`, ler o `error.message` / `code='PLACA_DE_OUTRO_ASSOCIADO'` retornado pela edge e exibir essa mensagem específica em vez de "Edge Function returned a non-2xx status code".

## Validação

1. Criar nova cotação no Cotador com placa **LTB4J74** + CPF qualquer ≠ 12314311728 → deve abrir o modal "Placa já pertence a outro associado" antes de qualquer outra etapa.
2. Repetir com o CPF correto (12314311728) → deve aparecer o toast "Inclusão de Veículo".
3. Repetir com placa nova qualquer → fluxo normal segue funcionando.
4. Cotação atual (`684660e4-...`): excluí-la / cancelá-la manualmente, já que foi criada de forma incorreta.

## Não escopo

- Não alterar a lógica de Troca de Titularidade existente.
- Não alterar o sync de veículo↔contrato (trigger).
- Não relaxar o bloqueio em `contrato-gerar` — só melhorar a mensagem.
