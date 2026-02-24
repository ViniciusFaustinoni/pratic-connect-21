

# Importacao em Massa de Prestadores de Assistencia via JSON

## Resumo

Criar uma Edge Function `import-prestadores` que recebe um array JSON de prestadores e insere tanto na tabela principal (`prestadores_assistencia`) quanto na tabela de valores (`prestadores_assistencia_valores`), respeitando todas as regras de negocio existentes. Criar tambem um dialog no frontend (similar ao ImportarOficinasDialog) para upload/preview/importacao.

---

## Por que Edge Function?

- Os dados envolvem insert em 2 tabelas com relacionamento (prestador + valores)
- Precisa de transacao logica: se o prestador for criado, os valores devem ser inseridos logo em seguida
- Validacao server-side garante integridade dos dados
- Permissao verificada via token JWT (apenas diretores/gerentes)

---

## 1. Estrutura do JSON Esperado

Cada item do array deve seguir este formato:

```text
{
  "prestadores": [
    {
      // Dados obrigatorios
      "razao_social": "PRESTADOR EXEMPLO LTDA",
      "telefone": "(21) 99999-9999",
      "cidade": "RIO DE JANEIRO",
      "estado": "RJ",
      "tipos_servico": ["reboque", "bateria"],

      // Dados opcionais
      "nome_fantasia": "PRESTADOR EXEMPLO",
      "tipo_pessoa": "pj",
      "cnpj": "00.000.000/0001-00",
      "cpf": null,
      "whatsapp": "(21) 99999-9999",
      "telefone_extra": "(21) 88888-8888",
      "email": "contato@exemplo.com",
      "cep": "20000-000",
      "logradouro": "RUA X",
      "numero": "123",
      "bairro": "CENTRO",
      "raio_atendimento_km": 50,
      "tipos_reboque": ["leve", "utilitario"],
      "banco": "Bradesco",
      "agencia": "1234",
      "conta": "56789-0",
      "pix_tipo": "cnpj",
      "pix_chave": "00000000000100",

      // Valores por servico (opcional)
      "valores": [
        {
          "tipo_servico": "reboque",
          "tipo_reboque": "leve",
          "valor_saida": 150.00,
          "valor_km": 4.50,
          "km_franquia": 10,
          "hr_trabalhada": 80,
          "hr_parada": 40,
          "diaria_base": 200
        },
        {
          "tipo_servico": "bateria",
          "tipo_reboque": null,
          "valor_saida": 80.00,
          "valor_km": 3.00
        }
      ]
    }
  ]
}
```

---

## 2. Edge Function: `import-prestadores`

**Arquivo:** `supabase/functions/import-prestadores/index.ts`

Logica:
1. Verificar autenticacao JWT
2. Verificar role do usuario (diretor, gerente_comercial, supervisor_vendas)
3. Para cada prestador no array:
   - Validar campos obrigatorios (razao_social, telefone, cidade, estado, tipos_servico)
   - Validar tipos_servico contra lista permitida: `reboque, pane_seca, socorro_mecanico, socorro_eletrico, troca_pneu, chaveiro, bateria, taxi, hospedagem, outro`
   - Validar tipos_reboque (se tiver "reboque" nos tipos_servico): `leve, utilitario, pesado`
   - INSERT em `prestadores_assistencia` com `status='ativo'` e `disponivel=true`
   - Se houver array `valores`, INSERT em `prestadores_assistencia_valores` vinculando ao prestador_id recem-criado
   - Respeitar constraint UNIQUE `(prestador_id, tipo_servico, tipo_reboque)`
4. Retornar resumo: total, sucesso, erros, detalhes por linha

**Seguranca:**
- Usa `SUPABASE_SERVICE_ROLE_KEY` para inserts (bypassa RLS)
- Valida JWT do usuario chamador
- Verifica permissao via `user_roles`

---

## 3. Frontend: Dialog de Importacao

**Arquivos novos:**
- `src/lib/parsePrestador.ts` - funcoes de validacao e parsing
- `src/hooks/useImportPrestadores.ts` - hook que chama a Edge Function
- `src/components/assistencia/ImportarPrestadoresDialog.tsx` - dialog com 4 etapas (upload, preview, importing, result)

**Fluxo do dialog (mesmo padrao do ImportarOficinasDialog):**

```text
[Upload JSON] --> [Preview com validacao] --> [Importando...] --> [Resultado]
```

### parsePrestador.ts
- Validar campos obrigatorios
- Validar tipos_servico e tipos_reboque
- Verificar consistencia: se tem "reboque" nos tipos_servico, tipos_reboque nao pode estar vazio
- Verificar valores: tipo_servico do valor deve estar nos tipos_servico do prestador

### useImportPrestadores.ts
- Chama `supabase.functions.invoke('import-prestadores', { body: { prestadores } })`
- Retorna o resumo de importacao

### ImportarPrestadoresDialog.tsx
- Aceita `.json` no upload (alem de `.xlsx` e `.csv`)
- Para JSON: faz parse direto
- Para Excel/CSV: mapeia colunas para o formato esperado
- Preview mostra tabela com status de validacao
- Botao "Importar X prestador(es)"
- Tela de resultado com sucesso/erros

---

## 4. Integracao na Pagina de Prestadores

**Arquivo:** `src/pages/assistencia/PrestadoresList.tsx`

- Adicionar botao "Importar" ao lado do botao "Novo Prestador"
- Abrir o `ImportarPrestadoresDialog`
- Ao concluir, invalidar query `['prestadores']`

---

## 5. Config da Edge Function

**Arquivo:** `supabase/config.toml`

Adicionar:
```text
[functions.import-prestadores]
verify_jwt = false
```

(Validacao de JWT sera feita manualmente no codigo, como ja e feito em `import-users`)

---

## Arquivos Criados/Modificados

| Arquivo | Tipo |
|---|---|
| `supabase/functions/import-prestadores/index.ts` | Novo |
| `supabase/config.toml` | Modificado (adicionar config) |
| `src/lib/parsePrestador.ts` | Novo |
| `src/hooks/useImportPrestadores.ts` | Novo |
| `src/components/assistencia/ImportarPrestadoresDialog.tsx` | Novo |
| `src/pages/assistencia/PrestadoresList.tsx` | Modificado (botao importar) |

## O que NAO sera alterado

- Nenhuma tabela do banco (ja tem todas as colunas necessarias)
- Nenhum componente existente alem do PrestadoresList
- Nenhuma logica de cadastro/edicao manual existente
- RLS policies permanecem inalteradas

