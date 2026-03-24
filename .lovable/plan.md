

# Reestruturar Autovistoria: Vídeo + 2 Fotos + Histórico Oculto de Vídeos

## Resumo

Simplificar a autovistoria para exigir apenas **1 vídeo (câmera only) + 1 foto do chassi + 1 foto do motor**. O vídeo deve incluir instruções de gravação, ser capturável somente pela câmera (sem galeria), e todas as versões de vídeo (mesmo excluídas pelo associado) devem ser salvas silenciosamente e exibidas ao analista de cadastro. Na análise, mostrar a validação chassi vs CRLV para aprovação de roubo/furto.

## Arquivos

| Arquivo | Acao |
|---------|------|
| `src/data/autovistoriaConfig.ts` | **Editar** — Reduzir fotos de carro para 2 (chassi + motor), moto para 2 (chassi + motor) |
| `src/components/associado/Autovistoria.tsx` | **Editar** — Reestruturar fluxo: vídeo com instruções primeiro, depois 2 fotos; salvar vídeos antigos silenciosamente |
| `src/components/instalador/VideoCapture.tsx` | **Editar** — Remover opção "Selecionar da Galeria", forçar `capture="environment"` |
| `src/hooks/useContratoLink.ts` | **Editar** — Ao substituir vídeo, NÃO deletar o anterior; salvar histórico em `vistoria_fotos` com tipo `video_360_historico_N` |
| `src/pages/cadastro/AnaliseVistoria.tsx` | **Editar** — Exibir todos os vídeos (incluindo histórico oculto) e destaque da validação chassi vs CRLV |
| Migration SQL | **Criar** — Nenhuma migration necessária; `vistoria_fotos` já suporta múltiplos registros |

## Detalhes Técnicos

### 1. Reduzir fotos (autovistoriaConfig.ts)
- `FOTOS_AUTOVISTORIA_CARRO`: manter apenas `chassi` (ordem 1) e `motor` (ordem 2, novo item — foto aproximada do motor/número do motor)
- `FOTOS_AUTOVISTORIA_MOTO`: manter apenas `motor_chassi` (ordem 1) e `motor` (ordem 2)
- Adicionar nova entrada `motor` para carro com instruções de como fotografar o motor

### 2. VideoCapture — Camera only (VideoCapture.tsx)
- Remover botão "Selecionar da Galeria" e o `<input type="file">` associado
- Manter apenas o botão "Gravar Vídeo" que usa `navigator.mediaDevices.getUserMedia`
- Adicionar prop `cameraOnly?: boolean` (default false) para manter retrocompatibilidade com outros usos do componente

### 3. Instruções de gravação do vídeo (Autovistoria.tsx)
- Antes da gravação, exibir card com instruções passo-a-passo:
  - "Comece filmando a frente do veículo com a placa visível"
  - "Caminhe lentamente pela lateral direita"
  - "Filme a traseira com a placa visível"
  - "Continue pela lateral esquerda até voltar à frente"
  - "Filme o interior: painel, bancos e odômetro"
  - "Duração mínima: 30 segundos / Máxima: 2 minutos"
- O fluxo agora é: **Instruções → Vídeo → Foto Chassi → Foto Motor → Conclusão**
- Vídeo obrigatório para TODOS os tipos (carro e moto), não apenas carro

### 4. Salvar vídeos substituídos silenciosamente (useContratoLink.ts)
- No `handleVideoCapture` / `useUploadFotoAutovistoria`:
  - Quando o tipo é `video_360` e já existe um registro anterior, NÃO fazer upsert
  - Em vez disso, renomear o registro existente para `video_360_historico_{timestamp}` (INSERT novo registro)
  - O novo vídeo entra como `video_360` normalmente
  - O associado só vê o vídeo atual; os históricos ficam "invisíveis" para ele
- O arquivo no Storage NÃO é deletado (manter para o analista)

### 5. Exibir todos os vídeos ao analista (AnaliseVistoria.tsx)
- Na seção de mídias, buscar todas as `vistoria_fotos` com tipo `LIKE 'video_360%'`
- Exibir o vídeo principal + seção colapsável "Vídeos anteriores (N)" com os históricos
- Badge de alerta se houver múltiplos vídeos: "Associado substituiu o vídeo N vez(es)"
- Manter o card de validação do chassi existente — já funciona com `chassi_validacao` e `chassi_ocr`

### 6. Validação Chassi vs CRLV para Roubo/Furto
- A validação via IA (chassi-ocr) já existe e já salva `chassi_validacao`, `chassi_ocr`, `chassi_ocr_confianca` na vistoria
- A tela `AnaliseVistoria.tsx` já exibe o card de comparação caractere por caractere
- Adicionar destaque visual extra: se `chassi_validacao === 'diverge'`, mostrar alerta vermelho proeminente com texto "⚠️ ATENÇÃO: Chassi divergente do CRLV — verificar antes de aprovar cobertura de Roubo/Furto"

