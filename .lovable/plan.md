

# Plano: Validação de Presença GPS ao Iniciar Serviço

## Resumo

Adicionar verificação de localização GPS quando o vistoriador toca "Cheguei no Local", com registro para auditoria. Configurável pela Diretoria (toggle on/off + raio). Visível pelo coordenador no detalhe do serviço.

---

## PARTE 1 — DB: Configuração + Tabela de Auditoria

**Configurações** (insert na tabela `configuracoes`):
- `gps_validacao_ativa` = `true`
- `gps_raio_metros` = `500`

**Nova tabela `registros_presenca`**:
```
id (uuid PK), servico_id (FK servicos), latitude_vistoriador (float), 
longitude_vistoriador (float), latitude_destino (float), longitude_destino (float),
distancia_metros (float), dentro_do_raio (boolean), confirmou_presenca (boolean),
gps_indisponivel (boolean default false), created_at (timestamptz)
```
RLS: insert para authenticated, select para authenticated.

---

## PARTE 2 — Diretoria (`InstalacaoRotasConfig.tsx`)

Adicionar **Bloco 7** após SLA:
- Toggle `Switch` "Exigir validação de localização" (chave `gps_validacao_ativa`)
- Campo numérico "Raio máximo de tolerância (metros)" visível quando toggle ligado (chave `gps_raio_metros`)
- Botão "Salvar GPS"
- Adicionar as 2 chaves ao `CONFIG_CHAVES` e ao hook, state vars, populate e save

---

## PARTE 3 — Hook `useValidacaoPresenca`

**Novo arquivo**: `src/hooks/useValidacaoPresenca.ts`

Lógica:
1. Query `configuracoes` para `gps_validacao_ativa` e `gps_raio_metros` (cache 10min)
2. Função `validarPresenca(servicoId, enderecoCompleto, latDestino?, lonDestino?)`:
   - Se validação desativada → retorna `{ aprovado: true, pulou: true }`
   - Obtém posição GPS via `navigator.geolocation.getCurrentPosition`
   - Se endereço sem lat/lon, geocodifica via edge function `geocode-endereco` (já existe)
   - Calcula distância Haversine entre posição atual e destino
   - Insere registro na tabela `registros_presenca`
   - Retorna `{ aprovado, distancia, dentrDoRaio, gpsIndisponivel }`
3. Se GPS falhar/negado → retorna `{ aprovado: true, gpsIndisponivel: true }`, registra mesmo assim

---

## PARTE 4 — Componente `ModalValidacaoPresenca`

**Novo arquivo**: `src/components/vistoriador/ModalValidacaoPresenca.tsx`

Dialog reutilizável com 3 estados:
- **Loading**: "Verificando sua localização..." com spinner
- **Fora do raio**: "Você está a X metros do endereço." + botões "Estou no local correto" (prossegue, registra divergência) e "Ainda estou a caminho" (fecha)
- **GPS indisponível**: Alert informativo, prossegue automaticamente

---

## PARTE 5 — Acoplamento nos 4 fluxos de execução

Em cada arquivo, interceptar o `handleCheguei` existente:

| Arquivo | Ponto de interceptação |
|---|---|
| `ExecutarManutencao.tsx` (linha 124) | `handleCheguei` chama `iniciarServico(id)` |
| `ExecutarRetirada.tsx` (linha 259) | `handleCheguei` chama `iniciarServico(servicoId)` |
| `ExecutarVistoriaCompleta.tsx` | Não tem `handleCheguei` — o serviço já chega em andamento (verificar) |
| `InstaladorChecklist.tsx` | Não tem `handleCheguei` — usa `useServicoDetalhes` (serviço já iniciado) |

**Nota**: Apenas ExecutarManutencao e ExecutarRetirada têm botão "Cheguei". Para VistoriaCompleta e InstaladorChecklist, o serviço já está em andamento quando a página abre. A validação será adicionada nos 2 arquivos que têm `handleCheguei`. Se necessário, podemos adicionar validação no InstaladorChecklist na etapa 1 (Dados) como verificação inicial.

Fluxo no `handleCheguei`:
1. Abrir modal de validação
2. Chamar `validarPresenca` com endereço do serviço
3. Se dentro do raio ou GPS indisponível → prosseguir com `iniciarServico`
4. Se fora do raio → mostrar distância e botões de decisão

---

## PARTE 6 — Visibilidade no Coordenador (`InstalacaoDetailDrawer.tsx`)

Adicionar seção "Registro de Presença" quando `servico.iniciada_em` existe:
- Query `registros_presenca` por `servico_id`
- Exibir: status (Dentro/Fora/GPS indisponível), distância, link Google Maps
- Seção condicional: só aparece se há registro

---

## PARTE 7 — Painel RH

Adicionar os 2 campos GPS (toggle e raio) ao painel read-only de parâmetros em `JornadasProfissionais.tsx`.

---

## Arquivos afetados

| Arquivo | Alteração |
|---|---|
| DB migration | Tabela `registros_presenca` + 2 inserts em `configuracoes` |
| `src/components/gestao-comercial/InstalacaoRotasConfig.tsx` | Bloco 7 GPS |
| `src/hooks/useValidacaoPresenca.ts` | **Novo** |
| `src/components/vistoriador/ModalValidacaoPresenca.tsx` | **Novo** |
| `src/pages/instalador/ExecutarManutencao.tsx` | Interceptar `handleCheguei` |
| `src/pages/instalador/ExecutarRetirada.tsx` | Interceptar `handleCheguei` |
| `src/components/instalacoes/InstalacaoDetailDrawer.tsx` | Seção presença |
| `src/pages/rh/JornadasProfissionais.tsx` | 2 campos GPS read-only |

