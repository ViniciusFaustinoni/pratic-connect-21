## Causa raiz

Dois gates de débito permaneceram no backend mesmo depois da introdução do campo "Tipo da Cotação" (15/05), que era para ser apenas informativo:

1. **`contrato-gerar/index.ts`** — bloco "GATE DE DÉBITOS" (~linha 468) devolve `409 DEBITO_PENDENTE` quando há boletos abertos, independente do tipo de cotação escolhido pelo operador.
2. **`criar-cotacao*` / `criar-substituicao*`** — também possuem checagens de débito que disparam `DEBITO_PENDENTE`.
3. A flag de configuração `inclusao_bloqueio_debito_ativo` não existe na tabela `configuracoes`, então o fallback default ativa bloqueio.
4. O valor de `tipoCotacao` selecionado no modal hoje é persistido em `cotacoes.tipo_entrada` / extra, mas **não é propagado** como `observacao` para o payload do `sga-hinova-sync` (campo `observacoes` do veículo no SGA).

Resultado: o operador escolhe "Cotação nova (adesão)" / "Ignorar e prosseguir", o sistema avisa visualmente que é só informativo, mas o backend continua barrando — exatamente o cenário que a feature de 15/05 removeu.

## Solução definitiva

### 1. Remover gates de débito do fluxo de cotação
- `supabase/functions/contrato-gerar/index.ts`: remover o bloco "GATE DE DÉBITOS" inteiro. Inadimplência passa a ser tratada apenas no **Cadastro** (gate canônico já existente em `verificar-situacao-financeira-cadastro`), nunca na criação da cotação.
- `supabase/functions/criar-cotacao*/index.ts` e `criar-substituicao*/index.ts`: remover quaisquer retornos `409 DEBITO_PENDENTE`. Manter apenas o aviso visual no front (modal "Veículo já cadastrado / Ignorar e prosseguir").
- Manter a regra canônica de substituição com débito do **mesmo veículo** (memory `mem://logic/operations/sga-inadimplencia-veiculo-canonica`) — esta continua bloqueando, pois é regra de negócio absoluta. Apenas débitos genéricos do CPF deixam de travar a criação.

### 2. Tornar "Tipo da Cotação" realmente informativo + sincronizar com SGA
- Adicionar coluna `observacao_sga TEXT` em `cotacoes` (e espelhar em `contratos` / `veiculos.observacoes_sga`) via migration.
- `CotacaoFormDialog.tsx`: adicionar **campo de texto livre "Observação (vai para o SGA)"** logo abaixo do select "Tipo da Cotação". O valor final enviado ao SGA será: `[{label do tipoCotacao}] {texto livre opcional} | {motivo do "Ignorar e prosseguir" quando aplicável}`.
- `contrato-gerar` e `criar-cotacao*`: persistir esse texto consolidado em `cotacoes.observacao_sga` e propagar para `contratos.observacao_sga` / `veiculos.observacoes_sga`.
- `sga-hinova-sync`: ler `veiculos.observacoes_sga` (com fallback para o consolidado do contrato/cotação) e enviar no campo `observacoes` do payload de cadastro/atualização do veículo no Hinova. Append-only — nunca sobrescrever observações já existentes no SGA.

### 3. Saneamento e auditoria
- Backfill simples: copiar `tipo_entrada` legível para `observacao_sga` em cotações criadas após 15/05 que ainda não têm valor, para não perder o histórico.
- Log estruturado em `logs_sistema` com `evento='cotacao_observacao_sga_enviada'` contendo `cotacao_id`, `veiculo_id`, texto enviado e resposta do SGA.

## Arquivos afetados

- `supabase/functions/contrato-gerar/index.ts` — remover gate de débitos, gravar `observacao_sga`.
- `supabase/functions/criar-cotacao-publica/index.ts`, `criar-cotacao-interna/index.ts`, `criar-substituicao*` — remover `DEBITO_PENDENTE`, persistir `observacao_sga`.
- `supabase/functions/sga-hinova-sync/index.ts` — incluir `observacoes` no payload do veículo.
- `src/components/cotacao/CotacaoFormDialog.tsx` — adicionar input "Observação (SGA)" + consolidar string final.
- `src/components/cotacao/VeiculoJaCadastradoDialog.tsx` (modal da screenshot) — capturar o motivo do "Ignorar e prosseguir" e injetar na observação consolidada.
- Migration: `cotacoes.observacao_sga`, `contratos.observacao_sga`, `veiculos.observacoes_sga` (se não existir).

## Validação

1. Cotação para CPF com boleto aberto + tipo "Cotação nova (adesão)" → cria normalmente, NÃO retorna `DEBITO_PENDENTE`.
2. Inadimplência continua barrando no **Cadastro** (gate canônico preservado).
3. Substituição com débito **do próprio veículo** continua barrando (regra de negócio).
4. Conferir no SGA que o campo `observacoes` do veículo recebeu o texto consolidado (tipo + observação livre + motivo do ignorar).
5. Replay do caso ALEXANDRE GUTTI: a cotação deve ser criada; o bloqueio aparece apenas quando o Cadastro abrir a proposta.
