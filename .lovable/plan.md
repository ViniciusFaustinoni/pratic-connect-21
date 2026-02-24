

# Adicionar Templates Meta para Mensagens de Reboque

## Resumo

Atualmente, as mensagens de WhatsApp enviadas durante o fluxo de despacho de reboque (para o reboquista e para o associado) sao enviadas como texto livre via `whatsapp-send-text`. Quando o provedor ativo for a API Oficial da Meta, essas mensagens proativas **exigem templates aprovados**. Precisamos criar os templates Meta correspondentes e atualizar as edge functions para enviar via template quando o provedor for Meta.

---

## Templates a Criar

### Para o Prestador/Reboquista

| Nome | Categoria | Corpo | Variaveis |
|------|-----------|-------|-----------|
| `despacho_reboque_novo` | UTILITY | Novo chamado de reboque -- PraticCar. Veiculo: {{1}} -- {{2}}. Local: {{3}}. Aberto: {{4}}. Toque para ver detalhes e aceitar: {{5}}. Voce tem 10 minutos para responder. | 1=marca/modelo, 2=placa, 3=endereco, 4=data/hora, 5=link |

### Para o Associado (Acompanhamento)

| Nome | Categoria | Corpo | Variaveis |
|------|-----------|-------|-----------|
| `reboque_a_caminho` | UTILITY | Reboque a caminho -- Pratic Car. Seu reboque foi acionado e esta a caminho! Prestador: {{1}}. Distancia: {{2}}. Estimativa: {{3}}. Acompanhe em tempo real: {{4}}. Ligar para o reboquista: {{5}}. Este link e valido por 2 horas. | 1=nome prestador, 2=distancia, 3=tempo, 4=link, 5=telefone |
| `reboque_chegou_local` | UTILITY | Reboquista chegou! -- Pratic Car. O reboquista {{1}} chegou ao local do seu veiculo. Acompanhe: {{2}} | 1=nome, 2=link |
| `reboque_veiculo_carregado` | UTILITY | Veiculo no guincho -- Pratic Car. Seu veiculo foi carregado e esta sendo levado para: {{1}}. Acompanhe: {{2}} | 1=destino, 2=link |
| `reboque_entregue` | UTILITY | Veiculo entregue -- Pratic Car. Seu veiculo foi entregue em: {{1}}. Horario: {{2}}. Obrigado por usar a Pratic Car! | 1=destino, 2=horario |

---

## Alteracoes

### 1. Migracao SQL

Inserir os 5 novos templates como rascunho (status='DRAFT') na tabela `whatsapp_meta_templates`, com as variaveis de exemplo preenchidas. Serao adicionados aos 8 templates existentes.

### 2. Edge Functions

Atualizar as 3 edge functions para incluir `template_name` e `template_params` ao chamar `whatsapp-send-text`. O roteamento transparente ja existente no `whatsapp-send-text` usara esses campos quando o provedor ativo for Meta:

**`despacho-reboque-disparar`**: Ao enviar WhatsApp para os reboquistas, incluir `template_name: "despacho_reboque_novo"` e `template_params` com os valores das variaveis.

**`despacho-reboque-atribuir`**: Ao enviar WhatsApp ao associado, incluir `template_name: "reboque_a_caminho"` e `template_params`.

**`despacho-reboque-status`**: Para cada status mapeado, incluir o `template_name` correspondente:
- `chegou_local` -> `reboque_chegou_local`
- `veiculo_carregado` -> `reboque_veiculo_carregado`
- `concluido` -> `reboque_entregue`

### 3. Nenhuma alteracao no `whatsapp-send-text`

A logica de roteamento ja suporta os campos `template_name` e `template_params`. Quando o provedor e Evolution, esses campos sao ignorados e a mensagem e enviada como texto livre. Quando e Meta, usa o template.

---

## Arquivos Afetados

| Arquivo | Acao |
|---------|------|
| Nova migracao SQL | INSERT dos 5 novos templates em `whatsapp_meta_templates` |
| `supabase/functions/despacho-reboque-disparar/index.ts` | Adicionar template_name + template_params na chamada whatsapp-send-text |
| `supabase/functions/despacho-reboque-atribuir/index.ts` | Adicionar template_name + template_params na chamada whatsapp-send-text |
| `supabase/functions/despacho-reboque-status/index.ts` | Adicionar template_name + template_params para cada status |

## Sem alteracoes em

- `whatsapp-send-text` (ja suporta template_name/template_params)
- Componentes frontend (templates aparecem automaticamente na tabela de templates Meta)
- Tabela `whatsapp_templates` (templates internos do Evolution, separados)

