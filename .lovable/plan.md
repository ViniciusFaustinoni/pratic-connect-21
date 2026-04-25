## Objetivo

Na etapa pública **Documentos e Dados** (`/cotacao/:token` → "Documentos e Dados"), garantir que se o OCR falhar em ler **qualquer** campo, o associado consiga preencher manualmente sem travar o processo. O preenchimento manual **não aparece de cara** — só surge como fallback.

## Situação atual

Já existem fallbacks parciais em `EtapaDadosPessoaisDocumentos.tsx`:
- Correção manual do **CPF** (aparece automaticamente quando OCR retorna `ilegivel` ou CPF inválido).
- Botão **Reprocessar OCR** para CRLV/NF/ATPV-e e Comprovante.
- Busca de endereço por **CEP** quando o comprovante vem incompleto.

Faltam fallbacks manuais para os demais campos extraídos: nome, RG, data de nascimento, CNH (registro/validade/categoria), placa, chassi, renavam, cor, combustível, nº motor, ano fab/modelo, e endereço completo (logradouro, número, bairro, cidade, UF).

## Comportamento desejado

1. **Reprocessar OCR primeiro** (já existe) — continua sendo o caminho principal.
2. Se após o reprocessamento ainda faltar algum campo (ou se o usuário insistir), exibir um **link discreto** abaixo de cada bloco de checklist:
   > *"Não consegui ler tudo? Preencher manualmente"*
3. Ao clicar, **expande inline** um mini-formulário com apenas os campos faltantes (não os já lidos), pré-preenchidos com o que o OCR conseguiu capturar.
4. O usuário pode editar/preencher e salvar; os valores entram em `dadosExtraidos` como se viessem do OCR, liberando o `podeAvancar`.
5. Validações: placa (formato Mercosul/antigo), chassi (17 caracteres), CEP (8 dígitos), datas válidas, ano entre 1950 e ano atual+1.
6. Estado visual: campos preenchidos manualmente recebem badge **"Preenchido manualmente"** (cor âmbar) para distinguir do que foi lido por IA.

## Onde aparece o link de fallback

Três blocos do checklist em `EtapaDadosPessoaisDocumentos.tsx`:

```text
[ ✓ ] CNH, RG ou CIN
       Nome: ... | CPF: ... | RG: ...
       └─ "Preencher dados pessoais manualmente" (link discreto)

[ ✓ ] CRLV, Nota Fiscal ou ATPV-e
       Placa: ... | Chassi: ... | Renavam: ...
       └─ "Preencher dados do veículo manualmente" (link discreto)

[ ✓ ] Comprovante de Residência
       Endereço: ...
       └─ "Preencher endereço manualmente" (link discreto)
```

O link só aparece quando **o respectivo documento já foi enviado** (evita poluir UI antes do upload). Se o documento ainda não foi enviado, mostra o link só após X segundos OU após 1 tentativa fracassada de OCR.

## Implementação técnica

**Arquivo único alterado:** `src/components/cotacao-publica/EtapaDadosPessoaisDocumentos.tsx`

1. Adicionar 3 estados booleanos: `mostrarManualPessoal`, `mostrarManualVeiculo`, `mostrarManualEndereco` (default `false`).
2. Adicionar `Set<string>` `camposManuais` para rastrear quais campos foram preenchidos à mão (para badge).
3. Criar 3 sub-componentes inline (ou blocos JSX) que renderizam:
   - **Pessoal**: inputs para `nome`, `cpf` (já existe), `rg`, `rg_orgao`, `data_nascimento`, `cnh`, `cnh_validade`, `cnh_categoria`.
   - **Veículo**: inputs para `veiculo_placa`, `veiculo_chassi`, `veiculo_renavam`, `veiculo_cor`, `veiculo_combustivel` (select), `numero_motor`, `veiculo_ano_fabricacao`, `veiculo_ano_modelo`.
   - **Endereço**: inputs para `cep`, `logradouro`, `numero`, `complemento`, `bairro`, `cidade`, `uf` (select 27 estados).
4. Cada input atualiza `dadosExtraidos` via `setDadosExtraidos(prev => ({...prev, campo: valor}))` e marca o campo em `camposManuais`.
5. Validações reutilizando: `validateCPF` (já importado), regex de placa, regex de chassi (17 alfanuméricos exceto I/O/Q), `viacep` para auto-completar quando o usuário digita o CEP manual.
6. Ajustar `podeAvancar` para considerar dados preenchidos manualmente (já considera, pois lê de `dadosExtraidos`).
7. Adicionar badge âmbar **"Preenchido manualmente"** ao lado dos campos em `camposManuais` no resumo do checklist.

## O que NÃO muda

- Backend, edge functions, schemas e tabelas — nada precisa mudar. O fluxo `onSubmit(dados)` já envia tudo de `dadosExtraidos`, então o preenchimento manual é transparente para o restante do sistema.
- Comportamento atual do OCR e dos botões de reprocessar.
- Validação de CPF (já tem fallback manual completo).

## Critério de aceitação

- Em uma cotação pública nova, sem upload nenhum, **não aparece nenhum input manual** nos blocos.
- Após enviar CNH com OCR falho (ex: foto ruim), aparece o link "Preencher dados pessoais manualmente".
- Ao clicar, expandem campos editáveis, e ao salvar a etapa libera o **Avançar**.
- Mesmo comportamento para CRLV e Comprovante.
- Os dados preenchidos manualmente persistem ao avançar e voltar entre etapas.
