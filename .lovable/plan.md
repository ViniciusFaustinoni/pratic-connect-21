
## Diagnóstico — por que o modal aparece vazio

O modal `ModalDetalhesTroca` (aba **Dados**) renderiza `VeiculoCompletoCard`, que só consulta tabelas **locais**:

| Bloco do modal | Hook | Fonte | Por que vem vazio na Troca |
|---|---|---|---|
| Documentos do associado | `useDocumentosAssociadoCompleto(completo.associado.id)` | `documentos` + `contratos_documentos` filtrados pelo **associado atual do veículo** | O `veiculos.associado_id` ainda aponta para o **titular antigo** (Gabriel). Os documentos que o **novo titular (Anderson)** acabou de enviar no link público estão em `contratos_documentos` da **nova cotação** (`solicitacao.cotacao_id`) — nunca são lidos. |
| Fotos da vistoria | `useFotosVistoriaPorVeiculo(veiculoId)` | `vistorias.veiculo_id` local | Veículo entrou no sistema via import SGA — fotos históricas vivem no Hinova. Em Troca a autovistoria é dispensada, então não há foto nova local. |
| Vídeo 360° | `useVideos360PorVeiculo` | `vistorias.video_360_url` local | Idem. |
| Histórico do veículo | `useEventosVeiculo` | `sinistros` + `assistencias` locais | Eventos antigos ficaram no SGA (não foram importados). |
| Rastreador | `useVeiculoCompleto` → `rastreadores.veiculo_id` | local | Quando o veículo veio do SGA sem vínculo prévio na nossa tabela, fica "Sem rastreador instalado." mesmo se houver dispositivo ativo na Softtruck/Rede. |

Resumo: o card foi desenhado para cotações **novas**, onde tudo nasce local. Na Troca, o veículo é **legado** e o operador precisa de visão cross-sistemas. Nada disso é bug pontual do Anderson — é o comportamento padrão hoje.

---

## Escopo deste deploy (somente leitura, sem mudar fluxo de aprovação)

### Camada 1 — Frontend (consumo)

Reescrever `VeiculoCompletoCard.tsx` para receber, opcionalmente, contexto da Troca (`solicitacaoId`, `cotacaoId`, `novoAssociadoTemp`) e renderizar 3 blocos extras + corrigir o bloco de documentos. `ModalDetalhesTroca` passa esses props.

1. **Documentos — fix duplo de fonte**
   - Manter docs locais do associado atual (legado do antigo titular, se existir).
   - **NOVO:** adicionar `useDocumentosCotacao(cotacaoId)` lendo `contratos_documentos` por `cotacao_id` (uploads do novo titular no link público).
   - Renderizar os dois blocos com headers separados: "Documentos do antigo titular" e "Documentos enviados pelo novo titular".

2. **Bloco SGA Hinova (novo)** — consome `sga-buscar-associado-completo` via novo hook `useSgaVeiculoSnapshot(placa)`:
   - Situação financeira do veículo (INADIMPLENTE / ADIMPLENTE / sem sinal).
   - Boletos vencidos e a vencer (lista com vencimento, valor, status).
   - Histórico de eventos/sinistros do veículo no Hinova (quando o endpoint expõe).
   - Lista de fotos cadastradas no SGA (links/thumbs quando a API retorna URL; senão badge "X fotos no SGA"). Não baixar binário, só listar metadados.
   - Estados: loading / erro / "veículo não encontrado no SGA" / dados.

3. **Bloco Plataforma de Rastreamento (novo)** — consome:
   - `softruck-buscar-dispositivo` por placa ou chassi
   - `rede-veiculos-buscar-dispositivo` por placa
   
   Mostra: plataforma encontrada, IMEI, status do dispositivo, última comunicação, vínculo com cliente na plataforma. Se nenhum dos dois retornar, exibe "Sem rastreador conhecido nas plataformas". Permite ao Monitoramento decidir entre "fotos+rastreador novo" vs "só fotos" com base real.

4. **Nota visual** acima dos blocos atuais ("Fotos da vistoria", "Vídeo 360°", "Histórico"): quando a coleção local estiver vazia E o bloco SGA tiver dados correspondentes, mostrar mini-link "Ver no SGA" em vez do "Sem … registrados" seco. Isso evita a leitura errada de "não tem nada".

### Camada 2 — Backend (apenas o que falta)

Avaliar e, se necessário, criar/adaptar **uma única edge function** `sga-snapshot-veiculo`:
- Input: `{ placa }` ou `{ chassi }`
- Saída agregada: `{ veiculo, situacao_financeira, boletos[], eventos[], fotos[] }`
- Reaproveita as funções existentes (`sga-buscar-associado-completo`, `sga-listar-boletos-associado`, `sga-verificar-veiculo`, helpers de mídia). Se já houver uma edge equivalente, não criar — só consumir.

Antes de criar: confirmar com o usuário se já existe (regra de "não duplicar"). Provavelmente vai dar para reaproveitar `sga-buscar-associado-completo` direto com o CPF do antigo titular — nesse caso a Camada 2 é zero código novo.

---

## O que NÃO entra

- Não muda nenhuma lógica de aprovação/reprovação.
- Não muda RPC de banco nem trigger.
- Não mexe no fluxo de Cadastro (`/cadastro/aprovacoes`) — só na fila de Monitoramento da Troca. Se o usuário quiser propagar o enriquecimento para Cadastro num próximo deploy, faz separado.
- Não faz download/cópia automática das fotos do SGA para o nosso storage. Só lista/linka.
- Não toca em cotação nova (FIPE acima/abaixo) — fluxo comum já tem os dados locais.

---

## Validação

1. Abrir a Troca do Anderson (KPJ4994) no Monitoramento e confirmar:
   - Documentos do novo titular aparecem (os que ele subiu no link público).
   - Bloco SGA mostra situação financeira do veículo e boletos do antigo titular Gabriel.
   - Bloco Plataforma mostra dispositivo Softtruck/Rede se houver (placa KPJ4994).
   - Se SGA estiver fora do ar, blocos mostram erro tratado em vez de sumirem.
2. Abrir uma Troca de teste com veículo sem rastreador conhecido → bloco Plataforma mostra "Sem dispositivo conhecido" claramente, e não "erro".
3. Abrir uma cotação **comum** (não Troca) → nada muda visualmente (props opcionais não passados).

---

## Pergunta antes de executar

Quer que eu **(A)** entregue tudo (fix de docs + bloco SGA + bloco Plataforma) num único PR, ou **(B)** parta primeiro só pelo fix de documentos do novo titular (causa mais grave, é dado dele que está sumindo) e depois faça os blocos SGA/Plataforma em segundo deploy?
