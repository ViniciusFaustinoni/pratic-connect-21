

## Corrigir instalação que termina pela metade ("rastreador já está ativo" e fluxo duplicado)

### Diagnóstico (com evidências do banco)

Confirmei dois bugs que se combinam para travar a instalação no momento de informar o rastreador:

**Bug 1 — Validação rígida de IMEI bloqueia retomada**
Em `InstaladorChecklist.tsx` linha 554 e em `useAprovarVeiculoServico` linha 897, a regra é binária:
```
if (rastreador.status !== 'estoque') → "indisponível" / "não está disponível"
```
Cenários reais que caem aqui:
- O instalador já submeteu uma vez e o `useAprovarVeiculoServico` chegou a marcar o rastreador como `instalado` + `veiculo_id = X`, mas algum passo posterior falhou (ex.: ativação na Softruck, geração de laudo, rede caiu). O serviço continua `agendada/aprovada` e, ao reabrir, o IMEI aparece como **"indisponível: instalado"** mesmo já estando vinculado ao **mesmo veículo**.
- O IMEI foi vinculado ao veículo previamente pelo formulário `VincularRastreadorForm` (cadastro) — o caminho duplo que o usuário citou. Quando o instalador chega na execução, vê "indisponível".
- Status `em_porte` (rastreador entregue ao técnico mas ainda não digitado como `estoque` por configuração antiga).

**Bug 2 — Caminho duplo de criação de serviço deixa órfãos**
Consulta confirma: dos 37 serviços `tipo='instalacao'` dos últimos 30 dias, **5 (13%) têm `instalacao_origem_id = NULL`**. Exemplo concreto encontrado hoje: serviço `70abc44a-8004-4b41-a468-4ead8d796b07` (placa TUM3D59), status `aprovada`, sem instalação vinculada.

Quando isso acontece, a sincronização com a tabela `instalacoes` (`useServicos.ts` linhas 932-950) é **silenciosamente pulada** — o serviço é finalizado mas a tabela `instalacoes` continua aberta. O `aprovar-proposta` lê `instalacoes` para decidir se ativa Proteção 360, então o veículo fica em `instalacao_pendente` mesmo após o técnico concluir tudo.

### O que vai mudar

**1. Permitir rastreador já vinculado ao MESMO veículo** (ambos os pontos)

Trocar a checagem binária por uma matriz de cenários, em `InstaladorChecklist.tsx` (validação visual) e em `useAprovarVeiculoServico` (validação de submit):

| `status` do rastreador | `veiculo_id` | Ação |
|---|---|---|
| `estoque` | qualquer | ✅ permite (caso normal) |
| `em_porte` | qualquer | ✅ permite (entregue ao técnico) |
| `instalado` | = veículo do serviço | ✅ permite (retomada idempotente — apenas atualiza demais campos) |
| `instalado` | ≠ veículo do serviço | ❌ bloqueia: "Rastreador instalado em outro veículo (placa X)" |
| `manutencao`/`baixado` | qualquer | ❌ bloqueia com mensagem clara |

A UI passa a exibir, no caso "instalado no MESMO veículo", uma badge verde "Rastreador já vinculado a este veículo — confirmando instalação" em vez de bloquear.

No backend (`useAprovarVeiculoServico`), o `UPDATE rastreadores` continua sendo executado (idempotente: já está com `status='instalado'`, só reforça `veiculo_id`, `local_instalacao`, `descricao_instalacao`, `foto_local_instalacao_url`). A inserção em `estoque_movimentacoes` só acontece se `status_anterior === 'estoque'` (evita duplicação de movimentação).

**2. Garantir conclusão da `instalacoes` mesmo sem `instalacao_origem_id`**

No `useAprovarVeiculoServico`, quando `instalacao_origem_id` for NULL, fazer um fallback:
- Procurar uma instalação aberta (`status NOT IN ('concluida','cancelada')`) pelo `veiculo_id` do serviço.
- Se encontrar, atualizar `status='concluida'` + `concluida_em` + `rastreador_id` e gravar `instalacao_origem_id` no serviço para consistência futura.
- Se não encontrar nenhuma, logar warning (a instalação foi criada por fluxo legado e o `aprovar-proposta` será notificado por outro caminho).

**3. Backfill manual dos casos atuais**

Migration única (DML) que resolve os serviços já presos:
- Para cada `servicos` com `tipo='instalacao'` e `instalacao_origem_id IS NULL` dos últimos 30 dias: tentar amarrar à `instalacoes` aberta do mesmo `veiculo_id` (a mais recente).
- Para os 5 serviços identificados, isso destrava o "duplo caminho" sem precisar refazer instalação.

**4. Mensagens de erro acionáveis**

Quando o rastreador for genuinamente bloqueado, o toast atual `"Rastreador não está disponível"` vira:
- `"Rastreador X já instalado no veículo Y (placa ABC1234). Use outro IMEI ou solicite remoção primeiro."`
- `"Rastreador em manutenção — solicite outro ao coordenador."`

### O que NÃO muda

- Estrutura das tabelas `servicos`, `instalacoes` e `rastreadores`.
- Etapas 1-3 do checklist (Dados, Checklist, Fotos).
- Fluxo paralelo do `VincularRastreadorForm` (cadastro) — continua funcionando, agora reconhecido pelo instalador como "já vinculado".
- Política RLS, ativação na Softruck/Rede Veículos, geração do laudo.

### Arquivos editados

- `src/pages/instalador/InstaladorChecklist.tsx` — matriz de validação do IMEI (linhas 542-575) + UI de "já vinculado a este veículo" + toasts específicos.
- `src/hooks/useServicos.ts` — `useAprovarVeiculoServico`:
  - validação idempotente do rastreador (linhas 884-901);
  - `UPDATE` condicional sem repetir movimentação de estoque (linhas 980-1013);
  - fallback para localizar `instalacoes` quando `instalacao_origem_id` for NULL (linhas 924-950).
- **Migration nova** — backfill: vincular `servicos.instalacao_origem_id` órfãos à `instalacoes` aberta correspondente; concluir `instalacoes` cuja `servicos` correspondente já está `concluida`.

### Riscos

- O fallback por `veiculo_id` pode amarrar um serviço a uma instalação errada se houver duas instalações abertas para o mesmo veículo (raro). Mitigação: pegar a mais recente e logar; em caso real, o coordenador pode corrigir manualmente.
- Permitir `status='instalado'` no MESMO veículo abre brecha teórica para "concluir" duas vezes; mitigado porque o `UPDATE` é idempotente e a movimentação de estoque só dispara se `status_anterior='estoque'`.

