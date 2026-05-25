# Por que falhou no Alan Thiago (KQB4683)

Investiguei como admin. Histórico real da placa KQB4683 / IMEI 865011030213996 em `rastreadores_api_logs`:

- 18:13 / 18:54 → "O CPF/CNPJ e/ou IMEI não foram informados."
- 18:57 → 20:29 → "JSON não informado"
- Após o último fix (mudança de `URLSearchParams` para `FormData` multipart): chamei via curl agora como admin e a Rede Veículos respondeu **`JSON não informado`** novamente.

Ou seja: o caso do Alan não é dado faltando — CPF (`11604313706`) e IMEI estão corretos. O problema é o **formato do POST** enviado para `/vincularClienteVeiculo`.

# Causa raiz

Comparei `vincular` com as 3 funções da MESMA plataforma que estão funcionando em produção:

| Função | URL | Body | Funciona? |
|---|---|---|---|
| `atualizarDadosCliente/` | **com barra** | `URLSearchParams` só com `json=<stringify>` | ✅ |
| `ativarVeiculo/` | **com barra** | `URLSearchParams` só com `json=<stringify>` | ✅ |
| `informarVeiculoAdimplente/` | **com barra** | `URLSearchParams` só com `json=<stringify>` | ✅ |
| `desvincularClienteVeiculo` | sem barra | `FormData` flat (sem `json`) | ✅ |
| `vincularClienteVeiculo` | **sem barra** | misto: flat + `json` em `URLSearchParams` (versão original) / `FormData` (último fix) | ❌ |

A função `vincular` é a única que destoa do padrão dominante. O comentário "barra causa 301/307 e PHP perde o body" que justificou retirar a barra foi uma hipótese errada — as outras 3 rotas no mesmo backend respondem corretamente com barra. Sem a barra, o PHP da Rede Veículos não popula `$_REQUEST['json']` e devolve "JSON não informado".

# O que vou mudar (e onde)

### 1. `supabase/functions/rede-veiculos-vincular-cliente/index.ts` (bloco 280–296)

Alinhar exatamente ao padrão `atualizarDadosCliente`:

- URL: `${baseUrl}/vincularClienteVeiculo/` (com barra)
- Body: `URLSearchParams` com **um único campo** `json=<JSON.stringify(payload)>`
- Header: `Content-Type: application/x-www-form-urlencoded`
- Remover os campos flat (`cpfCnpj`, `imei`, `placa`) — eles já estão dentro do payload JSON e foram a "remendo" feito quando a API reclamava de CPF/IMEI; o problema real era a falta da barra, não a falta dos campos flat.

Atualizar o comentário acima do `fetch` para registrar a regra correta e prevenir reincidência.

### 2. `src/hooks/useAtivarRastreador.ts` (linhas 82–93)

Hoje, quando o edge devolve 400, o hook joga `error.message || 'Erro na integração...'` — que vira o genérico "Edge Function returned a non-2xx status code" na tela. A mensagem real (`"JSON não informado"`, `"CPF/CNPJ duplicado"`, etc.) está em `data.error`, mas é descartada.

Mudança: quando `FunctionsHttpError` ocorrer, ler `await error.context.json()` (ou cair em `data?.error`) e propagar a mensagem real. Mesma correção que já aplicamos em outros pontos via `toastErroEdge`.

Isso garante que o próximo problema da Rede Veículos (se houver) seja diagnosticável de cara, sem precisar abrir `rastreadores_api_logs`.

### 3. Validação pós-deploy (sem mexer em DB)

Antes de avisar o usuário:
- `curl` direto no edge com o payload do Alan e confirmar status 200 + `idCliente`/`idVeiculo`/`idEquipamento`.
- Conferir em `rastreadores_api_logs` que entrou linha `status='sucesso'` para `vincularClienteVeiculo`.
- Confirmar que `rastreadores.id_plataforma` e `veiculos.rede_veiculos_*` ficaram preenchidos.

Se o curl ainda falhar com outra mensagem, a mensagem virá no body do 400 e eu reporto antes de tocar o front.

# Por que isso não se repete em outros associados

- O fix está no transporte HTTP de **toda** chamada `vincularClienteVeiculo`, não no dado do Alan. Qualquer associado que precise ser vinculado pela primeira vez na Rede Veículos passa por esse mesmo caminho.
- O fix do hook expõe erros reais da plataforma em tempo de clique. Se a Rede Veículos mudar regra (ex.: passar a exigir CEP), o operador vê o motivo na hora em vez de um genérico.
- Atualizo o memory `mem://integrations/tracking/provider-logic-consolidated-v2` com a regra "endpoints Rede Veículos que aceitam `json` em form-urlencoded EXIGEM barra final" para travar a reincidência em revisões futuras de código.

# O que NÃO vou mexer

- Nenhuma migration. O problema é 100% código de edge function + tratamento de erro no front.
- Nenhuma mudança de regra de elegibilidade, vínculo de veículo, status do rastreador, ou estado do Alan no banco — o registro do Alan já está consistente (rastreador `instalado`, `veiculo_id` apontando para KQB4683).
- Nada nas outras funções da Rede Veículos — elas já estão certas.

Aprovando, executo na sequência: edge → hook → curl de validação → relatório.