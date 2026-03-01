

# Reagendamento pos-imprevisto com regras de rota e encaixe

## Problema Atual

Quando um imprevisto ocorre e o associado recebe o link de reagendamento (`/reagendar/:token`), a pagina publica atual:
- Nao valida vagas disponiveis por periodo (manha/tarde)
- Nao verifica disponibilidade de profissionais
- Nao oferece opcao de encaixe
- Cria o novo servico sem profissional atribuido (fica "solto" sem entrar na fila de rotas)
- Nao respeita limite de capacidade diaria dos profissionais

O servico reagendado fica com status `agendada` mas sem `profissional_id`, sem `rota_id`, e sem coordenadas -- ou seja, nao entra no sistema de rotas automaticamente.

## Solucao

### 1. Frontend: Validacao de vagas no `ReagendarVistoria.tsx`

Ao selecionar uma data no calendario, consultar vagas disponiveis por periodo (mesma logica do `useVagasPeriodo`). Desabilitar periodos sem vaga e mostrar indicador visual de disponibilidade.

Alteracoes:
- Importar e usar `useVagasPeriodo` para a data selecionada
- Desabilitar radio de periodo quando nao ha vagas
- Mostrar "X vagas disponiveis" ao lado de cada periodo
- Bloquear dias que ja estejam lotados em ambos os periodos (opcional, requer query adicional)

### 2. Frontend: Opcao de encaixe no `ReagendarVistoria.tsx`

Adicionar uma terceira opcao de periodo: "Primeiro horario disponivel (encaixe)" que marca o servico como `permite_encaixe = true`. Isso permite que o sistema atribua automaticamente ao vistoriador mais proximo.

### 3. Backend: Validacao e atribuicao no `reagendar-vistoria-publica` Edge Function

Atualizar a edge function para:
- Validar vagas disponiveis na data/periodo escolhidos (contar servicos existentes vs limite)
- Rejeitar se nao houver vagas
- Se encaixe marcado, setar `permite_encaixe = true` no novo servico
- Geocodificar endereco (chamar API de geocodificacao) para que o servico entre corretamente no sistema de rotas
- Copiar campos relevantes do servico original: `local_vistoria`, `tipo`, `rastreador_id`, `contrato_id` etc.

### 4. Backend: Garantir entrada na fila de rotas

O novo servico criado deve ter:
- `status: 'pendente'` (para entrar na fila de montagem de rotas) OU `status: 'agendada'` com encaixe habilitado
- Coordenadas de latitude/longitude (geocodificadas a partir do endereco)
- `permite_encaixe` quando solicitado
- Campos de endereco completos

Isso garante que quando o coordenador montar a proxima rota, o servico reagendado apareca na lista de servicos disponiveis para distribuicao.

## Arquivos a Modificar

### `src/pages/ReagendarVistoria.tsx`
- Adicionar consulta de vagas por periodo usando logica similar a `useVagasPeriodo`
- Mostrar disponibilidade visual nos radio buttons de periodo
- Adicionar opcao "Encaixe" com explicacao para o associado
- Desabilitar periodos sem vagas
- Enviar flag `permite_encaixe` para a edge function

### `supabase/functions/reagendar-vistoria-publica/index.ts`
- Validar vagas antes de criar o servico (contar servicos existentes na data/periodo)
- Copiar campos adicionais do servico original (`rastreador_id`, `contrato_id`, `local_vistoria`)
- Setar `permite_encaixe` quando solicitado
- Geocodificar endereco usando API ViaCEP + Nominatim para obter lat/lng
- Retornar erro claro se nao houver vagas

## Fluxo Revisado

```text
Imprevisto confirmado (duplo check)
        |
Link enviado via WhatsApp
        |
Associado abre /reagendar/:token
        |
Seleciona data -> sistema mostra vagas por periodo
        |
Seleciona periodo (manha/tarde/encaixe)
        |
Preenche/confirma endereco
        |
Edge function valida vagas + cria servico
        |
Servico entra na fila de rotas com coordenadas
        |
Coordenador inclui na proxima rota OU encaixe automatico
```

## Resultado Esperado

O reagendamento feito pelo associado respeitara as mesmas regras do sistema: vagas limitadas por periodo, possibilidade de encaixe urgente, e o servico entrara automaticamente na fila de rotas com endereco geocodificado.
