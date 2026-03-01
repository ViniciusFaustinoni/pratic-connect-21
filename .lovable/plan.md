

# Confirmacao de Condicao apos Checklist com Itens Negativos

## Contexto Atual

Hoje, quando o vistoriador/instalador marca itens como "NOK" (negativo) no checklist e clica em "Proximo", o sistema simplesmente avanca para a etapa de fotos. Os itens negativos so aparecem na etapa final (Decisao), onde bloqueiam a opcao "Aprovado". Isso faz com que o profissional percorra todas as etapas (fotos, video, assinatura) para so no final descobrir que a decisao esta limitada.

## Problema

- Tempo desperdicado: o profissional tira 30+ fotos e coleta assinatura para depois negar o servico
- Falta de triagem: nao ha validacao intermediaria sobre a gravidade dos itens negativos
- Processo cego: o sistema nao diferencia itens criticos (chassi, placa) de itens menos graves (bateria fraca)

## Solucao Proposta

### 1. Classificacao de Itens do Checklist por Criticidade

Dividir os itens em duas categorias:

**Criticos (impedem o servico):**
- Veiculo/moto nao corresponde aos dados cadastrados
- Placa nao confere com o documento
- Chassi nao confere (motos)

**Condicionais (podem prosseguir com ressalva):**
- Condicoes do veiculo inadequadas
- Local de instalacao inseguro
- Bateria em mas condicoes
- Acessorios eletricos com problema
- Associado nao ciente do procedimento

### 2. Modal de Confirmacao ao Clicar "Proximo" (Etapa 2 -> 3)

Quando houver itens NOK e o profissional clicar "Proximo", exibir um dialog com:

**Cenario A - Item CRITICO negativo:**
- Titulo: "Irregularidade Critica Detectada"
- Mensagem: lista dos itens criticos reprovados
- Opcoes:
  - **"Nao ha condicao - Encerrar"**: abre o modal de recusa direto (pula fotos/assinatura)
  - **"Revisar checklist"**: volta ao checklist

**Cenario B - Apenas itens CONDICIONAIS negativos:**
- Titulo: "Itens com Ressalva"
- Mensagem: lista dos itens condicionais reprovados
- Opcoes:
  - **"Ha condicao de continuar"**: avanca para fotos normalmente (decisao sera limitada a "Aprovado com Ressalva" ou "Negado")
  - **"Nao ha condicao - Encerrar"**: abre o modal de recusa direto
  - **"Revisar checklist"**: volta ao checklist

### 3. Atalho de Encerramento Rapido

Quando o profissional escolhe "Nao ha condicao", o sistema:
- Pula diretamente para o modal de recusa (ja existente: `ModalRecusaVeiculoComFotos`)
- Pre-preenche o motivo com os itens NOK
- Exige fotos de evidencia (ja obrigatorio na recusa)
- Status do servico vai para `em_analise` (fluxo existente)

### 4. Aplicar a Mesma Logica na Manutencao

Atualizar o `ChecklistManutencao` para suportar OK/NOK (em vez de apenas checkbox), com a mesma logica de triagem. Itens criticos para manutencao:
- Verificar conexao eletrica do rastreador
- Testar sinal GPS

Itens condicionais:
- LED de status
- Tensao da bateria
- Estado fisico
- Fixacao e posicionamento

## Arquivos a Modificar

1. **`src/pages/instalador/InstaladorChecklist.tsx`**
   - Adicionar campo `critico: boolean` nos arrays `CHECKLIST_ITEMS` e `CHECKLIST_ITEMS_MOTO`
   - Modificar a funcao `avancar()` para interceptar a transicao etapa 2->3 quando houver itens NOK
   - Adicionar estado e Dialog de confirmacao com as 3 opcoes
   - Adicionar logica de encerramento rapido que abre o modal de recusa pre-preenchido

2. **`src/components/instalador/ChecklistManutencao.tsx`**
   - Evoluir de checkbox simples para OK/NOK (usar o componente `ChecklistItem` ja existente)
   - Adicionar campo `critico` nos itens
   - Expor informacao de itens NOK via callback

3. **`src/pages/instalador/ExecutarManutencao.tsx`**
   - Adicionar modal de confirmacao antes de "Concluir Manutencao" quando houver itens NOK
   - Permitir encerramento rapido da manutencao

4. **Nenhuma migracao SQL necessaria** - toda a logica e frontend

## Cenarios Cobertos

| Cenario | Checklist | Acao |
|---|---|---|
| Tudo OK | Avanca normalmente | Decisao livre |
| Chassi diverge | Dialog critico | Encerrar ou revisar |
| Bateria fraca | Dialog condicional | Continuar com ressalva ou encerrar |
| Chassi + bateria | Dialog critico (prevalece) | Encerrar ou revisar |
| Manutencao: GPS sem sinal | Dialog critico | Encerrar ou continuar para substituicao |

