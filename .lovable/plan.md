

## Diagnóstico — Por que staff não vê fotos da vistoria do instalador

### Causa raiz (confirmada em banco)

A tabela **`vistoria_fotos`** só tem policies de SELECT para:
- **Associado dono** (`get_my_associado_id(auth.uid())`)
- **Anon via link público de contrato** (`contratos.link_token`)

**Não existe** policy SELECT para staff autenticado (diretor, analista_cadastro, admin_master etc.). Quando o hook `useFotosVistoriaUnificada` faz `SELECT ... FROM vistoria_fotos WHERE vistoria_id = ?` para um funcionário, RLS retorna zero linhas → condição `(vistoriaUnificada?.fotosInstalador?.length || 0) > 0` é falsa → **Card "Galeria do Instalador" nem renderiza**.

Por isso a screenshot mostra apenas **Galeria de Autovistoria** (tabela `cotacoes_vistoria_fotos`, que tem policy `Usuários autenticados acesso total`) e nenhuma Galeria do Instalador.

Comparação das duas tabelas:

| Tabela | Policy staff autenticado | Resultado |
|---|---|---|
| `cotacoes_vistoria_fotos` | ✅ "Usuários autenticados acesso total" | Aparece |
| `vistoria_fotos` | ❌ Nenhuma | **Invisível para staff** |

Obs.: a tabela-pai `vistorias` **já tem** a policy `Staff and own vistoriadores can view vistorias` listando diretor/admin_master/analista_cadastro/coordenador_monitoramento/etc. A policy filha de `vistoria_fotos` foi esquecida quando a tabela foi criada.

Documentos em si (`documentos`) **funcionam** — policy `View documents` cobre `is_funcionario(auth.uid())`. Se o usuário também está sem ver documentos, é outra questão (provavelmente nenhum documento cadastrado para aquele associado específico). A queixa central é fotos.

### Correção

Adicionar **uma policy RLS** em `public.vistoria_fotos` espelhando a policy já existente em `vistorias`:

```sql
CREATE POLICY "Staff can view vistoria_fotos"
ON public.vistoria_fotos
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'coordenador_monitoramento'::app_role)
  OR has_role(auth.uid(), 'diretor'::app_role)
  OR has_role(auth.uid(), 'admin_master'::app_role)
  OR has_role(auth.uid(), 'desenvolvedor'::app_role)
  OR has_role(auth.uid(), 'analista_cadastro'::app_role)
  OR has_role(auth.uid(), 'analista_eventos'::app_role)
  OR (
    has_role(auth.uid(), 'instalador_vistoriador'::app_role)
    AND vistoria_id IN (
      SELECT v.id FROM public.vistorias v
      WHERE v.vistoriador_id = get_my_profile_id()
    )
  )
);
```

A policy existente `Associates can view own inspection photos` continua intacta para o associado dono, e `Public can view inspection photos via contract` continua intacta para o fluxo público de contrato. Sem mudanças em UI, hooks ou buckets de storage (os buckets `vistoria-fotos` e `documentos` já são públicos, então as URLs das imagens abrem sem problema — o bloqueio é puramente na leitura das linhas da tabela).

### Validação após deploy

1. Logar como diretor (`admin@teste.com`) → `/cadastro/associados` → abrir um associado que tenha contrato com instalação concluída (ex.: `associado_id = 1acbb2e9-e170-46d5-aabc-da8c0bd0af05`, contrato `84553445-...`, 6 fotos).
2. Aba **Documentos** → Card "**Galeria do Instalador**" deve aparecer com as 6 fotos agrupadas (exterior, identificação, interior).
3. Clicar em uma foto → modal abre com imagem em tamanho grande.
4. Logar como `analista_cadastro` → mesma tela → mesmas fotos visíveis.
5. Repetir com um associado que tenha só autovistoria (`cotacoes_vistoria_fotos`) → continua aparecendo apenas "Galeria de Autovistoria" (comportamento correto).
6. Testar que o fluxo público anon de contrato (`/contrato/:token`) continua vendo as fotos — policy antiga preservada.

### Arquivo tocado

- **Nova migração SQL** — adiciona policy `Staff can view vistoria_fotos` em `public.vistoria_fotos`.

Sem mudança de frontend, hook, bucket, nem schema. Nenhuma policy existente é alterada ou removida.

