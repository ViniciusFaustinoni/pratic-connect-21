

# Ajustar instruções de gravação do vídeo na autovistoria

## Situacao Atual

O sistema **ja implementa** quase tudo que foi solicitado:
- Apenas 1 video + foto do chassi + foto do motor (config em `autovistoriaConfig.ts`)
- Video somente pela camera, sem galeria (`cameraOnly={true}`)
- Historico silencioso de videos substituidos (renomeia para `video_360_historico_N`)
- Validacao do chassi via OCR com alerta para o analista na tela de analise
- Analista ve todos os videos historicos na pagina de analise

## Unica Mudanca Necessaria

As instrucoes de gravacao do video (passo 5) nao mencionam explicitamente **entrar no veiculo** e **ligar o veiculo**. O usuario pediu que isso fique claro.

## Arquivo

| Arquivo | Acao |
|---------|------|
| `src/components/associado/Autovistoria.tsx` | **Editar** — expandir instrucoes de gravacao |

## Detalhes

Substituir o passo 5 atual por 3 passos mais detalhados (5, 6, 7):

- **Passo 5**: "Entre no veículo e filme o **interior: bancos, forração e teto**"
- **Passo 6**: "**Ligue o veículo** e filme o **painel ligado** mostrando o hodômetro e indicadores"
- **Passo 7**: "Filme o **compartimento do motor** com o capô aberto"

Isso alinha as instrucoes com o que o usuario descreveu: filmar toda a parte externa, entrar no veiculo, ligar o veiculo, filmar painel e parte interna.

