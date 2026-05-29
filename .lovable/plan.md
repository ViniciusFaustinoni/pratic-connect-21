## Objetivo

Na tela `Monitoramento › Aprovação de Associados › Detalhe` (`src/pages/monitoramento/AprovacaoInstalacaoDetalhe.tsx`), incluir, junto aos dados do veículo, as informações que o técnico preenche na vistoria e as fotos específicas que hoje passam despercebidas no grid genérico de "Fotos da Instalação": **local do rastreador**, **avarias/ressalvas**, **código do rastreador**, **teste de comunicação**, **selfie do vistoriador**, **painel/odômetro ligado** e correlatas.

## Diagnóstico

- `resolverFotosVeiculo` já traz `vistoria_fotos` com `tipo='local_rastreador'`, `'avarias'`, `'codigo_rastreador'`, `'teste_comunicacao'`, etc. (confirmado no banco: 51 local_rastreador, 36 avarias, 34 código, 34 teste).
- Hoje todas caem num único grid "Fotos da Instalação", sem destaque e com `fotoLabels` incompleto (várias aparecem com o slug cru).
- As colunas `vistorias.avarias`, `vistorias.ressalvas`, `vistorias.observacoes`, `vistorias.observacoes_analise`, `vistorias.km_atual / quilometragem`, `vistorias.motivo_reprovacao` **não são lidas em lugar nenhum** dessa tela — é o que o usuário chama de "informações colocadas pelo técnico".

## Mudanças (somente UI/leitura — sem alterar fluxo de aprovação)

### 1. Hook `useServicoDetalheAprovacao`
Buscar a vistoria mais relevante do veículo para extrair os campos do técnico, sem mexer no resolver de fotos:

- Após obter `vistoriaRows` (já resolvido indiretamente), fazer um `select` adicional em `vistorias` por `veiculo_id` com `modalidade='presencial'` ordenado por `concluida_em desc` (fallback: a vistoria mais recente, qualquer modalidade).
- Retornar novo objeto `vistoriaTecnico` com: `avarias`, `ressalvas`, `observacoes`, `observacoes_analise`, `km_atual`, `quilometragem`, `motivo_reprovacao`, `modalidade`, `concluida_em`, `instalador_responsavel_id` (com join leve em `profiles` para nome).

### 2. Componente da tela — novo card "Vistoria do Técnico"
Inserir entre o card "Rastreador Instalado" e o card "Documentação do Associado":

- Bloco de texto exibindo, quando preenchidos: KM, Avarias, Ressalvas, Observações do técnico, Observações da análise, Motivo de reprovação (badge destrutivo), data/hora de conclusão e nome do técnico.
- Se `vistoriaTecnico` for nulo ou todos os campos vazios → renderizar nota "Sem informações registradas pelo técnico" em vez do card (não polui telas de autovistoria).

### 3. Novo card "Fotos da Vistoria Técnica"
Inserir logo abaixo do card acima:

- Filtrar `imageFotos` por `tipo ∈ TECNICO_FOTO_TIPOS`:
  `local_rastreador`, `codigo_rastreador`, `teste_comunicacao`, `avarias`, `motor`, `motor_chassi`, `motor_direito`, `motor_esquerdo`, `painel_km`, `painel_odometro_ligado`, `vistoriador_selfie`, `bateria`, `bateria_validade`, `painel_completo`, `chave`, `chave_roda_macaco`, `farol`.
- Agrupar visualmente por subseção: "Rastreador" (local/código/teste), "Avarias", "Mecânica" (motor/painel/bateria), "Outros".
- Mesma UX do grid existente (clique abre `setSelectedImage`).
- Ampliar `fotoLabels` com todas as chaves acima.

### 4. Ajuste no card "Fotos da Instalação" existente
- Renomear para "Fotos do Veículo" e filtrar para **excluir** os tipos já exibidos no novo card técnico, evitando duplicação visual.
- Manter contador e comportamento de clique.

## Não-objetivos

- Não alterar lógica de aprovar/reprovar/devolver ao cadastro.
- Não tocar em RLS, edge functions, migrações, fluxo de vistoria ou autovistoria.
- Não mudar o resolver canônico `resolverFotosVeiculo`.

## Validação

- Abrir o detalhe de um serviço com vistoria presencial concluída (caso recente com local_rastreador/avarias) e confirmar que o novo card aparece com texto + fotos.
- Abrir um serviço de autovistoria sem dados técnicos e confirmar que o novo card não polui a tela.
- Verificar console sem erros e build limpo.
