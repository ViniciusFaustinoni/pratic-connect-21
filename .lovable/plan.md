
## Causa raiz (confirmada)

- Serviço `a4ff906f-…` (ANDRESA / `0KM91CD6`) continua na fila do Kleyton porque a aprovação **nunca é persistida**.
- A RPC `fn_validar_campos_ativacao` exige `renavam ≥ 9 dígitos`. Como é 0KM (`renavam='0000000'`), retorna `campos_faltando=['renavam']` → erro estruturado → abre o dialog "Corrigir dados", mas o dialog também trava o botão (exige 11 dígitos) → cliente sem documento real para informar → loop.
- Não é cache, não é permissão, não é UI antiga. `servicos.analisado_em IS NULL` e `veiculos.cobertura_total=false` no banco confirmam.

## Decisão

Veículos 0KM podem ser aprovados sem placa/renavam definitivos, **desde que o chassi tenha 17 caracteres válidos** (já é manual conforme regra do projeto).

## Mudanças

### 1. Banco — relaxar `fn_validar_campos_ativacao` (migration)

Detectar 0KM por (a) `placa` ausente/começando com `0KM`/`SEM_PLACA`/`null` ou (b) `renavam` ausente/`'0000000'`/zeros.

```text
SE veículo é 0KM:
  - chassi obrigatório (17 chars, validação isValidChassi server-side simples: 17 alfa-num, sem I/O/Q)
  - placa opcional
  - renavam opcional
SENÃO (placa real):
  - mantém regra atual (placa ≥7, chassi 17, renavam ≥9)
```

Retorno extra no JSON: `is_zero_km: bool` para a UI poder explicar.

### 2. Frontend — `CorrigirDadosVeiculoDialog.tsx`

- Carregar também `placa` para detectar 0KM mesmo se "renavam" vier sinalizado erroneamente em cache antigo.
- Se 0KM: tornar `placa` e `renavam` opcionais no estado de validação local (`placaOk`/`renavamOk` retornam `true` quando vazios), e exibir um banner verde-info: *"Veículo 0KM — placa/renavam serão atualizados após o emplacamento."*
- Se 0KM e nenhum dos campos restantes está sinalizado, fechar o dialog imediatamente após salvar (ou nem abrir).

### 3. Frontend — `useAprovacaoMonitoramento.ts`

- Após a RPC retornar `valido=true` ou `is_zero_km=true` com chassi ok, o fluxo segue para `ativar-associado` normalmente (não muda).
- Edge `ativar-associado` já é a única porta de ativação; **não muda**, mas vamos verificar se ela tem validação duplicada de renavam (se tiver, aplicar a mesma lógica de 0KM lá).

### 4. Reprocessar o caso da Andresa

Após o deploy, abrir `/monitoramento/aprovacao-associados/a4ff906f-…` como Kleyton e clicar **Aprovar**. Esperado: passa direto (chassi `9C2KF5210TR007705` é válido), serviço vira `aprovada`, veículo recebe `cobertura_total=true`, fila esvazia.

## Diagnóstico para o usuário (resposta final)

> Não era bug de cache nem permissão. A solicitação **nunca foi aprovada de fato** — toda vez que o Kleyton clica em "Aprovar" a validação `fn_validar_campos_ativacao` reprova porque o renavam é `0000000` (veículo 0KM). O dialog de correção também não permite salvar (exige 11 dígitos). Ajustando a regra para tratar 0KM como caso especial (chassi obrigatório, placa/renavam opcionais), a aprovação destrava e o registro sai da fila.

## Risco / impacto

- Mexe na função canônica de validação — afeta também a edge `ativar-associado` se ela chamar a mesma RPC. Verificar antes do deploy.
- Outros 0KM em fila (se houver) passarão a ser aprováveis — isso é o comportamento desejado.
