
# Termo de Saida de Veiculo - Conclusao de OS

## Resumo

Criar um novo fluxo de assinatura digital "Termo de Saida de Veiculo", acionado quando uma Ordem de Servico (OS) e marcada como "concluido". O termo sera enviado para assinatura via Autentique, o associado recebera uma mensagem no WhatsApp informando que o veiculo esta pronto, e o modal da OS exibira o link de assinatura com atualizacao em tempo real.

---

## Arquitetura do Fluxo

```text
OS marcada como "concluido" (OSStatusDialog ou botao dedicado)
        |
        v
1. WhatsApp: Envia mensagem ao associado ("Veiculo pronto!")
2. Edge Function: autentique-os-saida-create
   - Busca template do tipo "termo_saida_veiculo"
   - Substitui variaveis (OS, oficina, associado, veiculo, sinistro)
   - Envia HTML para Autentique API
   - Salva autentique_documento_id e autentique_url na tabela ordens_servico
        |
        v
Modal de Conclusao de OS
  - Exibe dados de contato do associado (telefone, whatsapp, email)
  - Botao "Enviar para Assinatura" -> chama a edge function
  - Exibe link de assinatura (copiar / WhatsApp)
  - Polling automatico detecta assinatura e atualiza a tela
  - Quando assinado: badge verde "Veiculo Liberado"
        |
        v
Webhook Autentique (autentique-webhook)
  - Fallback: busca em ordens_servico.autentique_documento_id
  - Atualiza termo_saida_assinado = true, salva PDF
```

---

## Alteracoes Necessarias

### 1. Banco de Dados

**Adicionar colunas na tabela `ordens_servico`:**
- `autentique_documento_id` (text, nullable)
- `autentique_url` (text, nullable)
- `termo_saida_assinado` (boolean, default false)
- `termo_saida_assinado_em` (timestamptz, nullable)
- `termo_saida_url` (text, nullable) - URL do PDF assinado

**Inserir novo `document_type`:**
- `code: 'termo_saida_veiculo'`, `name: 'Termo de Saida de Veiculo'`

### 2. Nova Edge Function: `autentique-os-saida-create`

Recebe `ordem_servico_id` como parametro:
- Busca OS com associado, veiculo, oficina e sinistro vinculado
- Busca template is_default do tipo `termo_saida_veiculo`
- Cria mapeamento de variaveis especificas da OS:
  - `os.numero`, `os.data_entrada`, `os.data_conclusao`, `os.valor_orcamento`, `os.valor_aprovado`
  - `oficina.nome`, `oficina.cnpj`, `oficina.endereco`, `oficina.telefone`
  - Variaveis de associado, veiculo, evento (se vinculado) e empresa
- Gera HTML com layout padrao (generateStyles, generateHeader adaptado)
- Envia para Autentique, salva IDs na tabela ordens_servico

### 3. Atualizar `autentique-webhook`

Adicionar terceiro fallback apos sinistros:
- Buscar em `ordens_servico.autentique_documento_id`
- Se encontrar OS e evento for `signature.accepted`:
  - Atualizar `termo_saida_assinado = true`, `termo_saida_assinado_em`, `termo_saida_url`
  - Registrar em `ordens_servico_historico`

### 4. Novo Componente: `OSConclusaoModal`

Modal dedicado para a conclusao da OS, exibido quando o status muda para "concluido":

- **Dados do associado**: nome, telefone, whatsapp, email (com botoes de acao)
- **Botao "Enviar para Assinatura"**: chama `autentique-os-saida-create`
- **Link de assinatura**: exibido apos envio, com botao copiar e botao WhatsApp
- **Status em tempo real**: polling a cada 15s via `useAutentiqueStatus`
- **Badge "Veiculo Liberado"**: quando `termo_saida_assinado = true`

### 5. Integrar na pagina `OrdemServicoDetalhe.tsx`

- Adicionar botao/opcao "Concluir OS" no dropdown de acoes (quando status permite)
- Ao clicar, abre o `OSConclusaoModal`
- O modal:
  1. Atualiza status para "concluido"
  2. Envia WhatsApp ao associado (veiculo pronto)
  3. Permite enviar termo para assinatura
- Card de assinatura visivel na pagina de detalhe quando `autentique_url` existir

### 6. Envio de WhatsApp na conclusao

Quando a OS e marcada como concluida, enviar mensagem via `whatsapp-send-text`:
- Mensagem: "Ola [nome]! Seu veiculo [marca modelo] placa [placa] esta pronto! O reparo na oficina [oficina] foi concluido. Voce recebera um termo de saida para assinatura. Duvidas? Entre em contato."

### 7. Variaveis do VariaveisSelector

Adicionar novo grupo "evento" com as variaveis ja existentes no backend e novo grupo "os" (Ordem de Servico):
- `os.numero`, `os.data_entrada`, `os.data_conclusao`, `os.valor_orcamento`, `os.valor_aprovado`, `os.observacoes`
- `oficina.nome`, `oficina.cnpj`, `oficina.telefone`, `oficina.endereco`

### 8. Template de variaveis da OS em `template-utils.ts`

Adicionar funcao de mapeamento para variaveis de OS/oficina que a nova edge function usara.

---

## Arquivos Modificados/Criados

| Arquivo | Acao |
|---|---|
| Migration SQL | Colunas em ordens_servico + novo document_type |
| `supabase/functions/autentique-os-saida-create/index.ts` | NOVO |
| `supabase/functions/autentique-webhook/index.ts` | Fallback para ordens_servico |
| `src/components/oficinas/OSConclusaoModal.tsx` | NOVO - Modal de conclusao |
| `src/pages/oficina/OrdemServicoDetalhe.tsx` | Integrar modal + card assinatura |
| `src/hooks/useOrdensServico.ts` | Incluir campos autentique no select |
| `src/components/documentos/VariaveisSelector.tsx` | Grupos evento e os |
| `supabase/functions/_shared/template-utils.ts` | Variaveis OS/oficina |
| `supabase/config.toml` | Registrar nova edge function |

---

## Detalhes Tecnicos

### Novas variaveis para templates de OS:
```text
os.numero
os.data_entrada
os.data_conclusao
os.data_previsao
os.valor_orcamento
os.valor_aprovado
os.observacoes
oficina.nome
oficina.cnpj
oficina.telefone
oficina.whatsapp
oficina.endereco
```

### Mensagem WhatsApp na conclusao:
```text
Ola {{associado.nome}}!

Seu veiculo *{{veiculo.marca}} {{veiculo.modelo}}* placa *{{veiculo.placa}}* esta pronto!

O reparo na oficina *{{oficina.nome}}* foi concluido com sucesso.

Voce recebera um Termo de Saida de Veiculo no seu email para assinatura digital.

Em caso de duvidas, entre em contato conosco.

ABP PraticCar
```

### OSConclusaoModal - Comportamento:
1. Ao abrir: mostra dados do associado (contato) + resumo da OS
2. Botao "Concluir e Notificar": muda status para concluido + envia WhatsApp
3. Botao "Enviar Termo para Assinatura": chama edge function
4. Apos envio: exibe link com polling automatico
5. Quando assinado: mostra badge verde "Veiculo Liberado" + link PDF

### Webhook - Terceiro fallback:
```text
1. Buscar em contratos.autentique_documento_id
2. Se nao encontrar -> buscar em sinistros.autentique_documento_id
3. Se nao encontrar -> buscar em ordens_servico.autentique_documento_id
4. Se encontrar OS: atualizar termo_saida_assinado, salvar PDF
```
