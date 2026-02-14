
# Botoes de Acao Adicionais na Tela de Analise

## Contexto

A tela de analise do evento (`SinistroAnalise.tsx`) tem botoes "Aprovar Sinistro", "Reprovar Sinistro" e "Solicitar Documentos". Abaixo deles, adicionar uma segunda linha com 4 botoes em estilo outline, cada um abrindo um modal especifico.

## Componentes Existentes (reutilizar)

- `EncaminharSindicanciaDialog` -- ja existe, mas precisa ser expandido conforme especificacao (radio sindicancia/pericia, motivos completos, campo empresa terceirizada, prazo configuravel ate 90 dias, aviso amarelo sobre suspensao de prazo)
- `EncaminharJuridicoEventoModal` -- ja existe, mas precisa ser expandido (adicionar tipos "analise_juridica_alagamento_incendio", "documentacao_indenizacao"; campo de prioridade; campo de advogado responsavel; criacao de numero sequencial do caso)

## Componentes Novos

### 1. AnaliseInternaModal

**Arquivo:** `src/components/sinistros/AnaliseInternaModal.tsx`

Modal para registrar irregularidades que nao sao fraude. Conteudo:
- Dropdown de irregularidade: condutor sem CNH, CNH vencida, condutor embriagado, GNV irregular, sobrecarga eletrica, rastreador nao instalado quando obrigatorio, local inadequado, agua salgada, outro
- Textarea para descricao da irregularidade
- RadioGroup "O que fazer agora":
  - "Prosseguir com aprovacao" -- marca `analise_interna=true` com os motivos, nao muda status
  - "Solicitar mais documentos" -- muda status para `documentacao_pendente`
  - "Abrir sindicancia" -- fecha este modal e abre `EncaminharSindicanciaDialog`
  - "Encaminhar ao juridico" -- fecha este modal e abre `EncaminharJuridicoEventoModal`
- Aviso em destaque azul: "Analise interna e tratamento INTERNO. O associado nao e informado."
- Registra no historico

### 2. SuspenderEventoModal

**Arquivo:** `src/components/sinistros/SuspenderEventoModal.tsx`

Modal simples para suspender o evento (inquerito policial, etc). Conteudo:
- Dropdown de motivo: "Inquerito policial", "Mandado judicial", "Aguardando pericia oficial", "Determinacao da diretoria", "Outro"
- Campo de texto para numero do inquerito/processo (opcional)
- Campo de data para previsao de retorno (opcional)
- Textarea para observacoes
- Ao confirmar: muda status para `suspenso`, grava `motivo_suspensao`, registra historico

## Modificacoes em Componentes Existentes

### 3. Expandir EncaminharSindicanciaDialog

**Arquivo:** `src/components/sinistros/EncaminharSindicanciaDialog.tsx`

Adicionar:
- RadioGroup no topo: Sindicancia vs Pericia Tecnica (substituir checkbox por radio mais visivel)
- Lista completa de motivos unificada (nao por tipo de evento): suspeita de fraude, inconsistencia no relato, historico de multiplos sinistros, dados suspeitos do rastreador, documentacao irregular, GNV irregular, sobrecarga eletrica, local inadequado, agua salgada, terceiro suspeito, outro
- Descricao detalhada obrigatoria (min 50 caracteres)
- Opcao de responsavel: "Equipe interna" (select de usuarios) ou "Empresa terceirizada" (campos nome e contato)
- Prazo configuravel de 1 a 90 dias (input number), padrao 30, com data calculada ao lado
- Aviso amarelo em destaque: "Ao abrir sindicancia, o prazo de ressarcimento do associado sera automaticamente suspenso conforme Regulamento art. 10.5. O associado nao sera notificado."

### 4. Expandir EncaminharJuridicoEventoModal

**Arquivo:** `src/components/sinistros/EncaminharJuridicoEventoModal.tsx`

Adicionar:
- Tipos expandidos: questao legal complexa, analise juridica (alagamento/incendio), documentacao de indenizacao, disputa de proprietario, gravame judicial, espolio ou massa falida, outro
- Campo de prioridade: baixa, normal, alta, urgente
- Campo de advogado responsavel (select de advogados ativos, usando `useAdvogados`)
- Aviso: "O evento ficara com status 'aguardando juridico' ate o departamento emitir parecer."
- Ao confirmar: criar consulta juridica, mudar status para `suspenso` com motivo, registrar historico

### 5. Integrar na SinistroAnalise

**Arquivo:** `src/pages/eventos/SinistroAnalise.tsx`

- Importar os 4 modais
- Adicionar 4 states: `showSindicancia`, `showAnaliseInterna`, `showJuridico`, `showSuspender`
- Abaixo dos botoes Aprovar/Reprovar/Solicitar Docs, adicionar separador e linha com 4 botoes:

```text
[ Sindicancia (amarelo outline) ] [ Analise Interna (azul outline) ]
[ Juridico (roxo outline) ]       [ Suspender (cinza outline) ]
```

- Cada botao so aparece quando o status permite acao (ex: nao mostrar se ja esta suspenso/negado/encerrado)
- O `AnaliseInternaModal` recebe callbacks `onOpenSindicancia` e `onOpenJuridico` para encadear modais
- Passar `associadoId`, `associadoNome`, `protocolo`, `sinistroId`, `tipoEvento` aos modais

## Resumo de Arquivos

| Acao | Arquivo |
|---|---|
| Criar | `src/components/sinistros/AnaliseInternaModal.tsx` |
| Criar | `src/components/sinistros/SuspenderEventoModal.tsx` |
| Modificar | `src/components/sinistros/EncaminharSindicanciaDialog.tsx` |
| Modificar | `src/components/sinistros/EncaminharJuridicoEventoModal.tsx` |
| Modificar | `src/pages/eventos/SinistroAnalise.tsx` |

## Migracao de Banco

Nenhuma migracao necessaria. As colunas `motivo_suspensao`, `analise_interna`, `analise_interna_motivos`, `sindicante_id`, `sindicancia_prazo_fim` ja existem na tabela `sinistros`. A tabela `consultas_juridicas` ja tem todos os campos necessarios.

## Ordem de Implementacao

1. `AnaliseInternaModal.tsx` -- criar novo modal
2. `SuspenderEventoModal.tsx` -- criar novo modal
3. `EncaminharSindicanciaDialog.tsx` -- expandir com especificacao completa
4. `EncaminharJuridicoEventoModal.tsx` -- expandir com advogado e prioridade
5. `SinistroAnalise.tsx` -- integrar os 4 botoes e modais
