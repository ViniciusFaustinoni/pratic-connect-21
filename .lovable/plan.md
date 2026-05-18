
## Diagnóstico — caso JUAN DOMINGOS CHAGAS / KOA4D63 (Honda CG 150 Titan, FIPE R$ 11.053)

Veículo `23a2bfb7…`, contrato `1dca5199…` (cadastro_aprovado=true), cotação `9b199c6f…` (status `aceita / pagamento_ok`), instalação `6f6cbb8f…` (status `nao_compareceu`).

Estado real no banco:
- `cotacoes_vistoria_fotos` → **3 fotos** (chassi, motor, video_360) — é a autovistoria enxuta acima do mínimo.
- `vistorias` (por `veiculo_id` ou `cotacao_id`) → **0 registros**.
- `vistoria_fotos` → 0.
- `servicos` → 1 linha tipo `instalacao` (presencial, `nao_compareceu`).

Por isso a tela de **Instalações** mostra as 2 fotos (Chassi + Motor): aquela tela lê direto de `cotacoes_vistoria_fotos` via cotação. Já o drawer de **Cadastro / Veículos** usa `useFotosVistoriaPorVeiculo` (`src/hooks/useVeiculoDetalhes.ts`), que parte de `vistorias.veiculo_id` → `vistoria_fotos`. Como não existe `vistorias` para esse veículo, o resultado é "Nenhuma foto".

## Causa raiz

A edge `finalizar-autovistoria-cotacao` é a única peça que materializa `cotacoes_vistoria_fotos` em `vistorias` + `vistoria_fotos` (regra de memória "Autovistoria materializada"). Ela só é chamada pelo hook `useFinalizarVistoriaCotacao` no branch `tipoVistoria === 'autovistoria'`.

No caminho **"FIPE acima do mínimo + autovistoria opcional"**, o cliente:
1. Agenda a instalação presencial → o hook entra no branch `tipoVistoria === 'agendada'` e chama `agendar-vistoria-presencial` (cria `instalacoes` + `servicos` tipo `instalacao`).
2. Em paralelo/depois envia fotos de chassi/motor/vídeo no link público → caem em `cotacoes_vistoria_fotos`.
3. Como o branch `autovistoria` nunca executa, **`finalizar-autovistoria-cotacao` nunca é invocado**, e nada é copiado para `vistorias`/`vistoria_fotos`.

Resultado: divergência permanente — Instalações enxerga as fotos (via cotação), Cadastro/Veículos não enxerga (via vistoria). Isso afeta **todo associado que escolheu vistoria presencial e mesmo assim mandou autovistoria opcional**, não só o Juan.

## Plano para resolver de vez

### 1. Sempre materializar autovistoria opcional, mesmo no fluxo presencial

`supabase/functions/agendar-vistoria-presencial/index.ts`: depois de criar `instalacoes`/`servicos`, verificar se existem linhas em `cotacoes_vistoria_fotos` para a cotação; se sim, invocar `finalizar-autovistoria-cotacao` (já é idempotente por `cotacao_id`) com flag indicando origem opcional para que o serviço materializado nasça já `concluida/aprovada` (não como `em_analise`, pois o fluxo principal segue a instalação presencial).

`supabase/functions/finalizar-autovistoria-cotacao/index.ts`: aceitar um parâmetro `origem: 'opcional_acima_fipe'` e, quando presente, pular a criação do `servico` (já existe um serviço de instalação presencial — ver memória "Base não duplica instalação") e gerar a `vistoria` com `tipo='entrada'`, `status='aprovada'`, `modalidade='autovistoria'` apenas para fins de fonte de verdade das fotos.

`src/hooks/useCotacaoVistoria.ts`: no `useUploadFotoCotacaoVistoria.onSuccess` (ou no fim do upload da 3ª foto / vídeo final), disparar `finalizar-autovistoria-cotacao` em modo opcional quando o veículo está acima do mínimo e o fluxo escolhido é presencial — fecha o ciclo no upload, sem depender de uma ação "Finalizar".

### 2. Backfill histórico (migration de dados)

Migration que, para cada `cotacoes_vistoria_fotos` órfão (cotação com fotos e sem `vistorias` correspondente), cria a `vistorias` canônica e copia as fotos para `vistoria_fotos`. Trazer junto `veiculo_id`, `contrato_id` e `associado_id` resolvidos via `contratos.cotacao_id`. Idempotente: usa `NOT EXISTS` em `vistorias.cotacao_id`. Cobre o caso do Juan e todos os irmãos históricos.

### 3. Fallback de leitura defensivo

`src/hooks/useVeiculoDetalhes.ts › useFotosVistoriaPorVeiculo`: quando `vistorias` retornar vazio, fazer um segundo lookup por `contratos.veiculo_id` → `cotacao_id` → `cotacoes_vistoria_fotos`, normalizando o shape para `FotoVistoriaVeiculo` (com `vistoria_status: 'autovistoria_pendente_materializacao'`). É uma rede de segurança para qualquer regressão futura — não substitui a materialização, mas garante que nunca mais haverá "tela vazia" enquanto as fotos existem no banco.

### 4. Verificação

- Após a migration, rodar SELECT confirmando que existe `vistorias` + `vistoria_fotos` para a cotação `9b199c6f-ead5-4efd-967c-8d3e07533c4e` e que o drawer de Veículos passa a exibir as 3 fotos.
- Reproduzir o fluxo presencial + autovistoria opcional em ambiente de teste (login `admin@teste.com`) e confirmar que o novo caso materializa sozinho.

## Detalhes técnicos

- Tabelas: `vistorias`, `vistoria_fotos`, `cotacoes_vistoria_fotos`, `contratos`, `veiculos`, `servicos`, `instalacoes`.
- Edges alteradas: `finalizar-autovistoria-cotacao`, `agendar-vistoria-presencial`.
- Hooks alterados: `src/hooks/useCotacaoVistoria.ts`, `src/hooks/useVeiculoDetalhes.ts`.
- Sem mudanças de UI; só backend + hook de leitura. Respeita as memórias "Autovistoria materializada", "Base não duplica instalação", "Vistoria nunca órfã" e "Autovistoria não conclui instalação".
