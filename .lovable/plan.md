

# Correções: Rastreador pós-retirada, Foto do Local de Instalação, Erro de Localização

## Problema 1: Rastreador retirado fica vinculado ao instalador

**Causa raiz:** Na edge function `concluir-retirada/index.ts` (linha 169), o campo `portador_id` é definido como `profissionalId` independentemente do status de destino. Quando o rastreador vai para `estoque` (integridade = íntegro), ele deveria ter `portador_id: null` pois está no estoque, não na posse de ninguém. O `portador_id` só faz sentido quando o status é `retorno_base` (técnico transportando de volta).

**Correção:** Condicionar o `portador_id` ao status de destino:
- `estoque` → `portador_id: null`
- `retorno_base` → `portador_id: profissionalId`

Também limpar os campos de instalação (`local_instalacao`, `descricao_instalacao`, `foto_local_instalacao_url`) ao retirar, já que o rastreador não está mais instalado em lugar nenhum.

**Arquivo:** `supabase/functions/concluir-retirada/index.ts` — linhas 164-173

---

## Problema 2: Falta foto do local de instalação no checklist

**Causa raiz:** O `InstaladorChecklist.tsx` coleta `localInstalacao` (select) e `descricaoInstalacao` (textarea), mas **não tem campo para capturar a foto do local**. A foto é buscada retroativamente da tabela `vistoria_fotos` (tipo `local_rastreador`), que pode não existir. Isso se aplica a instalações, manutenções e qualquer serviço que envolva (re)instalação.

**Correção:** Adicionar campo obrigatório de foto do local de instalação no `InstaladorChecklist.tsx`, na seção "Local de Instalação do Rastreador" (após a descrição do ponto exato). A foto será:
- Capturada via `FotoCapture` (componente já existente)
- Uploaded para o bucket `servicos-fotos`
- Passada como `fotoLocalInstalacao` no payload de aprovação
- Salva no campo `foto_local_instalacao_url` do rastreador em `useServicos.ts`

Também adicionar o mesmo campo na página `ExecutarManutencao.tsx` caso envolva reinstalação.

**Arquivos:**
- `src/pages/instalador/InstaladorChecklist.tsx` — adicionar FotoCapture + estado + validação
- `src/hooks/useServicos.ts` — aceitar e salvar `fotoLocalInstalacao` no update do rastreador
- `src/pages/instalador/ExecutarManutencao.tsx` — verificar se há reinstalação e adicionar campo

---

## Problema 3: Erro de localização do instalador

**Causa raiz:** No `useIniciarServico.ts`, quando o `watchPosition` retorna erro code 2 (`POSITION_UNAVAILABLE`), o estado é setado como `unavailable`. Isso aciona a `TelaLocalizacaoBloqueada` que bloqueia toda a interface do instalador. O problema é que o GPS pode estar temporariamente indisponível (dentro de edifícios, túneis) mas o bloqueio é imediato e persistente.

**Correção:** Tornar o tratamento de erros de localização mais resiliente:
1. Para `POSITION_UNAVAILABLE` (code 2): não bloquear imediatamente — tentar novamente automaticamente 3 vezes com intervalo de 5 segundos antes de mostrar a tela bloqueada
2. Para `TIMEOUT` (code 3): já está sendo ignorado, manter assim
3. Adicionar fallback: se `watchPosition` falha mas `getCurrentPosition` funciona, usar esse como fonte
4. Mostrar mensagem mais clara na `TelaLocalizacaoBloqueada` diferenciando "GPS desligado" de "GPS temporariamente indisponível"

**Arquivos:**
- `src/hooks/useIniciarServico.ts` — adicionar retry logic para POSITION_UNAVAILABLE
- `src/components/vistoriador/TelaLocalizacaoBloqueada.tsx` — melhorar mensagem

---

## Resumo de arquivos

| Arquivo | Alteração |
|---|---|
| `supabase/functions/concluir-retirada/index.ts` | Condicionar `portador_id` ao status; limpar campos de instalação |
| `src/pages/instalador/InstaladorChecklist.tsx` | Adicionar FotoCapture para local de instalação |
| `src/hooks/useServicos.ts` | Aceitar `fotoLocalInstalacao` e salvar no rastreador |
| `src/hooks/useIniciarServico.ts` | Retry automático para GPS temporariamente indisponível |
| `src/components/vistoriador/TelaLocalizacaoBloqueada.tsx` | Mensagem diferenciada por tipo de erro |

