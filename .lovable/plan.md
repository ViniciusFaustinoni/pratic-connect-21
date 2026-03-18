

## Plano: Remover vídeo 360° da autovistoria do associado

### Arquivo alterado
`src/components/cotacao-publica/AutovistoriaCotacao.tsx`

### Alterações

1. **Remover estado e lógica do vídeo**: Eliminar `videoUrl`, `uploadingVideo`, `videoObrigatorio`, `handleVideoCapture` e a importação de `VideoCapture` e ícone `Video`.

2. **Simplificar condição de conclusão**: A variável `todasEnviadas` passa a ser simplesmente `todasFotosEnviadas` (sem verificar vídeo).

3. **Remover bloco de UI do vídeo** (linhas 432-457): O bloco condicional que renderiza `VideoCapture` após todas as fotos será removido.

4. **Atualizar `dicaExtra` da última foto**: No arquivo `src/data/autovistoriaConfig.ts`, remover a menção ao vídeo 360° do `dicaExtra` do `odometro` (última foto), substituindo por algo como "Esta é a última foto! Após enviar, conclua a vistoria."

### O que não muda
- Fotos obrigatórias do associado (15 para carro, 7 para moto)
- Fluxo do instalador (`vistoriaConfigCompleta.ts`, `useVistoriaCompleta.ts`)
- Componente `VideoCapture` continua existindo para uso do instalador

