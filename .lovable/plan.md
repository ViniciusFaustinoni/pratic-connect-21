# Corrigir caso Rosimeire no SGA

## Diagnóstico confirmado
- O caso é da **Rosimeire da Silva Miranda**, veículo **YAMAHA AEROX CONNECTED ABS 2026**, chassi **9C6SGA210T0008483**, placa placeholder **0KM751A9**.
- O veículo local já está com **FIPE correta** no banco:
  - `codigo_fipe = 827144-5`
  - `valor_fipe = 19912`
  - `combustivel = Gasolina`
- A edge `fipe-lookup` confirmou o mesmo resultado ao consultar por nome:
  - marca `YAMAHA`
  - modelo `AEROX CONNECTED ABS`
  - ano `2026`
  - `modeloCodigo = 11862`
  - `codigoFipe = 827144-5`
- O erro **não acontece na busca FIPE**. Ele acontece **depois**, no momento do `POST /veiculo/cadastrar` do Hinova.
- Os logs do `sga_sync_logs` mostram o ponto exato da quebra:
  - `fipe_auto_lookup_preflight`: sucesso
  - `buscar_associado` / `cadastrar_associado`: sucesso
  - `cadastrar_veiculo`: erro com resposta **"O MODELO enviado não foi encontrado"**
- O payload enviado ao Hinova contém **`codigo_fipe: 827144-5`**, mas **não envia `codigo_modelo`**.
- O próprio código já documenta isso em `sga-hinova-sync`: hoje o fluxo assume que **`codigo_fipe` ou `codigo_modelo`** bastam, mas na prática este caso mostra que, para alguns veículos/motos 0KM, o Hinova **não resolve o modelo só com `codigo_fipe`**.

## Causa raiz
- A integração com o Hinova está **incompleta para cadastro de veículo**: ela envia o **código FIPE**, mas não possui um caminho robusto para enviar também o **código do modelo aceito pelo SGA/Hinova**.
- Isso gera falhas em lote sempre que o Hinova não consegue mapear internamente o `codigo_fipe` recebido para o catálogo/modelo da conta.
- O problema do plano **"Advanced Especial" sem código de grupo SGA** apareceu nos logs, mas é apenas **warning** e **não bloqueou** este cadastro. O bloqueio real foi o **modelo não encontrado**.

## O que implementar

### 1) Tornar o pré-flight de veículo completo
No fluxo `sga-hinova-sync`, antes de chamar `cadastrar_veiculo`:
- continuar resolvendo `codigo_fipe`, `valor_fipe` e `combustivel` como hoje;
- passar a resolver também o **código do modelo FIPE** (`modeloCodigo`) via `fipe-lookup`;
- persistir esse identificador em campo próprio canônico no banco, para reuso em reprocessamentos.

### 2) Enviar `codigo_modelo` no payload do Hinova
Atualizar o builder de payload do veículo para:
- manter `codigo_fipe`;
- incluir **`codigo_modelo`** quando disponível;
- logar claramente qual combinação foi enviada ao Hinova (`codigo_fipe`, `codigo_modelo`, `marca`, `modelo`, `ano`).

### 3) Fallback defensivo quando Hinova rejeitar o modelo
Se o Hinova responder novamente com mensagem contendo **"MODELO"**:
- registrar o erro como falha de catálogo/modelo;
- gravar na fila SGA com motivo explícito, sem repetir tentativas cegas;
- evitar novo looping silencioso de retries com o mesmo payload inválido.

### 4) Saneamento do caso Rosimeire
Depois da correção do código:
- recalcular/confirmar FIPE pela consulta canônica do veículo;
- preencher o novo campo de modelo resolvido para o veículo da Rosimeire;
- reprocessar a sincronização SGA do veículo;
- validar que `codigo_hinova` foi gravado no veículo e que o erro saiu da fila.

## Dados já confirmados para o saneamento
- **Associada:** Rosimeire da Silva Miranda
- **Código Hinova do associado:** `30456`
- **Contrato:** `CTR-20260519130333-HJVC2E`
- **Cotação:** `COT-20260519-094350410-530`
- **Veículo local:** `6f20a5df-90d6-4cde-9e7e-5bc1e50645cf`
- **Plano:** `Advanced Especial`
- **FIPE confirmada:** `827144-5`
- **Modelo FIPE confirmado:** `11862`

## Arquivos que devem ser alterados
- `supabase/functions/sga-hinova-sync/index.ts`
- `supabase/functions/_shared/hinova-payloads.ts`
- possivelmente uma migration para persistir o código de modelo resolvido no cadastro do veículo/logs de reprocessamento

## Detalhes técnicos
- A edge `fipe-lookup` já retorna tudo que precisamos:
  - `codigoFipe`
  - `modeloCodigo`
  - `marcaCodigo`
  - `anoCodigo`
- Hoje o `sga-hinova-sync` só consome `codigoFipe` e ignora `modeloCodigo`.
- O payload que falhou no Hinova foi este núcleo:
```text
codigo_associado: 30456
codigo_fipe: 827144-5
codigo_tipo_veiculo: 2
codigo_combustivel: 2
ano_fabricacao: 2026
ano_modelo: 2026
chassi: 9C6SGA210T0008483
numero_motor: G3W4E-008496
```
- A resposta do Hinova foi sempre:
```text
Não aceitável
O MODELO enviado não foi encontrado
```
- Isso demonstra que o bug está na **montagem do payload do veículo para o Hinova**, não na consulta da FIPE.

## Resultado esperado após implementar
- Casos como Rosimeire deixam de falhar em lote por ausência de `codigo_modelo`.
- O sync SGA passa a ser determinístico para motos/veículos cujo catálogo do Hinova exige resolução explícita do modelo.
- O caso da Rosimeire poderá ser reprocessado com segurança, com criação do veículo no SGA em vez de novo erro de modelo.