
# Correcoes: Vistoria do Regulador

## Verificacao Completa

### 1. Dados do Regulador — VistoriaEventoDados.tsx

| Item | Status |
|---|---|
| Nome, CPF, telefone, email | OK |
| Plano e categoria | OK |
| Adimplencia | OK |
| Veiculo: placa, marca, modelo, ano, cor, FIPE, chassi | OK |
| Tipo do evento | BUG — hardcoded "Colisao" (linha 117) |
| Data/hora evento e comunicacao | OK |
| Tempo entre evento e comunicacao | OK |
| Relato escrito | OK |
| Audio (player) | OK |
| Local + dados terceiro | OK |
| Fotos auto vistoria (galeria com zoom) | OK |
| B.O. visualizador | OK |
| Numero do B.O. | BUG — busca `bo_numero` mas etapa2 salva como `numero_bo` |
| Resumo do B.O. | FALTANDO — nao exibe o campo `resumo_bo` |

### 2. Execucao da Vistoria — VistoriaEventoMidias.tsx

| Item | Status |
|---|---|
| 10 slots numerados | OK |
| Abre camera do celular | OK |
| Miniatura apos tirar foto | OK |
| Nao avanca sem 10 fotos | OK |
| Gravacao de video | OK |
| Player para revisar + regravar | OK |
| Limite 2 minutos | OK |
| Upload para Storage pasta vistoria-regulador | OK |
| Retry automatico (3 tentativas) | OK |
| Feedback visual (spinner) | OK |
| Botao Prosseguir so com 10 fotos + 1 video | OK |

### 3. Modal de Orcamento — VistoriaEventoOrcamento.tsx

| Item | Status |
|---|---|
| Tipo de dano: Parcial ou Total | OK |
| Perda total: apenas observacoes, sem orcamento | OK |
| Descricao tecnica dos danos | OK |
| Etapas de reparo: 6 checkboxes na ordem fixa | OK |
| Cada checkbox com nome + descricao | OK |
| Obrigatorio pelo menos 1 etapa | OK |
| Resumo visual com setas | OK |
| Ordem fixa 1-6 respeitada | OK |
| Itens orcamento (descricao, tipo, valor, qtd, total) | OK |
| Botao adicionar item | OK |
| Rodape com total | OK |
| Parecer tecnico | OK |
| Recomendacao (aprovar / analise detalhada) | OK |
| Finalizar salva no banco | OK |
| Vistoria -> concluida | OK |
| Evento -> aguardando_analise | OK |
| **Formato etapas_reparo** | **BUG CRITICO** |

---

## 3 Problemas Encontrados

### Problema 1 — Tipo hardcoded "Colisao" (VistoriaEventoDados.tsx)

Linha 117 usa fallback `'Colisao'` em vez de generico.

**Correcao:** Trocar por `sinistro?.tipo?.replace(/_/g, ' ') || 'Evento'`

### Problema 2 — Campo B.O. com nome errado + resumo faltando (VistoriaEventoDados.tsx)

A etapa 2 do associado salva os campos como `numero_bo` e `resumo_bo`, mas o componente do regulador busca `bo_numero` e nao exibe o resumo.

**Correcao:**
- Linha 172: trocar `dadosEtapa2?.bo_numero` por `dadosEtapa2?.numero_bo`
- Adicionar exibicao do campo `dadosEtapa2?.resumo_bo` abaixo do numero

### Problema 3 — Formato das etapas_reparo incompativel (CRITICO)

O `VistoriaEventoOrcamento.tsx` salva etapas como array de strings: `['lanternagem', 'pintura', 'polimento']`

Porem, os componentes downstream esperam objetos:
- `AtribuirFornecedoresDialog` espera `{ nome: string, selecionada: boolean }`
- `RegistrarAtualizacaoDialog` espera `{ nome: string, status: 'pendente' | 'em_andamento' | 'concluida' }`
- `EtapasProgress` espera objetos com `status`

**Correcao:** Alterar o `VistoriaEventoOrcamento.tsx` para salvar etapas no formato que os componentes downstream esperam:

```text
etapas_reparo: ETAPAS_REPARO
  .filter(e => etapasReparo.includes(e.id))
  .map((e, i, arr) => ({
    id: e.id,
    nome: e.nome,
    selecionada: true,
    status: i === 0 ? 'pendente' : 'pendente',
  }))
```

Isso garante que quando a OS for gerada a partir da vistoria, as etapas ja estarao no formato correto para o acompanhamento diario (status pendente -> em_andamento -> concluida).

---

## Arquivos Afetados

| Acao | Arquivo |
|---|---|
| Modificar | `src/components/regulador/VistoriaEventoDados.tsx` — corrigir tipo hardcoded, campo B.O., adicionar resumo |
| Modificar | `src/components/regulador/VistoriaEventoOrcamento.tsx` — converter formato etapas_reparo para objetos |
