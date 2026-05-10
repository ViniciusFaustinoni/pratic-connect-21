## Objetivo

No modal **Troca de Titularidade**, quando a consulta ao SGA falhar (erro transitório) **ou** retornar vazio (associado/veículos não encontrados), usar a **base local** como fallback para listar associado, veículos e status de pagamento — para não travar a operação quando o Hinova estiver fora.

## Hoje

- `useBoletosSgaPorAssociado` consulta o SGA via edge function `sga-listar-boletos-associado`.
- Se SGA retorna `erro_transitorio` ou `encontrado=false`, o dialog mostra alerta de erro e bloqueia a seleção do veículo.

## Plano

### 1. Novo hook `useTrocaTitularidadeFallbackLocal(associadoId, enabled)`
Arquivo: `src/hooks/useTrocaTitularidadeFallbackLocal.ts`

Consulta paralela:
- `associados` → `nome, cpf, email, telefone`
- `veiculos` (where `associado_id = X`, `ativo = true`, `status != 'cancelado'`) → `id, placa, marca, modelo, ano_modelo`
- `cobrancas` (where `associado_id = X`, `status in ('aberto','vencido','pendente')`) — agrega por `veiculo_id` para `saldo_devedor`

Retorno **no mesmo shape** de `SgaAssociadoCompleto`:
```ts
{ encontrado, codigo_associado: null, associado, veiculos: [{ codigo_veiculo: 0, placa, marca, modelo, ano, saldo_devedor, boletos_abertos: [...] }], saldo_devedor_total, tem_debito, origem_busca: 'cpf' }
```
Os `id` UUID locais dos veículos são guardados em paralelo (o dialog precisa do UUID para criar a solicitação — passamos `placa → id` via `Map`).

### 2. `TrocaTitularidadeDialog.tsx` — usar fallback

- Habilitar o hook fallback **sempre** (`enabled: open && !!associadoId`) — o custo é mínimo e dá resposta instantânea.
- Determinar `usandoFallback`:
  - `true` quando SGA retorna `erro_transitorio` **ou** `semCodigoHinova` **ou** `semVeiculosSGA` **ou** `semEspelhoLocal` (e o fallback local trouxe ao menos 1 veículo).
- Quando `usandoFallback`:
  - Substituir a fonte da lista `veiculos` pelo fallback (já vem com UUID local, sem precisar de `veiculosLocais`).
  - Mostrar `<Alert>` informativo (não destrutivo) no topo: "SGA indisponível — exibindo dados da base local. Status de pagamento pode estar defasado."
  - Manter o auto-sync silencioso ao fundo; se ele tiver sucesso depois, o estado naturalmente troca para SGA.
- Se nem SGA nem local trouxerem veículos → manter alerta atual de "Nenhum veículo encontrado".
- O fluxo de criação (`handleSubmit`) **não muda** — já recebe o UUID do veículo local.

### 3. UI status de pagamento (se já existe no dialog)
- Reutilizar o mesmo componente que mostra `tem_debito` / `saldo_devedor_total`, agora alimentado pelo fallback quando aplicável (mesmo shape).

### 4. Sem mudanças
- Sem mudança no edge function `sga-listar-boletos-associado`.
- Sem mudança no schema.
- Sem mudança em `importar-associado-sga` ou no auto-sync já implementado.

## Risco / observação

- O `codigo_associado` no fallback é `null` — qualquer ação posterior que dependa dele continua bloqueada (apenas a listagem é liberada). A criação da solicitação de troca já usa `veiculo_id` UUID, então não é afetada.
- Adicionamos um banner claro avisando que a fonte é local, para o operador saber que o status de débito pode estar defasado.
