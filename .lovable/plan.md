## Objetivo

Permitir que o time de Cadastro edite dados sensíveis do associado (nome, CPF, RG, e-mail, telefones, WhatsApp, data de nascimento, endereço completo, dados de CNH) direto em **Cadastro › Associados › ⋮ › Editar dados**, exigindo **motivo** e registrando **autor, data/hora, valores antes/depois** no histórico do associado.

Hoje o item "Editar dados" só faz `navigate(...)` para a página de detalhes — não há edição com auditoria.

## Escopo da edição

Campos liberados no dialog (agrupados em abas para não virar formulário gigante):

- **Identificação** — nome, CPF, RG, data_nascimento, sexo, estado_civil, profissão
- **Contato** — email, telefone, telefone_secundario, whatsapp
- **Endereço** — cep, logradouro, número, complemento, bairro, cidade, uf
- **CNH** — cnh_numero, cnh_categoria, cnh_validade

Fora de escopo (continuam só em telas específicas): status, dia_vencimento, plano, coberturas, codigo_hinova, vendedor_original, flags de bloqueio/cancelamento. Foco é "corrigir dado cadastral", não mudar regra de negócio.

## UX do dialog

1. Aberto a partir do item "Editar dados" no `DropdownMenu` (linha 802–805 de `src/pages/cadastro/Associados.tsx`).
2. Carrega o associado atual e mostra os campos pré-preenchidos.
3. Campo obrigatório **Motivo da alteração** (textarea, mínimo 10 caracteres) no rodapé — sem ele o botão "Salvar" fica desabilitado.
4. Ao salvar:
   - Calcula o **diff** (só campos efetivamente alterados).
   - Se nada mudou → toast "Nenhuma alteração" e fecha.
   - Se mudou mas motivo vazio → erro inline.
5. Exibe banner de aviso: "Alterações em dados cadastrais serão registradas no histórico do associado".
6. Após salvar, toast de sucesso e invalida queries (`associados`, `associado-detalhes`, `associado-historico`).

## Backend / auditoria

Tudo via **edge function nova** `editar-dados-associado` (não fazer UPDATE direto do client — garante validação, diff atômico e log inseparável):

Entrada: `{ associado_id, campos: {...}, motivo }`.

Fluxo:
1. Autentica usuário (`SUPABASE_ANON_KEY` + JWT do header) e resolve `profile.id`.
2. Valida permissão: papel Cadastro, Coord. Cadastro, Diretoria ou Admin (igual aos botões de bloqueio).
3. Valida motivo (≥10 chars) e schema dos campos com zod (CPF 11 dígitos, e-mail válido, UF 2 letras, CEP 8 dígitos, telefones só dígitos).
4. SELECT do associado atual; monta diff `{antes, depois}` só com chaves alteradas.
5. Se `cpf` mudou → checar unicidade (`SELECT ... WHERE cpf=$1 AND id<>$2`) e retornar 409 se colidir.
6. UPDATE em `associados` apenas com as chaves do diff.
7. INSERT em `associados_historico`:
   ```
   tipo='edicao_dados_cadastrais',
   acao='editar_dados',
   descricao='Edição de dados cadastrais pelo Cadastro',
   dados_anteriores=<antes>,
   dados_novos=<depois>,
   motivo=<motivo>,
   executado_por=<profile.id>,
   usuario_id=<profile.id>,
   metadata={ ip, user_agent, campos_alterados:[...] }
   ```
8. Retorna `{ ok:true, alteracoes: [...] }`.

Sem migração de schema: `associados_historico` já tem `dados_anteriores`, `dados_novos`, `motivo`, `executado_por`, `metadata`.

## Render no histórico

A aba "Histórico" do associado já consome `associados_historico`. Garantir que entradas com `tipo='edicao_dados_cadastrais'` apareçam com:
- Título: "Dados cadastrais editados"
- Subtítulo: nome do autor + data/hora
- Corpo: lista "Campo X: `antes` → `depois`" + bloco com motivo
- Ícone diferenciado (PencilLine) e cor neutra (não destrutiva)

Se o renderizador atual não conhecer esse `tipo`, adicionar branch em `src/components/associados/HistoricoAssociado*.tsx` (a explorar na implementação).

## Arquivos a criar/editar

- **Criar** `supabase/functions/editar-dados-associado/index.ts`
- **Criar** `src/components/cadastro/EditarDadosAssociadoDialog.tsx`
- **Editar** `src/pages/cadastro/Associados.tsx` — substituir `onClick` do item "Editar dados" para abrir o dialog (passa `associado.id` + nome)
- **Editar** componente de histórico do associado para reconhecer `tipo='edicao_dados_cadastrais'` (a confirmar nome exato na implementação)

## Permissão

Reaproveitar a checagem usada por Bloquear/Suspender. Sem papel autorizado → item aparece desabilitado com tooltip "Sem permissão".

## Validações importantes

- CPF: 11 dígitos, sem máscara salva; comparar com `cpfValido()` se já existir helper no projeto.
- E-mail: zod `.email()`.
- Telefones/whatsapp: só dígitos (10–13).
- CEP: 8 dígitos.
- Data de nascimento: ≥ 18 anos e < 100 anos.
- CNH validade: data ≥ hoje (warning, não bloqueio).

## Fora de escopo desta entrega

- Edição de veículos, placas ou plano (têm fluxos próprios).
- Sincronização com Hinova/SGA dos campos alterados — fica como follow-up se necessário (registrar TODO no log do edge).
