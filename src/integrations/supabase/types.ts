export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      acionamentos_roubo_furto: {
        Row: {
          api_request: Json | null
          api_response: Json | null
          api_status_code: number | null
          associado_id: string | null
          autorizado_em: string | null
          autorizado_por: string | null
          autorizado_por_nome: string | null
          chamado_assistencia_id: string | null
          created_at: string | null
          encerrado_em: string | null
          encerrado_por: string | null
          erro_mensagem: string | null
          id: string
          motivo_encerramento: string | null
          observacoes: string | null
          plataforma: string | null
          protocolo_externo: string | null
          rastreador_id: string | null
          sinistro_id: string | null
          solicitado_em: string | null
          solicitado_por: string | null
          solicitado_por_nome: string | null
          status: string | null
          tipo_origem: string
          ultima_posicao_data: string | null
          ultima_posicao_lat: number | null
          ultima_posicao_lng: number | null
          updated_at: string | null
          veiculo_id: string
        }
        Insert: {
          api_request?: Json | null
          api_response?: Json | null
          api_status_code?: number | null
          associado_id?: string | null
          autorizado_em?: string | null
          autorizado_por?: string | null
          autorizado_por_nome?: string | null
          chamado_assistencia_id?: string | null
          created_at?: string | null
          encerrado_em?: string | null
          encerrado_por?: string | null
          erro_mensagem?: string | null
          id?: string
          motivo_encerramento?: string | null
          observacoes?: string | null
          plataforma?: string | null
          protocolo_externo?: string | null
          rastreador_id?: string | null
          sinistro_id?: string | null
          solicitado_em?: string | null
          solicitado_por?: string | null
          solicitado_por_nome?: string | null
          status?: string | null
          tipo_origem: string
          ultima_posicao_data?: string | null
          ultima_posicao_lat?: number | null
          ultima_posicao_lng?: number | null
          updated_at?: string | null
          veiculo_id: string
        }
        Update: {
          api_request?: Json | null
          api_response?: Json | null
          api_status_code?: number | null
          associado_id?: string | null
          autorizado_em?: string | null
          autorizado_por?: string | null
          autorizado_por_nome?: string | null
          chamado_assistencia_id?: string | null
          created_at?: string | null
          encerrado_em?: string | null
          encerrado_por?: string | null
          erro_mensagem?: string | null
          id?: string
          motivo_encerramento?: string | null
          observacoes?: string | null
          plataforma?: string | null
          protocolo_externo?: string | null
          rastreador_id?: string | null
          sinistro_id?: string | null
          solicitado_em?: string | null
          solicitado_por?: string | null
          solicitado_por_nome?: string | null
          status?: string | null
          tipo_origem?: string
          ultima_posicao_data?: string | null
          ultima_posicao_lat?: number | null
          ultima_posicao_lng?: number | null
          updated_at?: string | null
          veiculo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "acionamentos_roubo_furto_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "associados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acionamentos_roubo_furto_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "acionamentos_roubo_furto_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "acionamentos_roubo_furto_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associado_financeiro"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "acionamentos_roubo_furto_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associados_publico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acionamentos_roubo_furto_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_inadimplentes"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "acionamentos_roubo_furto_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "acionamentos_roubo_furto_autorizado_por_fkey"
            columns: ["autorizado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acionamentos_roubo_furto_autorizado_por_fkey"
            columns: ["autorizado_por"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "acionamentos_roubo_furto_autorizado_por_fkey"
            columns: ["autorizado_por"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "acionamentos_roubo_furto_chamado_assistencia_id_fkey"
            columns: ["chamado_assistencia_id"]
            isOneToOne: false
            referencedRelation: "chamados_assistencia"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acionamentos_roubo_furto_encerrado_por_fkey"
            columns: ["encerrado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acionamentos_roubo_furto_encerrado_por_fkey"
            columns: ["encerrado_por"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "acionamentos_roubo_furto_encerrado_por_fkey"
            columns: ["encerrado_por"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "acionamentos_roubo_furto_rastreador_id_fkey"
            columns: ["rastreador_id"]
            isOneToOne: false
            referencedRelation: "rastreadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acionamentos_roubo_furto_rastreador_id_fkey"
            columns: ["rastreador_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["rastreador_id"]
          },
          {
            foreignKeyName: "acionamentos_roubo_furto_sinistro_id_fkey"
            columns: ["sinistro_id"]
            isOneToOne: false
            referencedRelation: "sinistros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acionamentos_roubo_furto_solicitado_por_fkey"
            columns: ["solicitado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acionamentos_roubo_furto_solicitado_por_fkey"
            columns: ["solicitado_por"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "acionamentos_roubo_furto_solicitado_por_fkey"
            columns: ["solicitado_por"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "acionamentos_roubo_furto_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acionamentos_roubo_furto_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["veiculo_id"]
          },
          {
            foreignKeyName: "acionamentos_roubo_furto_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["veiculo_id"]
          },
          {
            foreignKeyName: "acionamentos_roubo_furto_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["veiculo_id"]
          },
          {
            foreignKeyName: "acionamentos_roubo_furto_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "vw_veiculos_com_cotas"
            referencedColumns: ["id"]
          },
        ]
      }
      acionamentos_roubo_furto_historico: {
        Row: {
          acionamento_id: string
          created_at: string | null
          dados_extras: Json | null
          id: string
          observacao: string | null
          status_anterior: string | null
          status_novo: string
          usuario_id: string | null
          usuario_nome: string | null
        }
        Insert: {
          acionamento_id: string
          created_at?: string | null
          dados_extras?: Json | null
          id?: string
          observacao?: string | null
          status_anterior?: string | null
          status_novo: string
          usuario_id?: string | null
          usuario_nome?: string | null
        }
        Update: {
          acionamento_id?: string
          created_at?: string | null
          dados_extras?: Json | null
          id?: string
          observacao?: string | null
          status_anterior?: string | null
          status_novo?: string
          usuario_id?: string | null
          usuario_nome?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "acionamentos_roubo_furto_historico_acionamento_id_fkey"
            columns: ["acionamento_id"]
            isOneToOne: false
            referencedRelation: "acionamentos_roubo_furto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acionamentos_roubo_furto_historico_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acionamentos_roubo_furto_historico_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "acionamentos_roubo_furto_historico_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
        ]
      }
      acompanhamento_reboque_tokens: {
        Row: {
          associado_id: string
          chamado_id: string
          created_at: string
          expira_em: string
          id: string
          token: string
        }
        Insert: {
          associado_id: string
          chamado_id: string
          created_at?: string
          expira_em: string
          id?: string
          token: string
        }
        Update: {
          associado_id?: string
          chamado_id?: string
          created_at?: string
          expira_em?: string
          id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "acompanhamento_reboque_tokens_chamado_id_fkey"
            columns: ["chamado_id"]
            isOneToOne: false
            referencedRelation: "chamados_assistencia"
            referencedColumns: ["id"]
          },
        ]
      }
      acordo_parcelas: {
        Row: {
          acordo_id: string
          cobranca_id: string | null
          created_at: string | null
          data_pagamento: string | null
          data_vencimento: string
          id: string
          numero_parcela: number
          status: string | null
          valor: number
          valor_pago: number | null
        }
        Insert: {
          acordo_id: string
          cobranca_id?: string | null
          created_at?: string | null
          data_pagamento?: string | null
          data_vencimento: string
          id?: string
          numero_parcela: number
          status?: string | null
          valor: number
          valor_pago?: number | null
        }
        Update: {
          acordo_id?: string
          cobranca_id?: string | null
          created_at?: string | null
          data_pagamento?: string | null
          data_vencimento?: string
          id?: string
          numero_parcela?: number
          status?: string | null
          valor?: number
          valor_pago?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "acordo_parcelas_acordo_id_fkey"
            columns: ["acordo_id"]
            isOneToOne: false
            referencedRelation: "acordos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acordo_parcelas_cobranca_id_fkey"
            columns: ["cobranca_id"]
            isOneToOne: false
            referencedRelation: "cobrancas"
            referencedColumns: ["id"]
          },
        ]
      }
      acordos: {
        Row: {
          aprovado_em: string | null
          aprovado_por: string | null
          associado_id: string
          cobrancas_ids: string[]
          created_at: string | null
          criado_por: string | null
          dia_vencimento: number
          entrada_data_pagamento: string | null
          entrada_paga: boolean | null
          id: string
          motivo_quebra: string | null
          numero: string | null
          primeira_parcela_data: string
          qtd_parcelas: number
          status: string | null
          updated_at: string | null
          valor_acordo: number
          valor_desconto: number | null
          valor_entrada: number | null
          valor_juros: number | null
          valor_original: number
          valor_parcela: number
        }
        Insert: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          associado_id: string
          cobrancas_ids: string[]
          created_at?: string | null
          criado_por?: string | null
          dia_vencimento: number
          entrada_data_pagamento?: string | null
          entrada_paga?: boolean | null
          id?: string
          motivo_quebra?: string | null
          numero?: string | null
          primeira_parcela_data: string
          qtd_parcelas?: number
          status?: string | null
          updated_at?: string | null
          valor_acordo: number
          valor_desconto?: number | null
          valor_entrada?: number | null
          valor_juros?: number | null
          valor_original: number
          valor_parcela: number
        }
        Update: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          associado_id?: string
          cobrancas_ids?: string[]
          created_at?: string | null
          criado_por?: string | null
          dia_vencimento?: number
          entrada_data_pagamento?: string | null
          entrada_paga?: boolean | null
          id?: string
          motivo_quebra?: string | null
          numero?: string | null
          primeira_parcela_data?: string
          qtd_parcelas?: number
          status?: string | null
          updated_at?: string | null
          valor_acordo?: number
          valor_desconto?: number | null
          valor_entrada?: number | null
          valor_juros?: number | null
          valor_original?: number
          valor_parcela?: number
        }
        Relationships: [
          {
            foreignKeyName: "acordos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "associados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acordos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "acordos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "acordos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associado_financeiro"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "acordos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associados_publico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acordos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_inadimplentes"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "acordos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["associado_id"]
          },
        ]
      }
      advogados: {
        Row: {
          agencia: string | null
          ativo: boolean | null
          bairro: string | null
          banco: string | null
          cep: string | null
          cidade: string | null
          complemento: string | null
          conta: string | null
          cpf_cnpj: string | null
          created_at: string | null
          email: string | null
          especialidades: string[] | null
          estado: string | null
          id: string
          logradouro: string | null
          nome: string
          numero: string | null
          oab: string | null
          oab_estado: string | null
          percentual_exito: number | null
          pix_chave: string | null
          pix_tipo: string | null
          telefone: string | null
          tipo: string
          tipo_contrato: string | null
          updated_at: string | null
          valor_fixo: number | null
          whatsapp: string | null
        }
        Insert: {
          agencia?: string | null
          ativo?: boolean | null
          bairro?: string | null
          banco?: string | null
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          conta?: string | null
          cpf_cnpj?: string | null
          created_at?: string | null
          email?: string | null
          especialidades?: string[] | null
          estado?: string | null
          id?: string
          logradouro?: string | null
          nome: string
          numero?: string | null
          oab?: string | null
          oab_estado?: string | null
          percentual_exito?: number | null
          pix_chave?: string | null
          pix_tipo?: string | null
          telefone?: string | null
          tipo: string
          tipo_contrato?: string | null
          updated_at?: string | null
          valor_fixo?: number | null
          whatsapp?: string | null
        }
        Update: {
          agencia?: string | null
          ativo?: boolean | null
          bairro?: string | null
          banco?: string | null
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          conta?: string | null
          cpf_cnpj?: string | null
          created_at?: string | null
          email?: string | null
          especialidades?: string[] | null
          estado?: string | null
          id?: string
          logradouro?: string | null
          nome?: string
          numero?: string | null
          oab?: string | null
          oab_estado?: string | null
          percentual_exito?: number | null
          pix_chave?: string | null
          pix_tipo?: string | null
          telefone?: string | null
          tipo?: string
          tipo_contrato?: string | null
          updated_at?: string | null
          valor_fixo?: number | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      afastamentos: {
        Row: {
          cid: string | null
          created_at: string | null
          data_fim: string | null
          data_inicio: string
          dias_afastamento: number | null
          documento_url: string | null
          funcionario_id: string
          id: string
          motivo: string
          registrado_por: string | null
          status: string | null
          tipo: string
          updated_at: string | null
        }
        Insert: {
          cid?: string | null
          created_at?: string | null
          data_fim?: string | null
          data_inicio: string
          dias_afastamento?: number | null
          documento_url?: string | null
          funcionario_id: string
          id?: string
          motivo: string
          registrado_por?: string | null
          status?: string | null
          tipo: string
          updated_at?: string | null
        }
        Update: {
          cid?: string | null
          created_at?: string | null
          data_fim?: string | null
          data_inicio?: string
          dias_afastamento?: number | null
          documento_url?: string | null
          funcionario_id?: string
          id?: string
          motivo?: string
          registrado_por?: string | null
          status?: string | null
          tipo?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "afastamentos_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "afastamentos_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "view_aniversariantes_mes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "afastamentos_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "view_funcionarios_ativos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "afastamentos_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "afastamentos_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "afastamentos_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
        ]
      }
      agendamentos_base: {
        Row: {
          atendido_por: string | null
          cliente_email: string | null
          cliente_nome: string
          cliente_telefone: string | null
          cotacao_id: string | null
          created_at: string | null
          data_agendada: string
          horario: string
          id: string
          instalacao_id: string | null
          observacoes: string | null
          status: string | null
          updated_at: string | null
          veiculo_descricao: string | null
          veiculo_placa: string | null
          vistoria_id: string | null
        }
        Insert: {
          atendido_por?: string | null
          cliente_email?: string | null
          cliente_nome: string
          cliente_telefone?: string | null
          cotacao_id?: string | null
          created_at?: string | null
          data_agendada: string
          horario: string
          id?: string
          instalacao_id?: string | null
          observacoes?: string | null
          status?: string | null
          updated_at?: string | null
          veiculo_descricao?: string | null
          veiculo_placa?: string | null
          vistoria_id?: string | null
        }
        Update: {
          atendido_por?: string | null
          cliente_email?: string | null
          cliente_nome?: string
          cliente_telefone?: string | null
          cotacao_id?: string | null
          created_at?: string | null
          data_agendada?: string
          horario?: string
          id?: string
          instalacao_id?: string | null
          observacoes?: string | null
          status?: string | null
          updated_at?: string | null
          veiculo_descricao?: string | null
          veiculo_placa?: string | null
          vistoria_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agendamentos_base_atendido_por_fkey"
            columns: ["atendido_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendamentos_base_atendido_por_fkey"
            columns: ["atendido_por"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "agendamentos_base_atendido_por_fkey"
            columns: ["atendido_por"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "agendamentos_base_cotacao_id_fkey"
            columns: ["cotacao_id"]
            isOneToOne: false
            referencedRelation: "cotacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendamentos_base_instalacao_id_fkey"
            columns: ["instalacao_id"]
            isOneToOne: false
            referencedRelation: "instalacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendamentos_base_instalacao_id_fkey"
            columns: ["instalacao_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["instalacao_id"]
          },
          {
            foreignKeyName: "agendamentos_base_vistoria_id_fkey"
            columns: ["vistoria_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["vistoria_id"]
          },
          {
            foreignKeyName: "agendamentos_base_vistoria_id_fkey"
            columns: ["vistoria_id"]
            isOneToOne: false
            referencedRelation: "vistorias"
            referencedColumns: ["id"]
          },
        ]
      }
      agente_ia_config: {
        Row: {
          chave: string
          id: string
          updated_at: string | null
          updated_by: string | null
          valor: string
        }
        Insert: {
          chave: string
          id?: string
          updated_at?: string | null
          updated_by?: string | null
          valor?: string
        }
        Update: {
          chave?: string
          id?: string
          updated_at?: string | null
          updated_by?: string | null
          valor?: string
        }
        Relationships: []
      }
      agente_ia_contatos: {
        Row: {
          created_at: string | null
          id: string
          nome: string | null
          status: string | null
          telefone: string
          ultima_interacao: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          nome?: string | null
          status?: string | null
          telefone: string
          ultima_interacao?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          nome?: string | null
          status?: string | null
          telefone?: string
          ultima_interacao?: string | null
        }
        Relationships: []
      }
      alocacoes_diarias: {
        Row: {
          created_at: string
          data: string
          definido_por: string | null
          id: string
          observacoes: string | null
          profissional_id: string
          tipo_alocacao: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data: string
          definido_por?: string | null
          id?: string
          observacoes?: string | null
          profissional_id: string
          tipo_alocacao: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: string
          definido_por?: string | null
          id?: string
          observacoes?: string | null
          profissional_id?: string
          tipo_alocacao?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "alocacoes_diarias_definido_por_fkey"
            columns: ["definido_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alocacoes_diarias_definido_por_fkey"
            columns: ["definido_por"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "alocacoes_diarias_definido_por_fkey"
            columns: ["definido_por"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "alocacoes_diarias_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alocacoes_diarias_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "alocacoes_diarias_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
        ]
      }
      api_keys: {
        Row: {
          ativa: boolean | null
          created_at: string | null
          created_by: string | null
          expires_at: string | null
          id: string
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          nome: string
        }
        Insert: {
          ativa?: boolean | null
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          nome: string
        }
        Update: {
          ativa?: boolean | null
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          nome?: string
        }
        Relationships: []
      }
      api_leads_config: {
        Row: {
          api_key_id: string | null
          ativo: boolean | null
          configuracoes: Json | null
          cor: string | null
          created_at: string | null
          icone: string | null
          id: string
          leads_recebidos: number | null
          nome: string
          slug: string
          tipo: string
          ultimo_lead_em: string | null
          updated_at: string | null
          webhook_url: string | null
        }
        Insert: {
          api_key_id?: string | null
          ativo?: boolean | null
          configuracoes?: Json | null
          cor?: string | null
          created_at?: string | null
          icone?: string | null
          id?: string
          leads_recebidos?: number | null
          nome: string
          slug: string
          tipo: string
          ultimo_lead_em?: string | null
          updated_at?: string | null
          webhook_url?: string | null
        }
        Update: {
          api_key_id?: string | null
          ativo?: boolean | null
          configuracoes?: Json | null
          cor?: string | null
          created_at?: string | null
          icone?: string | null
          id?: string
          leads_recebidos?: number | null
          nome?: string
          slug?: string
          tipo?: string
          ultimo_lead_em?: string | null
          updated_at?: string | null
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_leads_config_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      api_leads_logs: {
        Row: {
          api_config_id: string | null
          created_at: string | null
          erro: string | null
          id: string
          ip_origem: string | null
          lead_id: string | null
          origem: string | null
          payload: Json | null
          status: string
          tempo_resposta_ms: number | null
        }
        Insert: {
          api_config_id?: string | null
          created_at?: string | null
          erro?: string | null
          id?: string
          ip_origem?: string | null
          lead_id?: string | null
          origem?: string | null
          payload?: Json | null
          status: string
          tempo_resposta_ms?: number | null
        }
        Update: {
          api_config_id?: string | null
          created_at?: string | null
          erro?: string | null
          id?: string
          ip_origem?: string | null
          lead_id?: string | null
          origem?: string | null
          payload?: Json | null
          status?: string
          tempo_resposta_ms?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "api_leads_logs_api_config_id_fkey"
            columns: ["api_config_id"]
            isOneToOne: false
            referencedRelation: "api_leads_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_leads_logs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_leads_logs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["lead_id"]
          },
        ]
      }
      app_roles_config: {
        Row: {
          area: string
          area_color: string
          area_icon: string
          color: string
          created_at: string
          description: string
          icon_name: string
          is_active: boolean
          is_operational: boolean
          label: string
          permissions: Json
          redirect_path: string | null
          role: string
          sigla: string
          sort_order: number
        }
        Insert: {
          area?: string
          area_color?: string
          area_icon?: string
          color?: string
          created_at?: string
          description?: string
          icon_name?: string
          is_active?: boolean
          is_operational?: boolean
          label: string
          permissions?: Json
          redirect_path?: string | null
          role: string
          sigla?: string
          sort_order?: number
        }
        Update: {
          area?: string
          area_color?: string
          area_icon?: string
          color?: string
          created_at?: string
          description?: string
          icon_name?: string
          is_active?: boolean
          is_operational?: boolean
          label?: string
          permissions?: Json
          redirect_path?: string | null
          role?: string
          sigla?: string
          sort_order?: number
        }
        Relationships: []
      }
      aprovacoes_elegibilidade: {
        Row: {
          ano: number
          aprovador_id: string | null
          combustivel: string
          cotacao_id: string
          created_at: string
          id: string
          justificativa: string
          marca: string
          modelo: string
          motivo_bloqueio: string
          observacao_aprovador: string | null
          observacao_regra: string | null
          placa: string | null
          plano_id: string
          respondido_em: string | null
          solicitante_id: string
          status: string
          supervisor_check: boolean
          supervisor_check_em: string | null
          supervisor_id: string | null
          updated_at: string
        }
        Insert: {
          ano: number
          aprovador_id?: string | null
          combustivel?: string
          cotacao_id: string
          created_at?: string
          id?: string
          justificativa: string
          marca: string
          modelo: string
          motivo_bloqueio?: string
          observacao_aprovador?: string | null
          observacao_regra?: string | null
          placa?: string | null
          plano_id: string
          respondido_em?: string | null
          solicitante_id: string
          status?: string
          supervisor_check?: boolean
          supervisor_check_em?: string | null
          supervisor_id?: string | null
          updated_at?: string
        }
        Update: {
          ano?: number
          aprovador_id?: string | null
          combustivel?: string
          cotacao_id?: string
          created_at?: string
          id?: string
          justificativa?: string
          marca?: string
          modelo?: string
          motivo_bloqueio?: string
          observacao_aprovador?: string | null
          observacao_regra?: string | null
          placa?: string | null
          plano_id?: string
          respondido_em?: string | null
          solicitante_id?: string
          status?: string
          supervisor_check?: boolean
          supervisor_check_em?: string | null
          supervisor_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "aprovacoes_elegibilidade_cotacao_id_fkey"
            columns: ["cotacao_id"]
            isOneToOne: false
            referencedRelation: "cotacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aprovacoes_elegibilidade_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "planos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aprovacoes_elegibilidade_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "vw_plans_compat"
            referencedColumns: ["id"]
          },
        ]
      }
      aprovacoes_fipe_menor: {
        Row: {
          cotacao_id: string
          created_at: string
          fipe_faixa_original_max: number
          fipe_faixa_original_min: number
          fipe_faixa_solicitada_max: number
          fipe_faixa_solicitada_min: number
          fipe_real: number
          id: string
          justificativa: string
          observacao_supervisor: string | null
          respondido_em: string | null
          solicitante_id: string
          status: string
          supervisor_id: string | null
          updated_at: string
          valor_mensal_original: number
          valor_mensal_reduzido: number
        }
        Insert: {
          cotacao_id: string
          created_at?: string
          fipe_faixa_original_max: number
          fipe_faixa_original_min: number
          fipe_faixa_solicitada_max: number
          fipe_faixa_solicitada_min: number
          fipe_real: number
          id?: string
          justificativa: string
          observacao_supervisor?: string | null
          respondido_em?: string | null
          solicitante_id: string
          status?: string
          supervisor_id?: string | null
          updated_at?: string
          valor_mensal_original: number
          valor_mensal_reduzido: number
        }
        Update: {
          cotacao_id?: string
          created_at?: string
          fipe_faixa_original_max?: number
          fipe_faixa_original_min?: number
          fipe_faixa_solicitada_max?: number
          fipe_faixa_solicitada_min?: number
          fipe_real?: number
          id?: string
          justificativa?: string
          observacao_supervisor?: string | null
          respondido_em?: string | null
          solicitante_id?: string
          status?: string
          supervisor_id?: string | null
          updated_at?: string
          valor_mensal_original?: number
          valor_mensal_reduzido?: number
        }
        Relationships: [
          {
            foreignKeyName: "aprovacoes_fipe_menor_cotacao_id_fkey"
            columns: ["cotacao_id"]
            isOneToOne: false
            referencedRelation: "cotacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      asaas_clientes: {
        Row: {
          asaas_id: string
          associado_id: string
          ativo: boolean | null
          bairro: string | null
          cep: string | null
          cidade: string | null
          complemento: string | null
          cpf_cnpj: string | null
          created_at: string | null
          email: string | null
          id: string
          logradouro: string | null
          nome: string | null
          numero: string | null
          sincronizado_em: string | null
          telefone: string | null
          uf: string | null
          updated_at: string | null
        }
        Insert: {
          asaas_id: string
          associado_id: string
          ativo?: boolean | null
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          cpf_cnpj?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          logradouro?: string | null
          nome?: string | null
          numero?: string | null
          sincronizado_em?: string | null
          telefone?: string | null
          uf?: string | null
          updated_at?: string | null
        }
        Update: {
          asaas_id?: string
          associado_id?: string
          ativo?: boolean | null
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          cpf_cnpj?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          logradouro?: string | null
          nome?: string | null
          numero?: string | null
          sincronizado_em?: string | null
          telefone?: string | null
          uf?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asaas_clientes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "associados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asaas_clientes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "asaas_clientes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "asaas_clientes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associado_financeiro"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "asaas_clientes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associados_publico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asaas_clientes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_inadimplentes"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "asaas_clientes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["associado_id"]
          },
        ]
      }
      asaas_cobrancas: {
        Row: {
          ano_referencia: number | null
          asaas_cliente_id: string | null
          asaas_id: string
          associado_id: string
          boleto_codigo_barras: string | null
          boleto_nosso_numero: string | null
          boleto_url: string | null
          cancelado_por: string | null
          competencia: string | null
          composicao_resumo: Json | null
          contrato_id: string | null
          created_at: string | null
          criado_por: string | null
          data_emissao: string
          data_pagamento: string | null
          data_vencimento: string
          desconto: number | null
          enviada_whatsapp: boolean | null
          enviada_whatsapp_em: string | null
          fechamento_id: string | null
          forma_pagamento: string | null
          id: string
          juros: number | null
          lembrete_d1_enviado: boolean | null
          lembrete_d3_enviado: boolean | null
          lembrete_d5_enviado: boolean | null
          lembrete_vencimento_enviado: boolean | null
          linha_digitavel: string | null
          mes_referencia: number | null
          modelo_cobranca: string | null
          motivo_cancelamento: string | null
          multa: number | null
          notificacao_data: string | null
          notificacao_enviada: boolean | null
          pagamento_data: string | null
          pagamento_forma: string | null
          pagamento_transacao_id: string | null
          pagamento_valor: number | null
          pix_copia_cola: string | null
          pix_expiracao: string | null
          pix_qrcode: string | null
          referencia: string | null
          sincronizado_em: string | null
          status: string
          tipo: string
          updated_at: string | null
          valor: number
          valor_liquido: number | null
          veiculo_id: string | null
        }
        Insert: {
          ano_referencia?: number | null
          asaas_cliente_id?: string | null
          asaas_id: string
          associado_id: string
          boleto_codigo_barras?: string | null
          boleto_nosso_numero?: string | null
          boleto_url?: string | null
          cancelado_por?: string | null
          competencia?: string | null
          composicao_resumo?: Json | null
          contrato_id?: string | null
          created_at?: string | null
          criado_por?: string | null
          data_emissao: string
          data_pagamento?: string | null
          data_vencimento: string
          desconto?: number | null
          enviada_whatsapp?: boolean | null
          enviada_whatsapp_em?: string | null
          fechamento_id?: string | null
          forma_pagamento?: string | null
          id?: string
          juros?: number | null
          lembrete_d1_enviado?: boolean | null
          lembrete_d3_enviado?: boolean | null
          lembrete_d5_enviado?: boolean | null
          lembrete_vencimento_enviado?: boolean | null
          linha_digitavel?: string | null
          mes_referencia?: number | null
          modelo_cobranca?: string | null
          motivo_cancelamento?: string | null
          multa?: number | null
          notificacao_data?: string | null
          notificacao_enviada?: boolean | null
          pagamento_data?: string | null
          pagamento_forma?: string | null
          pagamento_transacao_id?: string | null
          pagamento_valor?: number | null
          pix_copia_cola?: string | null
          pix_expiracao?: string | null
          pix_qrcode?: string | null
          referencia?: string | null
          sincronizado_em?: string | null
          status: string
          tipo: string
          updated_at?: string | null
          valor: number
          valor_liquido?: number | null
          veiculo_id?: string | null
        }
        Update: {
          ano_referencia?: number | null
          asaas_cliente_id?: string | null
          asaas_id?: string
          associado_id?: string
          boleto_codigo_barras?: string | null
          boleto_nosso_numero?: string | null
          boleto_url?: string | null
          cancelado_por?: string | null
          competencia?: string | null
          composicao_resumo?: Json | null
          contrato_id?: string | null
          created_at?: string | null
          criado_por?: string | null
          data_emissao?: string
          data_pagamento?: string | null
          data_vencimento?: string
          desconto?: number | null
          enviada_whatsapp?: boolean | null
          enviada_whatsapp_em?: string | null
          fechamento_id?: string | null
          forma_pagamento?: string | null
          id?: string
          juros?: number | null
          lembrete_d1_enviado?: boolean | null
          lembrete_d3_enviado?: boolean | null
          lembrete_d5_enviado?: boolean | null
          lembrete_vencimento_enviado?: boolean | null
          linha_digitavel?: string | null
          mes_referencia?: number | null
          modelo_cobranca?: string | null
          motivo_cancelamento?: string | null
          multa?: number | null
          notificacao_data?: string | null
          notificacao_enviada?: boolean | null
          pagamento_data?: string | null
          pagamento_forma?: string | null
          pagamento_transacao_id?: string | null
          pagamento_valor?: number | null
          pix_copia_cola?: string | null
          pix_expiracao?: string | null
          pix_qrcode?: string | null
          referencia?: string | null
          sincronizado_em?: string | null
          status?: string
          tipo?: string
          updated_at?: string | null
          valor?: number
          valor_liquido?: number | null
          veiculo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asaas_cobrancas_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "associados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asaas_cobrancas_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "asaas_cobrancas_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "asaas_cobrancas_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associado_financeiro"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "asaas_cobrancas_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associados_publico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asaas_cobrancas_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_inadimplentes"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "asaas_cobrancas_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "asaas_cobrancas_cancelado_por_fkey"
            columns: ["cancelado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asaas_cobrancas_cancelado_por_fkey"
            columns: ["cancelado_por"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "asaas_cobrancas_cancelado_por_fkey"
            columns: ["cancelado_por"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "asaas_cobrancas_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asaas_cobrancas_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "asaas_cobrancas_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asaas_cobrancas_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "asaas_cobrancas_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "asaas_cobrancas_fechamento_id_fkey"
            columns: ["fechamento_id"]
            isOneToOne: false
            referencedRelation: "fechamentos_mensais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asaas_cobrancas_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asaas_cobrancas_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["veiculo_id"]
          },
          {
            foreignKeyName: "asaas_cobrancas_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["veiculo_id"]
          },
          {
            foreignKeyName: "asaas_cobrancas_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["veiculo_id"]
          },
          {
            foreignKeyName: "asaas_cobrancas_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "vw_veiculos_com_cotas"
            referencedColumns: ["id"]
          },
        ]
      }
      asaas_config: {
        Row: {
          chave: string
          created_at: string | null
          descricao: string | null
          id: string
          tipo: string | null
          updated_at: string | null
          valor: string | null
        }
        Insert: {
          chave: string
          created_at?: string | null
          descricao?: string | null
          id?: string
          tipo?: string | null
          updated_at?: string | null
          valor?: string | null
        }
        Update: {
          chave?: string
          created_at?: string | null
          descricao?: string | null
          id?: string
          tipo?: string | null
          updated_at?: string | null
          valor?: string | null
        }
        Relationships: []
      }
      asaas_pagamentos: {
        Row: {
          asaas_cobranca_id: string | null
          asaas_id: string
          associado_id: string
          cobranca_id: string | null
          comprovante_url: string | null
          created_at: string | null
          data_credito: string | null
          data_pagamento: string
          forma_pagamento: string
          id: string
          status: string
          taxa: number | null
          transacao_id: string | null
          valor: number
          valor_liquido: number | null
        }
        Insert: {
          asaas_cobranca_id?: string | null
          asaas_id: string
          associado_id: string
          cobranca_id?: string | null
          comprovante_url?: string | null
          created_at?: string | null
          data_credito?: string | null
          data_pagamento: string
          forma_pagamento: string
          id?: string
          status: string
          taxa?: number | null
          transacao_id?: string | null
          valor: number
          valor_liquido?: number | null
        }
        Update: {
          asaas_cobranca_id?: string | null
          asaas_id?: string
          associado_id?: string
          cobranca_id?: string | null
          comprovante_url?: string | null
          created_at?: string | null
          data_credito?: string | null
          data_pagamento?: string
          forma_pagamento?: string
          id?: string
          status?: string
          taxa?: number | null
          transacao_id?: string | null
          valor?: number
          valor_liquido?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "asaas_pagamentos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "associados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asaas_pagamentos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "asaas_pagamentos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "asaas_pagamentos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associado_financeiro"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "asaas_pagamentos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associados_publico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asaas_pagamentos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_inadimplentes"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "asaas_pagamentos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "asaas_pagamentos_cobranca_id_fkey"
            columns: ["cobranca_id"]
            isOneToOne: false
            referencedRelation: "asaas_cobrancas"
            referencedColumns: ["id"]
          },
        ]
      }
      asaas_webhooks_log: {
        Row: {
          asaas_cliente_id: string | null
          asaas_cobranca_id: string | null
          asaas_pagamento_id: string | null
          created_at: string | null
          erro: string | null
          evento: string
          id: string
          payload: Json
          processado: boolean | null
          processado_em: string | null
        }
        Insert: {
          asaas_cliente_id?: string | null
          asaas_cobranca_id?: string | null
          asaas_pagamento_id?: string | null
          created_at?: string | null
          erro?: string | null
          evento: string
          id?: string
          payload: Json
          processado?: boolean | null
          processado_em?: string | null
        }
        Update: {
          asaas_cliente_id?: string | null
          asaas_cobranca_id?: string | null
          asaas_pagamento_id?: string | null
          created_at?: string | null
          erro?: string | null
          evento?: string
          id?: string
          payload?: Json
          processado?: boolean | null
          processado_em?: string | null
        }
        Relationships: []
      }
      associacoes_concorrentes: {
        Row: {
          ativo: boolean | null
          cnpj: string | null
          created_at: string | null
          dominios_email: string[] | null
          id: string
          nome: string
          palavras_chave: string[] | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          cnpj?: string | null
          created_at?: string | null
          dominios_email?: string[] | null
          id?: string
          nome: string
          palavras_chave?: string[] | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          cnpj?: string | null
          created_at?: string | null
          dominios_email?: string[] | null
          id?: string
          nome?: string
          palavras_chave?: string[] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      associados: {
        Row: {
          aprovado_em: string | null
          aprovado_por: string | null
          asaas_recorrencia_cancelada: boolean | null
          avatar_url: string | null
          bairro: string | null
          bloqueado: boolean | null
          boleto_final_gerado: boolean | null
          cancelado_por: string | null
          cep: string | null
          cidade: string | null
          codigo_hinova: number | null
          complemento: string | null
          contrato_id: string | null
          cpf: string
          created_at: string
          data_adesao: string | null
          data_ativacao: string | null
          data_bloqueio: string | null
          data_cancelamento: string | null
          data_efetiva_saida: string | null
          data_nascimento: string | null
          data_primeiro_boleto_pago: string | null
          dia_vencimento: number | null
          email: string
          endereco_latitude: number | null
          endereco_longitude: number | null
          estado_civil: string | null
          id: string
          instalacao_agendada: boolean | null
          logradouro: string | null
          motivo_bloqueio: string | null
          motivo_cancelamento: string | null
          nome: string
          numero: string | null
          pendencia_rastreador: boolean | null
          pendencia_rastreador_servico_id: string | null
          plano_id: string | null
          pode_reativar: boolean | null
          primeiro_boleto_gerado: boolean | null
          profissao: string | null
          qtd_boletos_pagos: number | null
          revistoria_pendente: boolean | null
          rg: string | null
          sexo: string | null
          sincronizado_hinova: boolean | null
          sincronizado_hinova_em: string | null
          status: Database["public"]["Enums"]["status_associado"]
          telefone: string
          telefone_secundario: string | null
          tipo_saida: string | null
          uf: string | null
          updated_at: string
          user_id: string | null
          vendedor_original_id: string | null
          whatsapp: string | null
        }
        Insert: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          asaas_recorrencia_cancelada?: boolean | null
          avatar_url?: string | null
          bairro?: string | null
          bloqueado?: boolean | null
          boleto_final_gerado?: boolean | null
          cancelado_por?: string | null
          cep?: string | null
          cidade?: string | null
          codigo_hinova?: number | null
          complemento?: string | null
          contrato_id?: string | null
          cpf: string
          created_at?: string
          data_adesao?: string | null
          data_ativacao?: string | null
          data_bloqueio?: string | null
          data_cancelamento?: string | null
          data_efetiva_saida?: string | null
          data_nascimento?: string | null
          data_primeiro_boleto_pago?: string | null
          dia_vencimento?: number | null
          email: string
          endereco_latitude?: number | null
          endereco_longitude?: number | null
          estado_civil?: string | null
          id?: string
          instalacao_agendada?: boolean | null
          logradouro?: string | null
          motivo_bloqueio?: string | null
          motivo_cancelamento?: string | null
          nome: string
          numero?: string | null
          pendencia_rastreador?: boolean | null
          pendencia_rastreador_servico_id?: string | null
          plano_id?: string | null
          pode_reativar?: boolean | null
          primeiro_boleto_gerado?: boolean | null
          profissao?: string | null
          qtd_boletos_pagos?: number | null
          revistoria_pendente?: boolean | null
          rg?: string | null
          sexo?: string | null
          sincronizado_hinova?: boolean | null
          sincronizado_hinova_em?: string | null
          status?: Database["public"]["Enums"]["status_associado"]
          telefone: string
          telefone_secundario?: string | null
          tipo_saida?: string | null
          uf?: string | null
          updated_at?: string
          user_id?: string | null
          vendedor_original_id?: string | null
          whatsapp?: string | null
        }
        Update: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          asaas_recorrencia_cancelada?: boolean | null
          avatar_url?: string | null
          bairro?: string | null
          bloqueado?: boolean | null
          boleto_final_gerado?: boolean | null
          cancelado_por?: string | null
          cep?: string | null
          cidade?: string | null
          codigo_hinova?: number | null
          complemento?: string | null
          contrato_id?: string | null
          cpf?: string
          created_at?: string
          data_adesao?: string | null
          data_ativacao?: string | null
          data_bloqueio?: string | null
          data_cancelamento?: string | null
          data_efetiva_saida?: string | null
          data_nascimento?: string | null
          data_primeiro_boleto_pago?: string | null
          dia_vencimento?: number | null
          email?: string
          endereco_latitude?: number | null
          endereco_longitude?: number | null
          estado_civil?: string | null
          id?: string
          instalacao_agendada?: boolean | null
          logradouro?: string | null
          motivo_bloqueio?: string | null
          motivo_cancelamento?: string | null
          nome?: string
          numero?: string | null
          pendencia_rastreador?: boolean | null
          pendencia_rastreador_servico_id?: string | null
          plano_id?: string | null
          pode_reativar?: boolean | null
          primeiro_boleto_gerado?: boolean | null
          profissao?: string | null
          qtd_boletos_pagos?: number | null
          revistoria_pendente?: boolean | null
          rg?: string | null
          sexo?: string | null
          sincronizado_hinova?: boolean | null
          sincronizado_hinova_em?: string | null
          status?: Database["public"]["Enums"]["status_associado"]
          telefone?: string
          telefone_secundario?: string | null
          tipo_saida?: string | null
          uf?: string | null
          updated_at?: string
          user_id?: string | null
          vendedor_original_id?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "associados_aprovado_por_fkey"
            columns: ["aprovado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "associados_aprovado_por_fkey"
            columns: ["aprovado_por"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "associados_aprovado_por_fkey"
            columns: ["aprovado_por"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "associados_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "associados_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "associados_pendencia_rastreador_servico_id_fkey"
            columns: ["pendencia_rastreador_servico_id"]
            isOneToOne: false
            referencedRelation: "servicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "associados_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "planos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "associados_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "vw_plans_compat"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "associados_vendedor_original_id_fkey"
            columns: ["vendedor_original_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "associados_vendedor_original_id_fkey"
            columns: ["vendedor_original_id"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "associados_vendedor_original_id_fkey"
            columns: ["vendedor_original_id"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
        ]
      }
      associados_beneficios_adicionais: {
        Row: {
          associado_id: string
          ativo: boolean | null
          beneficio_adicional_id: string
          contrato_id: string | null
          created_at: string | null
          data_fim: string | null
          data_inicio: string | null
          id: string
          valor_contratado: number
        }
        Insert: {
          associado_id: string
          ativo?: boolean | null
          beneficio_adicional_id: string
          contrato_id?: string | null
          created_at?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          id?: string
          valor_contratado: number
        }
        Update: {
          associado_id?: string
          ativo?: boolean | null
          beneficio_adicional_id?: string
          contrato_id?: string | null
          created_at?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          id?: string
          valor_contratado?: number
        }
        Relationships: [
          {
            foreignKeyName: "associados_beneficios_adicionais_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "associados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "associados_beneficios_adicionais_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "associados_beneficios_adicionais_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "associados_beneficios_adicionais_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associado_financeiro"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "associados_beneficios_adicionais_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associados_publico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "associados_beneficios_adicionais_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_inadimplentes"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "associados_beneficios_adicionais_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "associados_beneficios_adicionais_beneficio_adicional_id_fkey"
            columns: ["beneficio_adicional_id"]
            isOneToOne: false
            referencedRelation: "beneficios_adicionais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "associados_beneficios_adicionais_beneficio_adicional_id_fkey"
            columns: ["beneficio_adicional_id"]
            isOneToOne: false
            referencedRelation: "vw_custo_real_adicionais"
            referencedColumns: ["beneficio_id"]
          },
          {
            foreignKeyName: "associados_beneficios_adicionais_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "associados_beneficios_adicionais_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["contrato_id"]
          },
        ]
      }
      associados_historico: {
        Row: {
          acao: string | null
          associado_id: string
          contrato_id: string | null
          created_at: string | null
          dados_anteriores: Json | null
          dados_novos: Json | null
          descricao: string
          documento_id: string | null
          executado_por: string | null
          id: string
          instalacao_id: string | null
          metadata: Json | null
          motivo: string | null
          status_anterior: string | null
          status_novo: string | null
          tipo: string
          usuario_id: string | null
          veiculo_id: string | null
        }
        Insert: {
          acao?: string | null
          associado_id: string
          contrato_id?: string | null
          created_at?: string | null
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          descricao: string
          documento_id?: string | null
          executado_por?: string | null
          id?: string
          instalacao_id?: string | null
          metadata?: Json | null
          motivo?: string | null
          status_anterior?: string | null
          status_novo?: string | null
          tipo: string
          usuario_id?: string | null
          veiculo_id?: string | null
        }
        Update: {
          acao?: string | null
          associado_id?: string
          contrato_id?: string | null
          created_at?: string | null
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          descricao?: string
          documento_id?: string | null
          executado_por?: string | null
          id?: string
          instalacao_id?: string | null
          metadata?: Json | null
          motivo?: string | null
          status_anterior?: string | null
          status_novo?: string | null
          tipo?: string
          usuario_id?: string | null
          veiculo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "associados_historico_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "associados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "associados_historico_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "associados_historico_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "associados_historico_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associado_financeiro"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "associados_historico_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associados_publico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "associados_historico_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_inadimplentes"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "associados_historico_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "associados_historico_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "associados_historico_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "associados_historico_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "documentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "associados_historico_instalacao_id_fkey"
            columns: ["instalacao_id"]
            isOneToOne: false
            referencedRelation: "instalacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "associados_historico_instalacao_id_fkey"
            columns: ["instalacao_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["instalacao_id"]
          },
          {
            foreignKeyName: "associados_historico_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "associados_historico_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "associados_historico_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "associados_historico_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "associados_historico_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["veiculo_id"]
          },
          {
            foreignKeyName: "associados_historico_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["veiculo_id"]
          },
          {
            foreignKeyName: "associados_historico_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["veiculo_id"]
          },
          {
            foreignKeyName: "associados_historico_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "vw_veiculos_com_cotas"
            referencedColumns: ["id"]
          },
        ]
      }
      auditoria_indicios_concorrencia: {
        Row: {
          analisado_em: string | null
          analisado_por: string | null
          associacao_concorrente_id: string | null
          created_at: string | null
          dados_evidencia: Json | null
          descricao: string | null
          id: string
          observacoes: string | null
          score_risco: number | null
          status: string | null
          tipo_indicio: string
          vendedor_id: string
        }
        Insert: {
          analisado_em?: string | null
          analisado_por?: string | null
          associacao_concorrente_id?: string | null
          created_at?: string | null
          dados_evidencia?: Json | null
          descricao?: string | null
          id?: string
          observacoes?: string | null
          score_risco?: number | null
          status?: string | null
          tipo_indicio: string
          vendedor_id: string
        }
        Update: {
          analisado_em?: string | null
          analisado_por?: string | null
          associacao_concorrente_id?: string | null
          created_at?: string | null
          dados_evidencia?: Json | null
          descricao?: string | null
          id?: string
          observacoes?: string | null
          score_risco?: number | null
          status?: string | null
          tipo_indicio?: string
          vendedor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "auditoria_indicios_concorrencia_analisado_por_fkey"
            columns: ["analisado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auditoria_indicios_concorrencia_analisado_por_fkey"
            columns: ["analisado_por"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "auditoria_indicios_concorrencia_analisado_por_fkey"
            columns: ["analisado_por"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "auditoria_indicios_concorrencia_associacao_concorrente_id_fkey"
            columns: ["associacao_concorrente_id"]
            isOneToOne: false
            referencedRelation: "associacoes_concorrentes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auditoria_indicios_concorrencia_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auditoria_indicios_concorrencia_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "auditoria_indicios_concorrencia_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
        ]
      }
      auditoria_vendedores: {
        Row: {
          analisado_em: string | null
          analisado_por: string | null
          created_at: string | null
          dados: Json | null
          descricao: string
          id: string
          observacoes_analise: string | null
          score_risco: number | null
          status: string | null
          tipo_alerta: string
          vendedor_id: string
        }
        Insert: {
          analisado_em?: string | null
          analisado_por?: string | null
          created_at?: string | null
          dados?: Json | null
          descricao: string
          id?: string
          observacoes_analise?: string | null
          score_risco?: number | null
          status?: string | null
          tipo_alerta: string
          vendedor_id: string
        }
        Update: {
          analisado_em?: string | null
          analisado_por?: string | null
          created_at?: string | null
          dados?: Json | null
          descricao?: string
          id?: string
          observacoes_analise?: string | null
          score_risco?: number | null
          status?: string | null
          tipo_alerta?: string
          vendedor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "auditoria_vendedores_analisado_por_fkey"
            columns: ["analisado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auditoria_vendedores_analisado_por_fkey"
            columns: ["analisado_por"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "auditoria_vendedores_analisado_por_fkey"
            columns: ["analisado_por"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "auditoria_vendedores_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auditoria_vendedores_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "auditoria_vendedores_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
        ]
      }
      auth_bloqueios: {
        Row: {
          bloqueado_ate: string | null
          bloqueio_permanente: boolean
          created_at: string
          desbloqueado_em: string | null
          desbloqueado_por: string | null
          email: string
          id: string
          ip: unknown
          motivo: string | null
          nivel: number
        }
        Insert: {
          bloqueado_ate?: string | null
          bloqueio_permanente?: boolean
          created_at?: string
          desbloqueado_em?: string | null
          desbloqueado_por?: string | null
          email: string
          id?: string
          ip?: unknown
          motivo?: string | null
          nivel?: number
        }
        Update: {
          bloqueado_ate?: string | null
          bloqueio_permanente?: boolean
          created_at?: string
          desbloqueado_em?: string | null
          desbloqueado_por?: string | null
          email?: string
          id?: string
          ip?: unknown
          motivo?: string | null
          nivel?: number
        }
        Relationships: [
          {
            foreignKeyName: "auth_bloqueios_desbloqueado_por_fkey"
            columns: ["desbloqueado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auth_bloqueios_desbloqueado_por_fkey"
            columns: ["desbloqueado_por"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "auth_bloqueios_desbloqueado_por_fkey"
            columns: ["desbloqueado_por"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
        ]
      }
      auth_logs: {
        Row: {
          acao: string
          cidade: string | null
          created_at: string | null
          dispositivo: string | null
          email: string | null
          id: string
          ip_address: unknown
          metadata: Json | null
          modulo: string | null
          navegador: string | null
          pais: string | null
          profile_id: string | null
          sistema_operacional: string | null
          user_agent: string | null
        }
        Insert: {
          acao: string
          cidade?: string | null
          created_at?: string | null
          dispositivo?: string | null
          email?: string | null
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          modulo?: string | null
          navegador?: string | null
          pais?: string | null
          profile_id?: string | null
          sistema_operacional?: string | null
          user_agent?: string | null
        }
        Update: {
          acao?: string
          cidade?: string | null
          created_at?: string | null
          dispositivo?: string | null
          email?: string | null
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          modulo?: string | null
          navegador?: string | null
          pais?: string | null
          profile_id?: string | null
          sistema_operacional?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auth_logs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auth_logs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "auth_logs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
        ]
      }
      auth_sessoes: {
        Row: {
          ativo: boolean
          created_at: string
          expira_em: string
          id: string
          ip: unknown
          navegador: string | null
          profile_id: string
          sistema_operacional: string | null
          tipo_dispositivo: string
          token_hash: string
          ultimo_acesso: string
          user_agent: string | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          expira_em: string
          id?: string
          ip?: unknown
          navegador?: string | null
          profile_id: string
          sistema_operacional?: string | null
          tipo_dispositivo: string
          token_hash: string
          ultimo_acesso?: string
          user_agent?: string | null
        }
        Update: {
          ativo?: boolean
          created_at?: string
          expira_em?: string
          id?: string
          ip?: unknown
          navegador?: string | null
          profile_id?: string
          sistema_operacional?: string | null
          tipo_dispositivo?: string
          token_hash?: string
          ultimo_acesso?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auth_sessoes_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auth_sessoes_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "auth_sessoes_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
        ]
      }
      auth_tentativas: {
        Row: {
          created_at: string
          email: string
          id: string
          ip: unknown
          motivo_falha: string | null
          sucesso: boolean
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          ip?: unknown
          motivo_falha?: string | null
          sucesso?: boolean
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          ip?: unknown
          motivo_falha?: string | null
          sucesso?: boolean
        }
        Relationships: []
      }
      auth_tokens_app: {
        Row: {
          associado_id: string
          canal_envio: string | null
          codigo: string
          created_at: string | null
          expira_em: string
          id: string
          ip_solicitante: string | null
          max_tentativas: number | null
          tentativas: number | null
          tipo: string
          usado: boolean | null
          usado_em: string | null
        }
        Insert: {
          associado_id: string
          canal_envio?: string | null
          codigo: string
          created_at?: string | null
          expira_em: string
          id?: string
          ip_solicitante?: string | null
          max_tentativas?: number | null
          tentativas?: number | null
          tipo: string
          usado?: boolean | null
          usado_em?: string | null
        }
        Update: {
          associado_id?: string
          canal_envio?: string | null
          codigo?: string
          created_at?: string | null
          expira_em?: string
          id?: string
          ip_solicitante?: string | null
          max_tentativas?: number | null
          tentativas?: number | null
          tipo?: string
          usado?: boolean | null
          usado_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auth_tokens_app_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "associados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auth_tokens_app_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "auth_tokens_app_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "auth_tokens_app_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associado_financeiro"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "auth_tokens_app_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associados_publico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auth_tokens_app_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_inadimplentes"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "auth_tokens_app_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["associado_id"]
          },
        ]
      }
      auth_tokens_primeiro_acesso: {
        Row: {
          associado_id: string
          created_at: string | null
          expira_em: string
          id: string
          token: string
          usado: boolean | null
          usado_em: string | null
        }
        Insert: {
          associado_id: string
          created_at?: string | null
          expira_em: string
          id?: string
          token: string
          usado?: boolean | null
          usado_em?: string | null
        }
        Update: {
          associado_id?: string
          created_at?: string | null
          expira_em?: string
          id?: string
          token?: string
          usado?: boolean | null
          usado_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auth_tokens_primeiro_acesso_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "associados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auth_tokens_primeiro_acesso_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "auth_tokens_primeiro_acesso_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "auth_tokens_primeiro_acesso_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associado_financeiro"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "auth_tokens_primeiro_acesso_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associados_publico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auth_tokens_primeiro_acesso_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_inadimplentes"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "auth_tokens_primeiro_acesso_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["associado_id"]
          },
        ]
      }
      auto_center_pecas: {
        Row: {
          auto_center_id: string
          condicao: string
          created_at: string
          id: string
          nome: string
          tipo_peca: string | null
          valor: number | null
          veiculo_ano: string | null
          veiculo_marca: string | null
          veiculo_modelo: string | null
        }
        Insert: {
          auto_center_id: string
          condicao?: string
          created_at?: string
          id?: string
          nome: string
          tipo_peca?: string | null
          valor?: number | null
          veiculo_ano?: string | null
          veiculo_marca?: string | null
          veiculo_modelo?: string | null
        }
        Update: {
          auto_center_id?: string
          condicao?: string
          created_at?: string
          id?: string
          nome?: string
          tipo_peca?: string | null
          valor?: number | null
          veiculo_ano?: string | null
          veiculo_marca?: string | null
          veiculo_modelo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auto_center_pecas_auto_center_id_fkey"
            columns: ["auto_center_id"]
            isOneToOne: false
            referencedRelation: "auto_centers"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_centers: {
        Row: {
          agencia: string | null
          bairro: string | null
          banco: string | null
          cep: string | null
          cidade: string | null
          cnpj: string | null
          complemento: string | null
          conta: string | null
          contato_email: string | null
          contato_nome: string | null
          contato_telefone: string | null
          created_at: string
          endereco: string | null
          especialidades: string[] | null
          estado: string | null
          id: string
          inscricao_estadual: string | null
          logradouro: string | null
          marcas_atendidas: string[] | null
          nome: string
          nome_fantasia: string | null
          numero: string | null
          observacoes: string | null
          pix_chave: string | null
          pix_tipo: string | null
          razao_social: string | null
          status: string | null
          telefone2: string | null
          tipo: string
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          agencia?: string | null
          bairro?: string | null
          banco?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          complemento?: string | null
          conta?: string | null
          contato_email?: string | null
          contato_nome?: string | null
          contato_telefone?: string | null
          created_at?: string
          endereco?: string | null
          especialidades?: string[] | null
          estado?: string | null
          id?: string
          inscricao_estadual?: string | null
          logradouro?: string | null
          marcas_atendidas?: string[] | null
          nome: string
          nome_fantasia?: string | null
          numero?: string | null
          observacoes?: string | null
          pix_chave?: string | null
          pix_tipo?: string | null
          razao_social?: string | null
          status?: string | null
          telefone2?: string | null
          tipo?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          agencia?: string | null
          bairro?: string | null
          banco?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          complemento?: string | null
          conta?: string | null
          contato_email?: string | null
          contato_nome?: string | null
          contato_telefone?: string | null
          created_at?: string
          endereco?: string | null
          especialidades?: string[] | null
          estado?: string | null
          id?: string
          inscricao_estadual?: string | null
          logradouro?: string | null
          marcas_atendidas?: string[] | null
          nome?: string
          nome_fantasia?: string | null
          numero?: string | null
          observacoes?: string | null
          pix_chave?: string | null
          pix_tipo?: string | null
          razao_social?: string | null
          status?: string | null
          telefone2?: string | null
          tipo?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      avaliacoes: {
        Row: {
          avaliador_id: string
          created_at: string | null
          feedback_funcionario: string | null
          funcionario_id: string
          id: string
          nota_competencias: number | null
          nota_comportamento: number | null
          nota_final: number | null
          nota_resultados: number | null
          periodo_fim: string
          periodo_inicio: string
          plano_desenvolvimento: string | null
          pontos_fortes: string | null
          pontos_melhoria: string | null
          status: string | null
          tipo: string | null
          updated_at: string | null
        }
        Insert: {
          avaliador_id: string
          created_at?: string | null
          feedback_funcionario?: string | null
          funcionario_id: string
          id?: string
          nota_competencias?: number | null
          nota_comportamento?: number | null
          nota_final?: number | null
          nota_resultados?: number | null
          periodo_fim: string
          periodo_inicio: string
          plano_desenvolvimento?: string | null
          pontos_fortes?: string | null
          pontos_melhoria?: string | null
          status?: string | null
          tipo?: string | null
          updated_at?: string | null
        }
        Update: {
          avaliador_id?: string
          created_at?: string | null
          feedback_funcionario?: string | null
          funcionario_id?: string
          id?: string
          nota_competencias?: number | null
          nota_comportamento?: number | null
          nota_final?: number | null
          nota_resultados?: number | null
          periodo_fim?: string
          periodo_inicio?: string
          plano_desenvolvimento?: string | null
          pontos_fortes?: string | null
          pontos_melhoria?: string | null
          status?: string | null
          tipo?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "avaliacoes_avaliador_id_fkey"
            columns: ["avaliador_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacoes_avaliador_id_fkey"
            columns: ["avaliador_id"]
            isOneToOne: false
            referencedRelation: "view_aniversariantes_mes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacoes_avaliador_id_fkey"
            columns: ["avaliador_id"]
            isOneToOne: false
            referencedRelation: "view_funcionarios_ativos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacoes_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacoes_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "view_aniversariantes_mes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacoes_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "view_funcionarios_ativos"
            referencedColumns: ["id"]
          },
        ]
      }
      banco_horas: {
        Row: {
          ano: number
          created_at: string | null
          fechado: boolean | null
          fechado_em: string | null
          fechado_por: string | null
          funcionario_id: string
          horas_compensadas: string | null
          horas_extras: string | null
          id: string
          mes: number
          saldo_anterior: string | null
          saldo_atual: string | null
          updated_at: string | null
        }
        Insert: {
          ano: number
          created_at?: string | null
          fechado?: boolean | null
          fechado_em?: string | null
          fechado_por?: string | null
          funcionario_id: string
          horas_compensadas?: string | null
          horas_extras?: string | null
          id?: string
          mes: number
          saldo_anterior?: string | null
          saldo_atual?: string | null
          updated_at?: string | null
        }
        Update: {
          ano?: number
          created_at?: string | null
          fechado?: boolean | null
          fechado_em?: string | null
          fechado_por?: string | null
          funcionario_id?: string
          horas_compensadas?: string | null
          horas_extras?: string | null
          id?: string
          mes?: number
          saldo_anterior?: string | null
          saldo_atual?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "banco_horas_fechado_por_fkey"
            columns: ["fechado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "banco_horas_fechado_por_fkey"
            columns: ["fechado_por"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "banco_horas_fechado_por_fkey"
            columns: ["fechado_por"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "banco_horas_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "banco_horas_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "view_aniversariantes_mes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "banco_horas_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "view_funcionarios_ativos"
            referencedColumns: ["id"]
          },
        ]
      }
      beneficios: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          descricao: string | null
          fornecedor: string | null
          id: string
          nome: string
          percentual_desconto: number | null
          tipo: string
          valor_empresa: number | null
          valor_funcionario: number | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          descricao?: string | null
          fornecedor?: string | null
          id?: string
          nome: string
          percentual_desconto?: number | null
          tipo: string
          valor_empresa?: number | null
          valor_funcionario?: number | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          descricao?: string | null
          fornecedor?: string | null
          id?: string
          nome?: string
          percentual_desconto?: number | null
          tipo?: string
          valor_empresa?: number | null
          valor_funcionario?: number | null
        }
        Relationships: []
      }
      beneficios_adicionais: {
        Row: {
          ativo: boolean | null
          categoria: string
          codigo: string
          created_at: string | null
          descricao: string | null
          id: string
          linhas_permitidas: string[] | null
          nome: string
          ordem: number | null
          preco: number
          updated_at: string | null
          variacao_por_cota: boolean
        }
        Insert: {
          ativo?: boolean | null
          categoria: string
          codigo: string
          created_at?: string | null
          descricao?: string | null
          id?: string
          linhas_permitidas?: string[] | null
          nome: string
          ordem?: number | null
          preco?: number
          updated_at?: string | null
          variacao_por_cota?: boolean
        }
        Update: {
          ativo?: boolean | null
          categoria?: string
          codigo?: string
          created_at?: string | null
          descricao?: string | null
          id?: string
          linhas_permitidas?: string[] | null
          nome?: string
          ordem?: number | null
          preco?: number
          updated_at?: string | null
          variacao_por_cota?: boolean
        }
        Relationships: []
      }
      beneficios_regioes: {
        Row: {
          ativo: boolean | null
          beneficio_id: string
          created_at: string | null
          id: string
          preco_regional: number | null
          regiao_id: string
        }
        Insert: {
          ativo?: boolean | null
          beneficio_id: string
          created_at?: string | null
          id?: string
          preco_regional?: number | null
          regiao_id: string
        }
        Update: {
          ativo?: boolean | null
          beneficio_id?: string
          created_at?: string | null
          id?: string
          preco_regional?: number | null
          regiao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "beneficios_regioes_beneficio_id_fkey"
            columns: ["beneficio_id"]
            isOneToOne: false
            referencedRelation: "beneficios_adicionais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beneficios_regioes_beneficio_id_fkey"
            columns: ["beneficio_id"]
            isOneToOne: false
            referencedRelation: "vw_custo_real_adicionais"
            referencedColumns: ["beneficio_id"]
          },
          {
            foreignKeyName: "beneficios_regioes_regiao_id_fkey"
            columns: ["regiao_id"]
            isOneToOne: false
            referencedRelation: "regioes"
            referencedColumns: ["id"]
          },
        ]
      }
      benefit_category_exclusions: {
        Row: {
          benefit_id: string
          categoria_veiculo: string
          created_at: string | null
          id: string
        }
        Insert: {
          benefit_id: string
          categoria_veiculo: string
          created_at?: string | null
          id?: string
        }
        Update: {
          benefit_id?: string
          categoria_veiculo?: string
          created_at?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "benefit_category_exclusions_benefit_id_fkey"
            columns: ["benefit_id"]
            isOneToOne: false
            referencedRelation: "benefits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "benefit_category_exclusions_benefit_id_fkey"
            columns: ["benefit_id"]
            isOneToOne: false
            referencedRelation: "vw_custo_real_benefits"
            referencedColumns: ["beneficio_id"]
          },
        ]
      }
      benefits: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          display_order: number | null
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          preco_sugerido: number | null
          slug: string
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          preco_sugerido?: number | null
          slug: string
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          preco_sugerido?: number | null
          slug?: string
        }
        Relationships: []
      }
      blacklist_veiculos: {
        Row: {
          adicionado_por: string | null
          associado_id: string | null
          ativo: boolean
          chassi: string | null
          contrato_id: string | null
          cotacao_id: string | null
          created_at: string
          id: string
          justificativa: string | null
          motivo: string
          placa: string
          removido_em: string | null
          removido_por: string | null
          tipo_reprovacao: Database["public"]["Enums"]["tipo_reprovacao"]
          veiculo_id: string | null
          vistoria_id: string | null
        }
        Insert: {
          adicionado_por?: string | null
          associado_id?: string | null
          ativo?: boolean
          chassi?: string | null
          contrato_id?: string | null
          cotacao_id?: string | null
          created_at?: string
          id?: string
          justificativa?: string | null
          motivo: string
          placa: string
          removido_em?: string | null
          removido_por?: string | null
          tipo_reprovacao: Database["public"]["Enums"]["tipo_reprovacao"]
          veiculo_id?: string | null
          vistoria_id?: string | null
        }
        Update: {
          adicionado_por?: string | null
          associado_id?: string | null
          ativo?: boolean
          chassi?: string | null
          contrato_id?: string | null
          cotacao_id?: string | null
          created_at?: string
          id?: string
          justificativa?: string | null
          motivo?: string
          placa?: string
          removido_em?: string | null
          removido_por?: string | null
          tipo_reprovacao?: Database["public"]["Enums"]["tipo_reprovacao"]
          veiculo_id?: string | null
          vistoria_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blacklist_veiculos_adicionado_por_fkey"
            columns: ["adicionado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blacklist_veiculos_adicionado_por_fkey"
            columns: ["adicionado_por"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "blacklist_veiculos_adicionado_por_fkey"
            columns: ["adicionado_por"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "blacklist_veiculos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "associados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blacklist_veiculos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "blacklist_veiculos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "blacklist_veiculos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associado_financeiro"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "blacklist_veiculos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associados_publico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blacklist_veiculos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_inadimplentes"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "blacklist_veiculos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "blacklist_veiculos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blacklist_veiculos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "blacklist_veiculos_removido_por_fkey"
            columns: ["removido_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blacklist_veiculos_removido_por_fkey"
            columns: ["removido_por"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "blacklist_veiculos_removido_por_fkey"
            columns: ["removido_por"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "blacklist_veiculos_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blacklist_veiculos_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["veiculo_id"]
          },
          {
            foreignKeyName: "blacklist_veiculos_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["veiculo_id"]
          },
          {
            foreignKeyName: "blacklist_veiculos_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["veiculo_id"]
          },
          {
            foreignKeyName: "blacklist_veiculos_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "vw_veiculos_com_cotas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blacklist_veiculos_vistoria_id_fkey"
            columns: ["vistoria_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["vistoria_id"]
          },
          {
            foreignKeyName: "blacklist_veiculos_vistoria_id_fkey"
            columns: ["vistoria_id"]
            isOneToOne: false
            referencedRelation: "vistorias"
            referencedColumns: ["id"]
          },
        ]
      }
      campanhas: {
        Row: {
          canal_id: string | null
          codigo: string | null
          created_at: string | null
          criado_por: string | null
          data_fim: string | null
          data_inicio: string
          id: string
          meta_conversoes: number | null
          meta_cpl: number | null
          meta_leads: number | null
          nome: string
          objetivo: string | null
          observacoes: string | null
          orcamento_diario: number | null
          orcamento_total: number | null
          publico_alvo: string | null
          regioes: string[] | null
          responsavel_id: string | null
          segmentacao: string | null
          status: string | null
          tipo: string
          tipo_anuncio: string | null
          updated_at: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          valor_gasto: number | null
        }
        Insert: {
          canal_id?: string | null
          codigo?: string | null
          created_at?: string | null
          criado_por?: string | null
          data_fim?: string | null
          data_inicio: string
          id?: string
          meta_conversoes?: number | null
          meta_cpl?: number | null
          meta_leads?: number | null
          nome: string
          objetivo?: string | null
          observacoes?: string | null
          orcamento_diario?: number | null
          orcamento_total?: number | null
          publico_alvo?: string | null
          regioes?: string[] | null
          responsavel_id?: string | null
          segmentacao?: string | null
          status?: string | null
          tipo: string
          tipo_anuncio?: string | null
          updated_at?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          valor_gasto?: number | null
        }
        Update: {
          canal_id?: string | null
          codigo?: string | null
          created_at?: string | null
          criado_por?: string | null
          data_fim?: string | null
          data_inicio?: string
          id?: string
          meta_conversoes?: number | null
          meta_cpl?: number | null
          meta_leads?: number | null
          nome?: string
          objetivo?: string | null
          observacoes?: string | null
          orcamento_diario?: number | null
          orcamento_total?: number | null
          publico_alvo?: string | null
          regioes?: string[] | null
          responsavel_id?: string | null
          segmentacao?: string | null
          status?: string | null
          tipo?: string
          tipo_anuncio?: string | null
          updated_at?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          valor_gasto?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "campanhas_canal_id_fkey"
            columns: ["canal_id"]
            isOneToOne: false
            referencedRelation: "canais_marketing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campanhas_canal_id_fkey"
            columns: ["canal_id"]
            isOneToOne: false
            referencedRelation: "view_performance_canais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campanhas_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campanhas_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "campanhas_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "campanhas_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campanhas_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "campanhas_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
        ]
      }
      campanhas_comunicacao: {
        Row: {
          abertos: number | null
          assunto: string | null
          clicados: number | null
          codigo: string | null
          concluido_em: string | null
          conteudo: string | null
          created_at: string | null
          criado_por: string | null
          data_agendamento: string | null
          entregues: number | null
          enviados: number | null
          falhas: number | null
          filtros: Json | null
          id: string
          iniciado_em: string | null
          nome: string
          segmento: string | null
          status: string | null
          template_id: string | null
          tipo: string
          total_destinatarios: number | null
          updated_at: string | null
        }
        Insert: {
          abertos?: number | null
          assunto?: string | null
          clicados?: number | null
          codigo?: string | null
          concluido_em?: string | null
          conteudo?: string | null
          created_at?: string | null
          criado_por?: string | null
          data_agendamento?: string | null
          entregues?: number | null
          enviados?: number | null
          falhas?: number | null
          filtros?: Json | null
          id?: string
          iniciado_em?: string | null
          nome: string
          segmento?: string | null
          status?: string | null
          template_id?: string | null
          tipo: string
          total_destinatarios?: number | null
          updated_at?: string | null
        }
        Update: {
          abertos?: number | null
          assunto?: string | null
          clicados?: number | null
          codigo?: string | null
          concluido_em?: string | null
          conteudo?: string | null
          created_at?: string | null
          criado_por?: string | null
          data_agendamento?: string | null
          entregues?: number | null
          enviados?: number | null
          falhas?: number | null
          filtros?: Json | null
          id?: string
          iniciado_em?: string | null
          nome?: string
          segmento?: string | null
          status?: string | null
          template_id?: string | null
          tipo?: string
          total_destinatarios?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      campanhas_desconto: {
        Row: {
          created_at: string | null
          criado_por: string | null
          data_fim: string
          data_inicio: string
          descricao: string | null
          id: string
          meses_aplicacao: number
          nome: string
          status: string
          tipo_beneficio: string
          updated_at: string | null
          valor_beneficio: number
        }
        Insert: {
          created_at?: string | null
          criado_por?: string | null
          data_fim: string
          data_inicio: string
          descricao?: string | null
          id?: string
          meses_aplicacao?: number
          nome: string
          status?: string
          tipo_beneficio: string
          updated_at?: string | null
          valor_beneficio: number
        }
        Update: {
          created_at?: string | null
          criado_por?: string | null
          data_fim?: string
          data_inicio?: string
          descricao?: string | null
          id?: string
          meses_aplicacao?: number
          nome?: string
          status?: string
          tipo_beneficio?: string
          updated_at?: string | null
          valor_beneficio?: number
        }
        Relationships: [
          {
            foreignKeyName: "campanhas_desconto_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campanhas_desconto_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "campanhas_desconto_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
        ]
      }
      campanhas_metricas: {
        Row: {
          campanha_id: string
          cliques: number | null
          conversoes: number | null
          cpa: number | null
          cpl: number | null
          created_at: string | null
          ctr: number | null
          data: string
          id: string
          impressoes: number | null
          leads: number | null
          taxa_conversao: number | null
          valor_gasto: number | null
        }
        Insert: {
          campanha_id: string
          cliques?: number | null
          conversoes?: number | null
          cpa?: number | null
          cpl?: number | null
          created_at?: string | null
          ctr?: number | null
          data: string
          id?: string
          impressoes?: number | null
          leads?: number | null
          taxa_conversao?: number | null
          valor_gasto?: number | null
        }
        Update: {
          campanha_id?: string
          cliques?: number | null
          conversoes?: number | null
          cpa?: number | null
          cpl?: number | null
          created_at?: string | null
          ctr?: number | null
          data?: string
          id?: string
          impressoes?: number | null
          leads?: number | null
          taxa_conversao?: number | null
          valor_gasto?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "campanhas_metricas_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "campanhas"
            referencedColumns: ["id"]
          },
        ]
      }
      canais_marketing: {
        Row: {
          api_key: string | null
          ativo: boolean | null
          created_at: string | null
          custo_por_lead: number | null
          descricao: string | null
          id: string
          meta_leads_mes: number | null
          nome: string
          tipo: string
          updated_at: string | null
          utm_source_padrao: string | null
          webhook_url: string | null
        }
        Insert: {
          api_key?: string | null
          ativo?: boolean | null
          created_at?: string | null
          custo_por_lead?: number | null
          descricao?: string | null
          id?: string
          meta_leads_mes?: number | null
          nome: string
          tipo: string
          updated_at?: string | null
          utm_source_padrao?: string | null
          webhook_url?: string | null
        }
        Update: {
          api_key?: string | null
          ativo?: boolean | null
          created_at?: string | null
          custo_por_lead?: number | null
          descricao?: string | null
          id?: string
          meta_leads_mes?: number | null
          nome?: string
          tipo?: string
          updated_at?: string | null
          utm_source_padrao?: string | null
          webhook_url?: string | null
        }
        Relationships: []
      }
      candidatos: {
        Row: {
          avaliacao_gestor: string | null
          avaliacao_rh: string | null
          avaliacao_tecnica: string | null
          cpf: string | null
          created_at: string | null
          curriculo_url: string | null
          data_contratacao: string | null
          disponibilidade_inicio: string | null
          email: string | null
          etapa: string | null
          feedback_final: string | null
          funcionario_id: string | null
          id: string
          indicado_por: string | null
          linkedin_url: string | null
          motivo_reprovacao: string | null
          nome: string
          nota_gestor: number | null
          nota_rh: number | null
          nota_tecnica: number | null
          origem: string | null
          portfolio_url: string | null
          pretensao_salarial: number | null
          status_candidato: string | null
          telefone: string | null
          updated_at: string | null
          vaga_id: string
        }
        Insert: {
          avaliacao_gestor?: string | null
          avaliacao_rh?: string | null
          avaliacao_tecnica?: string | null
          cpf?: string | null
          created_at?: string | null
          curriculo_url?: string | null
          data_contratacao?: string | null
          disponibilidade_inicio?: string | null
          email?: string | null
          etapa?: string | null
          feedback_final?: string | null
          funcionario_id?: string | null
          id?: string
          indicado_por?: string | null
          linkedin_url?: string | null
          motivo_reprovacao?: string | null
          nome: string
          nota_gestor?: number | null
          nota_rh?: number | null
          nota_tecnica?: number | null
          origem?: string | null
          portfolio_url?: string | null
          pretensao_salarial?: number | null
          status_candidato?: string | null
          telefone?: string | null
          updated_at?: string | null
          vaga_id: string
        }
        Update: {
          avaliacao_gestor?: string | null
          avaliacao_rh?: string | null
          avaliacao_tecnica?: string | null
          cpf?: string | null
          created_at?: string | null
          curriculo_url?: string | null
          data_contratacao?: string | null
          disponibilidade_inicio?: string | null
          email?: string | null
          etapa?: string | null
          feedback_final?: string | null
          funcionario_id?: string | null
          id?: string
          indicado_por?: string | null
          linkedin_url?: string | null
          motivo_reprovacao?: string | null
          nome?: string
          nota_gestor?: number | null
          nota_rh?: number | null
          nota_tecnica?: number | null
          origem?: string | null
          portfolio_url?: string | null
          pretensao_salarial?: number | null
          status_candidato?: string | null
          telefone?: string | null
          updated_at?: string | null
          vaga_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidatos_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidatos_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "view_aniversariantes_mes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidatos_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "view_funcionarios_ativos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidatos_vaga_id_fkey"
            columns: ["vaga_id"]
            isOneToOne: false
            referencedRelation: "vagas"
            referencedColumns: ["id"]
          },
        ]
      }
      candidatos_historico: {
        Row: {
          candidato_id: string
          created_at: string | null
          etapa_anterior: string | null
          etapa_nova: string
          id: string
          observacao: string | null
          responsavel_id: string | null
        }
        Insert: {
          candidato_id: string
          created_at?: string | null
          etapa_anterior?: string | null
          etapa_nova: string
          id?: string
          observacao?: string | null
          responsavel_id?: string | null
        }
        Update: {
          candidato_id?: string
          created_at?: string | null
          etapa_anterior?: string | null
          etapa_nova?: string
          id?: string
          observacao?: string | null
          responsavel_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "candidatos_historico_candidato_id_fkey"
            columns: ["candidato_id"]
            isOneToOne: false
            referencedRelation: "candidatos"
            referencedColumns: ["id"]
          },
        ]
      }
      cargos: {
        Row: {
          ativo: boolean | null
          cbo: string | null
          created_at: string | null
          departamento_id: string | null
          descricao: string | null
          id: string
          nivel: number | null
          nome: string
          salario_base: number | null
        }
        Insert: {
          ativo?: boolean | null
          cbo?: string | null
          created_at?: string | null
          departamento_id?: string | null
          descricao?: string | null
          id?: string
          nivel?: number | null
          nome: string
          salario_base?: number | null
        }
        Update: {
          ativo?: boolean | null
          cbo?: string | null
          created_at?: string | null
          departamento_id?: string | null
          descricao?: string | null
          id?: string
          nivel?: number | null
          nome?: string
          salario_base?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cargos_departamento_id_fkey"
            columns: ["departamento_id"]
            isOneToOne: false
            referencedRelation: "departamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      caso_juridico_documentos: {
        Row: {
          arquivo_nome: string | null
          arquivo_url: string
          consulta_id: string | null
          created_at: string | null
          id: string
          processo_id: string | null
          registrado_por: string | null
          tipo: string | null
          titulo: string
        }
        Insert: {
          arquivo_nome?: string | null
          arquivo_url: string
          consulta_id?: string | null
          created_at?: string | null
          id?: string
          processo_id?: string | null
          registrado_por?: string | null
          tipo?: string | null
          titulo: string
        }
        Update: {
          arquivo_nome?: string | null
          arquivo_url?: string
          consulta_id?: string | null
          created_at?: string | null
          id?: string
          processo_id?: string | null
          registrado_por?: string | null
          tipo?: string | null
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "caso_juridico_documentos_consulta_id_fkey"
            columns: ["consulta_id"]
            isOneToOne: false
            referencedRelation: "consultas_juridicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caso_juridico_documentos_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caso_juridico_documentos_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caso_juridico_documentos_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "caso_juridico_documentos_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
        ]
      }
      caso_juridico_historico: {
        Row: {
          consulta_id: string | null
          created_at: string | null
          descricao: string | null
          id: string
          processo_id: string | null
          tipo: string
          titulo: string
          usuario_id: string | null
        }
        Insert: {
          consulta_id?: string | null
          created_at?: string | null
          descricao?: string | null
          id?: string
          processo_id?: string | null
          tipo: string
          titulo: string
          usuario_id?: string | null
        }
        Update: {
          consulta_id?: string | null
          created_at?: string | null
          descricao?: string | null
          id?: string
          processo_id?: string | null
          tipo?: string
          titulo?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "caso_juridico_historico_consulta_id_fkey"
            columns: ["consulta_id"]
            isOneToOne: false
            referencedRelation: "consultas_juridicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caso_juridico_historico_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caso_juridico_historico_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caso_juridico_historico_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "caso_juridico_historico_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
        ]
      }
      cc_vendedor_lancamentos: {
        Row: {
          associado_id: string | null
          categoria: string
          contrato_id: string | null
          created_at: string | null
          data_lancamento: string
          data_pagamento: string | null
          debito_volante_ref_id: string | null
          descricao: string
          id: string
          observacao_pagamento: string | null
          pago_por: string | null
          parcela_numero: number | null
          parcela_total: number | null
          saldo_apos: number | null
          status: Database["public"]["Enums"]["cc_status_lancamento"]
          tipo: Database["public"]["Enums"]["cc_tipo_lancamento"]
          updated_at: string | null
          valor_abatimento: number
          valor_bruto: number
          valor_liquido: number
          vendedor_id: string
        }
        Insert: {
          associado_id?: string | null
          categoria: string
          contrato_id?: string | null
          created_at?: string | null
          data_lancamento?: string
          data_pagamento?: string | null
          debito_volante_ref_id?: string | null
          descricao: string
          id?: string
          observacao_pagamento?: string | null
          pago_por?: string | null
          parcela_numero?: number | null
          parcela_total?: number | null
          saldo_apos?: number | null
          status?: Database["public"]["Enums"]["cc_status_lancamento"]
          tipo: Database["public"]["Enums"]["cc_tipo_lancamento"]
          updated_at?: string | null
          valor_abatimento?: number
          valor_bruto?: number
          valor_liquido?: number
          vendedor_id: string
        }
        Update: {
          associado_id?: string | null
          categoria?: string
          contrato_id?: string | null
          created_at?: string | null
          data_lancamento?: string
          data_pagamento?: string | null
          debito_volante_ref_id?: string | null
          descricao?: string
          id?: string
          observacao_pagamento?: string | null
          pago_por?: string | null
          parcela_numero?: number | null
          parcela_total?: number | null
          saldo_apos?: number | null
          status?: Database["public"]["Enums"]["cc_status_lancamento"]
          tipo?: Database["public"]["Enums"]["cc_tipo_lancamento"]
          updated_at?: string | null
          valor_abatimento?: number
          valor_bruto?: number
          valor_liquido?: number
          vendedor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cc_vendedor_lancamentos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "associados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cc_vendedor_lancamentos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "cc_vendedor_lancamentos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "cc_vendedor_lancamentos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associado_financeiro"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "cc_vendedor_lancamentos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associados_publico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cc_vendedor_lancamentos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_inadimplentes"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "cc_vendedor_lancamentos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "cc_vendedor_lancamentos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cc_vendedor_lancamentos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "cc_vendedor_lancamentos_debito_volante_ref_id_fkey"
            columns: ["debito_volante_ref_id"]
            isOneToOne: false
            referencedRelation: "cc_vendedor_lancamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cc_vendedor_lancamentos_pago_por_fkey"
            columns: ["pago_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cc_vendedor_lancamentos_pago_por_fkey"
            columns: ["pago_por"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "cc_vendedor_lancamentos_pago_por_fkey"
            columns: ["pago_por"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "cc_vendedor_lancamentos_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cc_vendedor_lancamentos_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "cc_vendedor_lancamentos_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
        ]
      }
      centros_custo: {
        Row: {
          ativo: boolean | null
          centro_pai_id: string | null
          codigo: string
          created_at: string | null
          descricao: string
          id: string
        }
        Insert: {
          ativo?: boolean | null
          centro_pai_id?: string | null
          codigo: string
          created_at?: string | null
          descricao: string
          id?: string
        }
        Update: {
          ativo?: boolean | null
          centro_pai_id?: string | null
          codigo?: string
          created_at?: string | null
          descricao?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "centros_custo_centro_pai_id_fkey"
            columns: ["centro_pai_id"]
            isOneToOne: false
            referencedRelation: "centros_custo"
            referencedColumns: ["id"]
          },
        ]
      }
      chamados_assistencia: {
        Row: {
          associado_id: string | null
          atendente_id: string | null
          avaliacao_comentario: string | null
          avaliacao_data: string | null
          avaliacao_nota: number | null
          canal: string
          created_at: string
          data_abertura: string
          data_conclusao: string | null
          descricao: string | null
          destino_cep: string | null
          destino_cidade: string | null
          destino_endereco: string | null
          destino_lat: number | null
          destino_lng: number | null
          destino_logradouro: string | null
          destino_uf: string | null
          distancia_percorrida_km: number | null
          id: string
          origem_cep: string | null
          origem_cidade: string | null
          origem_endereco: string | null
          origem_lat: number | null
          origem_lng: number | null
          origem_logradouro: string | null
          origem_uf: string | null
          posicao_final_capturada_em: string | null
          posicao_final_lat: number | null
          posicao_final_lng: number | null
          prestador_id: string | null
          prestador_nome: string | null
          prestador_telefone: string | null
          protocolo: string
          rastreador_endereco: string | null
          rastreador_lat: number | null
          rastreador_lng: number | null
          rastreador_posicao_capturada_em: string | null
          sinistro_id: string | null
          status: Database["public"]["Enums"]["status_chamado"]
          tipo_servico: string
          updated_at: string
          veiculo_id: string | null
        }
        Insert: {
          associado_id?: string | null
          atendente_id?: string | null
          avaliacao_comentario?: string | null
          avaliacao_data?: string | null
          avaliacao_nota?: number | null
          canal?: string
          created_at?: string
          data_abertura?: string
          data_conclusao?: string | null
          descricao?: string | null
          destino_cep?: string | null
          destino_cidade?: string | null
          destino_endereco?: string | null
          destino_lat?: number | null
          destino_lng?: number | null
          destino_logradouro?: string | null
          destino_uf?: string | null
          distancia_percorrida_km?: number | null
          id?: string
          origem_cep?: string | null
          origem_cidade?: string | null
          origem_endereco?: string | null
          origem_lat?: number | null
          origem_lng?: number | null
          origem_logradouro?: string | null
          origem_uf?: string | null
          posicao_final_capturada_em?: string | null
          posicao_final_lat?: number | null
          posicao_final_lng?: number | null
          prestador_id?: string | null
          prestador_nome?: string | null
          prestador_telefone?: string | null
          protocolo: string
          rastreador_endereco?: string | null
          rastreador_lat?: number | null
          rastreador_lng?: number | null
          rastreador_posicao_capturada_em?: string | null
          sinistro_id?: string | null
          status?: Database["public"]["Enums"]["status_chamado"]
          tipo_servico: string
          updated_at?: string
          veiculo_id?: string | null
        }
        Update: {
          associado_id?: string | null
          atendente_id?: string | null
          avaliacao_comentario?: string | null
          avaliacao_data?: string | null
          avaliacao_nota?: number | null
          canal?: string
          created_at?: string
          data_abertura?: string
          data_conclusao?: string | null
          descricao?: string | null
          destino_cep?: string | null
          destino_cidade?: string | null
          destino_endereco?: string | null
          destino_lat?: number | null
          destino_lng?: number | null
          destino_logradouro?: string | null
          destino_uf?: string | null
          distancia_percorrida_km?: number | null
          id?: string
          origem_cep?: string | null
          origem_cidade?: string | null
          origem_endereco?: string | null
          origem_lat?: number | null
          origem_lng?: number | null
          origem_logradouro?: string | null
          origem_uf?: string | null
          posicao_final_capturada_em?: string | null
          posicao_final_lat?: number | null
          posicao_final_lng?: number | null
          prestador_id?: string | null
          prestador_nome?: string | null
          prestador_telefone?: string | null
          protocolo?: string
          rastreador_endereco?: string | null
          rastreador_lat?: number | null
          rastreador_lng?: number | null
          rastreador_posicao_capturada_em?: string | null
          sinistro_id?: string | null
          status?: Database["public"]["Enums"]["status_chamado"]
          tipo_servico?: string
          updated_at?: string
          veiculo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chamados_assistencia_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "associados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamados_assistencia_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "chamados_assistencia_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "chamados_assistencia_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associado_financeiro"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "chamados_assistencia_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associados_publico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamados_assistencia_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_inadimplentes"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "chamados_assistencia_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "chamados_assistencia_atendente_id_fkey"
            columns: ["atendente_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamados_assistencia_atendente_id_fkey"
            columns: ["atendente_id"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "chamados_assistencia_atendente_id_fkey"
            columns: ["atendente_id"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "chamados_assistencia_prestador_id_fkey"
            columns: ["prestador_id"]
            isOneToOne: false
            referencedRelation: "prestadores_assistencia"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamados_assistencia_sinistro_id_fkey"
            columns: ["sinistro_id"]
            isOneToOne: false
            referencedRelation: "sinistros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamados_assistencia_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamados_assistencia_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["veiculo_id"]
          },
          {
            foreignKeyName: "chamados_assistencia_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["veiculo_id"]
          },
          {
            foreignKeyName: "chamados_assistencia_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["veiculo_id"]
          },
          {
            foreignKeyName: "chamados_assistencia_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "vw_veiculos_com_cotas"
            referencedColumns: ["id"]
          },
        ]
      }
      chamados_assistencia_atendimentos: {
        Row: {
          chamado_id: string
          created_at: string | null
          hora_aceite: string | null
          hora_acionamento: string | null
          hora_chegada: string | null
          hora_conclusao: string | null
          id: string
          km_extra: number | null
          km_origem_destino: number | null
          motivo_recusa: string | null
          observacao: string | null
          prestador_id: string | null
          status: string | null
          valor_km_extra: number | null
          valor_servico: number | null
          valor_total: number | null
        }
        Insert: {
          chamado_id: string
          created_at?: string | null
          hora_aceite?: string | null
          hora_acionamento?: string | null
          hora_chegada?: string | null
          hora_conclusao?: string | null
          id?: string
          km_extra?: number | null
          km_origem_destino?: number | null
          motivo_recusa?: string | null
          observacao?: string | null
          prestador_id?: string | null
          status?: string | null
          valor_km_extra?: number | null
          valor_servico?: number | null
          valor_total?: number | null
        }
        Update: {
          chamado_id?: string
          created_at?: string | null
          hora_aceite?: string | null
          hora_acionamento?: string | null
          hora_chegada?: string | null
          hora_conclusao?: string | null
          id?: string
          km_extra?: number | null
          km_origem_destino?: number | null
          motivo_recusa?: string | null
          observacao?: string | null
          prestador_id?: string | null
          status?: string | null
          valor_km_extra?: number | null
          valor_servico?: number | null
          valor_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "chamados_assistencia_atendimentos_chamado_id_fkey"
            columns: ["chamado_id"]
            isOneToOne: false
            referencedRelation: "chamados_assistencia"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamados_assistencia_atendimentos_prestador_id_fkey"
            columns: ["prestador_id"]
            isOneToOne: false
            referencedRelation: "prestadores_assistencia"
            referencedColumns: ["id"]
          },
        ]
      }
      chamados_assistencia_historico: {
        Row: {
          chamado_id: string
          created_at: string | null
          id: string
          latitude: number | null
          longitude: number | null
          observacao: string | null
          posicao_fonte: string | null
          status_anterior: string | null
          status_novo: string
          usuario_id: string | null
        }
        Insert: {
          chamado_id: string
          created_at?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          observacao?: string | null
          posicao_fonte?: string | null
          status_anterior?: string | null
          status_novo: string
          usuario_id?: string | null
        }
        Update: {
          chamado_id?: string
          created_at?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          observacao?: string | null
          posicao_fonte?: string | null
          status_anterior?: string | null
          status_novo?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chamados_assistencia_historico_chamado_id_fkey"
            columns: ["chamado_id"]
            isOneToOne: false
            referencedRelation: "chamados_assistencia"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamados_assistencia_historico_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamados_assistencia_historico_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "chamados_assistencia_historico_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
        ]
      }
      chat_mensagens_ia: {
        Row: {
          associado_id: string
          content: string
          created_at: string
          id: string
          metadata: Json | null
          role: string
        }
        Insert: {
          associado_id: string
          content: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role: string
        }
        Update: {
          associado_id?: string
          content?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_mensagens_ia_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "associados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_mensagens_ia_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "chat_mensagens_ia_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "chat_mensagens_ia_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associado_financeiro"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "chat_mensagens_ia_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associados_publico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_mensagens_ia_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_inadimplentes"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "chat_mensagens_ia_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["associado_id"]
          },
        ]
      }
      chat_solicitacoes_ia: {
        Row: {
          aprovado_em: string | null
          aprovador_id: string | null
          associado_id: string
          created_at: string
          criado_por: string | null
          dados: Json
          dados_novo_titular: Json | null
          id: string
          motivo_rejeicao: string | null
          resultado_id: string | null
          status: string
          tipo: string
          updated_at: string
        }
        Insert: {
          aprovado_em?: string | null
          aprovador_id?: string | null
          associado_id: string
          created_at?: string
          criado_por?: string | null
          dados: Json
          dados_novo_titular?: Json | null
          id?: string
          motivo_rejeicao?: string | null
          resultado_id?: string | null
          status?: string
          tipo: string
          updated_at?: string
        }
        Update: {
          aprovado_em?: string | null
          aprovador_id?: string | null
          associado_id?: string
          created_at?: string
          criado_por?: string | null
          dados?: Json
          dados_novo_titular?: Json | null
          id?: string
          motivo_rejeicao?: string | null
          resultado_id?: string | null
          status?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_solicitacoes_ia_aprovador_id_fkey"
            columns: ["aprovador_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_solicitacoes_ia_aprovador_id_fkey"
            columns: ["aprovador_id"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "chat_solicitacoes_ia_aprovador_id_fkey"
            columns: ["aprovador_id"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "chat_solicitacoes_ia_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "associados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_solicitacoes_ia_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "chat_solicitacoes_ia_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "chat_solicitacoes_ia_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associado_financeiro"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "chat_solicitacoes_ia_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associados_publico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_solicitacoes_ia_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_inadimplentes"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "chat_solicitacoes_ia_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["associado_id"]
          },
        ]
      }
      coberturas: {
        Row: {
          ativo: boolean | null
          carencia_dias: number | null
          codigo: string
          created_at: string | null
          descricao: string | null
          franquia_percentual: number | null
          franquia_valor: number | null
          id: string
          nome: string
          percentual_cobertura: number | null
          tipo: string
          valor_limite: number | null
        }
        Insert: {
          ativo?: boolean | null
          carencia_dias?: number | null
          codigo: string
          created_at?: string | null
          descricao?: string | null
          franquia_percentual?: number | null
          franquia_valor?: number | null
          id?: string
          nome: string
          percentual_cobertura?: number | null
          tipo: string
          valor_limite?: number | null
        }
        Update: {
          ativo?: boolean | null
          carencia_dias?: number | null
          codigo?: string
          created_at?: string | null
          descricao?: string | null
          franquia_percentual?: number | null
          franquia_valor?: number | null
          id?: string
          nome?: string
          percentual_cobertura?: number | null
          tipo?: string
          valor_limite?: number | null
        }
        Relationships: []
      }
      cobranca_contatos: {
        Row: {
          associado_id: string
          atendente_id: string | null
          cobranca_id: string | null
          created_at: string | null
          duracao_segundos: number | null
          id: string
          observacao: string | null
          promessa_data: string | null
          promessa_valor: number | null
          resultado: string
          tipo: string
        }
        Insert: {
          associado_id: string
          atendente_id?: string | null
          cobranca_id?: string | null
          created_at?: string | null
          duracao_segundos?: number | null
          id?: string
          observacao?: string | null
          promessa_data?: string | null
          promessa_valor?: number | null
          resultado: string
          tipo: string
        }
        Update: {
          associado_id?: string
          atendente_id?: string | null
          cobranca_id?: string | null
          created_at?: string | null
          duracao_segundos?: number | null
          id?: string
          observacao?: string | null
          promessa_data?: string | null
          promessa_valor?: number | null
          resultado?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "cobranca_contatos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "associados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobranca_contatos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "cobranca_contatos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "cobranca_contatos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associado_financeiro"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "cobranca_contatos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associados_publico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobranca_contatos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_inadimplentes"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "cobranca_contatos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "cobranca_contatos_cobranca_id_fkey"
            columns: ["cobranca_id"]
            isOneToOne: false
            referencedRelation: "cobrancas"
            referencedColumns: ["id"]
          },
        ]
      }
      cobranca_eventos: {
        Row: {
          associado_id: string
          automatico: boolean | null
          created_at: string | null
          criado_por: string | null
          dados: Json | null
          descricao: string
          id: string
          subtipo: string | null
          tipo: string
        }
        Insert: {
          associado_id: string
          automatico?: boolean | null
          created_at?: string | null
          criado_por?: string | null
          dados?: Json | null
          descricao: string
          id?: string
          subtipo?: string | null
          tipo: string
        }
        Update: {
          associado_id?: string
          automatico?: boolean | null
          created_at?: string | null
          criado_por?: string | null
          dados?: Json | null
          descricao?: string
          id?: string
          subtipo?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "cobranca_eventos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "associados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobranca_eventos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "cobranca_eventos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "cobranca_eventos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associado_financeiro"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "cobranca_eventos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associados_publico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobranca_eventos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_inadimplentes"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "cobranca_eventos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "cobranca_eventos_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobranca_eventos_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "cobranca_eventos_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
        ]
      }
      cobranca_fila: {
        Row: {
          associado_id: string
          atribuido_para: string | null
          cobranca_id: string | null
          concluido_em: string | null
          created_at: string | null
          data_agendamento: string | null
          id: string
          motivo: string
          prioridade: number | null
          resultado: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          associado_id: string
          atribuido_para?: string | null
          cobranca_id?: string | null
          concluido_em?: string | null
          created_at?: string | null
          data_agendamento?: string | null
          id?: string
          motivo: string
          prioridade?: number | null
          resultado?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          associado_id?: string
          atribuido_para?: string | null
          cobranca_id?: string | null
          concluido_em?: string | null
          created_at?: string | null
          data_agendamento?: string | null
          id?: string
          motivo?: string
          prioridade?: number | null
          resultado?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cobranca_fila_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "associados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobranca_fila_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "cobranca_fila_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "cobranca_fila_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associado_financeiro"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "cobranca_fila_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associados_publico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobranca_fila_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_inadimplentes"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "cobranca_fila_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "cobranca_fila_cobranca_id_fkey"
            columns: ["cobranca_id"]
            isOneToOne: false
            referencedRelation: "cobrancas"
            referencedColumns: ["id"]
          },
        ]
      }
      cobrancas: {
        Row: {
          associado_id: string
          boleto_url: string | null
          cancelado_por: string | null
          codigo_barras: string | null
          comprovante_url: string | null
          contrato_id: string | null
          created_at: string
          criado_por: string | null
          data_emissao: string
          data_pagamento: string | null
          data_vencimento: string
          desconto: number | null
          descricao: string | null
          forma_pagamento: string | null
          id: string
          juros: number | null
          linha_digitavel: string | null
          motivo_cancelamento: string | null
          multa: number | null
          nosso_numero: string | null
          pix_copia_cola: string | null
          pix_expiracao: string | null
          pix_qrcode: string | null
          referencia_ano: number | null
          referencia_mes: number | null
          status: string
          tipo: string
          updated_at: string
          valor: number
          valor_final: number
          valor_pago: number | null
          veiculo_id: string | null
        }
        Insert: {
          associado_id: string
          boleto_url?: string | null
          cancelado_por?: string | null
          codigo_barras?: string | null
          comprovante_url?: string | null
          contrato_id?: string | null
          created_at?: string
          criado_por?: string | null
          data_emissao?: string
          data_pagamento?: string | null
          data_vencimento: string
          desconto?: number | null
          descricao?: string | null
          forma_pagamento?: string | null
          id?: string
          juros?: number | null
          linha_digitavel?: string | null
          motivo_cancelamento?: string | null
          multa?: number | null
          nosso_numero?: string | null
          pix_copia_cola?: string | null
          pix_expiracao?: string | null
          pix_qrcode?: string | null
          referencia_ano?: number | null
          referencia_mes?: number | null
          status?: string
          tipo: string
          updated_at?: string
          valor: number
          valor_final: number
          valor_pago?: number | null
          veiculo_id?: string | null
        }
        Update: {
          associado_id?: string
          boleto_url?: string | null
          cancelado_por?: string | null
          codigo_barras?: string | null
          comprovante_url?: string | null
          contrato_id?: string | null
          created_at?: string
          criado_por?: string | null
          data_emissao?: string
          data_pagamento?: string | null
          data_vencimento?: string
          desconto?: number | null
          descricao?: string | null
          forma_pagamento?: string | null
          id?: string
          juros?: number | null
          linha_digitavel?: string | null
          motivo_cancelamento?: string | null
          multa?: number | null
          nosso_numero?: string | null
          pix_copia_cola?: string | null
          pix_expiracao?: string | null
          pix_qrcode?: string | null
          referencia_ano?: number | null
          referencia_mes?: number | null
          status?: string
          tipo?: string
          updated_at?: string
          valor?: number
          valor_final?: number
          valor_pago?: number | null
          veiculo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cobrancas_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "associados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobrancas_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "cobrancas_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "cobrancas_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associado_financeiro"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "cobrancas_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associados_publico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobrancas_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_inadimplentes"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "cobrancas_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "cobrancas_cancelado_por_fkey"
            columns: ["cancelado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobrancas_cancelado_por_fkey"
            columns: ["cancelado_por"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "cobrancas_cancelado_por_fkey"
            columns: ["cancelado_por"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "cobrancas_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobrancas_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "cobrancas_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobrancas_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "cobrancas_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "cobrancas_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobrancas_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["veiculo_id"]
          },
          {
            foreignKeyName: "cobrancas_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["veiculo_id"]
          },
          {
            foreignKeyName: "cobrancas_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["veiculo_id"]
          },
          {
            foreignKeyName: "cobrancas_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "vw_veiculos_com_cotas"
            referencedColumns: ["id"]
          },
        ]
      }
      cobrancas_composicao: {
        Row: {
          cobranca_id: string
          created_at: string | null
          data_fim_vigencia: string | null
          data_inicio_vigencia: string | null
          dias_ativos: number | null
          faixa_id: string | null
          fator_prorata: number | null
          id: string
          quantidade_cotas: number | null
          valor_adicionais: number | null
          valor_adicionais_detalhes: Json | null
          valor_fipe: number | null
          valor_rateio_assistencia: number | null
          valor_rateio_colisao: number | null
          valor_rateio_incendio: number | null
          valor_rateio_roubo_furto: number | null
          valor_rateio_terceiros: number | null
          valor_rateio_vidros: number | null
          valor_taxa_administrativa: number | null
          veiculo_id: string | null
        }
        Insert: {
          cobranca_id: string
          created_at?: string | null
          data_fim_vigencia?: string | null
          data_inicio_vigencia?: string | null
          dias_ativos?: number | null
          faixa_id?: string | null
          fator_prorata?: number | null
          id?: string
          quantidade_cotas?: number | null
          valor_adicionais?: number | null
          valor_adicionais_detalhes?: Json | null
          valor_fipe?: number | null
          valor_rateio_assistencia?: number | null
          valor_rateio_colisao?: number | null
          valor_rateio_incendio?: number | null
          valor_rateio_roubo_furto?: number | null
          valor_rateio_terceiros?: number | null
          valor_rateio_vidros?: number | null
          valor_taxa_administrativa?: number | null
          veiculo_id?: string | null
        }
        Update: {
          cobranca_id?: string
          created_at?: string | null
          data_fim_vigencia?: string | null
          data_inicio_vigencia?: string | null
          dias_ativos?: number | null
          faixa_id?: string | null
          fator_prorata?: number | null
          id?: string
          quantidade_cotas?: number | null
          valor_adicionais?: number | null
          valor_adicionais_detalhes?: Json | null
          valor_fipe?: number | null
          valor_rateio_assistencia?: number | null
          valor_rateio_colisao?: number | null
          valor_rateio_incendio?: number | null
          valor_rateio_roubo_furto?: number | null
          valor_rateio_terceiros?: number | null
          valor_rateio_vidros?: number | null
          valor_taxa_administrativa?: number | null
          veiculo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cobrancas_composicao_cobranca_id_fkey"
            columns: ["cobranca_id"]
            isOneToOne: false
            referencedRelation: "asaas_cobrancas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobrancas_composicao_faixa_id_fkey"
            columns: ["faixa_id"]
            isOneToOne: false
            referencedRelation: "faixas_cotas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobrancas_composicao_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobrancas_composicao_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["veiculo_id"]
          },
          {
            foreignKeyName: "cobrancas_composicao_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["veiculo_id"]
          },
          {
            foreignKeyName: "cobrancas_composicao_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["veiculo_id"]
          },
          {
            foreignKeyName: "cobrancas_composicao_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "vw_veiculos_com_cotas"
            referencedColumns: ["id"]
          },
        ]
      }
      comissao_plano_nivel: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nivel_nome: string
          parcelas: number
          plano_id: string
          tipo_comissao: string
          updated_at: string
          valor: number
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nivel_nome: string
          parcelas?: number
          plano_id: string
          tipo_comissao?: string
          updated_at?: string
          valor?: number
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nivel_nome?: string
          parcelas?: number
          plano_id?: string
          tipo_comissao?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "comissao_plano_nivel_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "planos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comissao_plano_nivel_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "vw_plans_compat"
            referencedColumns: ["id"]
          },
        ]
      }
      comissoes: {
        Row: {
          ano_referencia: number
          aprovado_em: string | null
          aprovado_por: string | null
          associado_id: string | null
          bonus_meta: number | null
          campanha_id: string | null
          cobranca_id: string | null
          config_id: string | null
          contestacao_motivo: string | null
          contestacao_resposta: string | null
          contestada: boolean | null
          contestada_em: string | null
          contrato_id: string
          created_at: string
          deducoes_detalhes: Json | null
          id: string
          mes_referencia: number
          observacoes: string | null
          pago_em: string | null
          percentual_aplicado: number
          recalculada: boolean | null
          recalculada_em: string | null
          recalculada_motivo: string | null
          status: string
          tipo_comissao: string | null
          updated_at: string
          valor_base: number
          valor_bruto: number | null
          valor_comissao: number
          valor_deducoes: number | null
          valor_total: number
          vendedor_id: string
        }
        Insert: {
          ano_referencia: number
          aprovado_em?: string | null
          aprovado_por?: string | null
          associado_id?: string | null
          bonus_meta?: number | null
          campanha_id?: string | null
          cobranca_id?: string | null
          config_id?: string | null
          contestacao_motivo?: string | null
          contestacao_resposta?: string | null
          contestada?: boolean | null
          contestada_em?: string | null
          contrato_id: string
          created_at?: string
          deducoes_detalhes?: Json | null
          id?: string
          mes_referencia: number
          observacoes?: string | null
          pago_em?: string | null
          percentual_aplicado?: number
          recalculada?: boolean | null
          recalculada_em?: string | null
          recalculada_motivo?: string | null
          status?: string
          tipo_comissao?: string | null
          updated_at?: string
          valor_base?: number
          valor_bruto?: number | null
          valor_comissao?: number
          valor_deducoes?: number | null
          valor_total?: number
          vendedor_id: string
        }
        Update: {
          ano_referencia?: number
          aprovado_em?: string | null
          aprovado_por?: string | null
          associado_id?: string | null
          bonus_meta?: number | null
          campanha_id?: string | null
          cobranca_id?: string | null
          config_id?: string | null
          contestacao_motivo?: string | null
          contestacao_resposta?: string | null
          contestada?: boolean | null
          contestada_em?: string | null
          contrato_id?: string
          created_at?: string
          deducoes_detalhes?: Json | null
          id?: string
          mes_referencia?: number
          observacoes?: string | null
          pago_em?: string | null
          percentual_aplicado?: number
          recalculada?: boolean | null
          recalculada_em?: string | null
          recalculada_motivo?: string | null
          status?: string
          tipo_comissao?: string | null
          updated_at?: string
          valor_base?: number
          valor_bruto?: number | null
          valor_comissao?: number
          valor_deducoes?: number | null
          valor_total?: number
          vendedor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comissoes_aprovado_por_fkey"
            columns: ["aprovado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comissoes_aprovado_por_fkey"
            columns: ["aprovado_por"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "comissoes_aprovado_por_fkey"
            columns: ["aprovado_por"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "comissoes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "associados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comissoes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "comissoes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "comissoes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associado_financeiro"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "comissoes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associados_publico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comissoes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_inadimplentes"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "comissoes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "comissoes_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "comissoes_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comissoes_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: true
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comissoes_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: true
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "comissoes_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comissoes_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "comissoes_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
        ]
      }
      comissoes_auditoria: {
        Row: {
          acao: string
          created_at: string
          dados_anteriores: Json | null
          dados_novos: Json | null
          id: string
          ip_address: string | null
          registro_id: string
          tabela: string
          usuario_id: string | null
        }
        Insert: {
          acao: string
          created_at?: string
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          id?: string
          ip_address?: string | null
          registro_id: string
          tabela: string
          usuario_id?: string | null
        }
        Update: {
          acao?: string
          created_at?: string
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          id?: string
          ip_address?: string | null
          registro_id?: string
          tabela?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comissoes_auditoria_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comissoes_auditoria_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "comissoes_auditoria_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
        ]
      }
      comissoes_campanhas: {
        Row: {
          ano: number
          created_at: string
          data_apuracao_boletos: string | null
          data_fim: string
          data_inicio: string
          data_pagamento_1a_fase: string | null
          data_pagamento_descontos: string | null
          fechada_em: string | null
          fechada_por: string | null
          id: string
          mes: number
          nome: string
          status: string
          total_comissoes_geradas: number | null
          total_vendas_confirmadas: number | null
          updated_at: string
        }
        Insert: {
          ano: number
          created_at?: string
          data_apuracao_boletos?: string | null
          data_fim: string
          data_inicio: string
          data_pagamento_1a_fase?: string | null
          data_pagamento_descontos?: string | null
          fechada_em?: string | null
          fechada_por?: string | null
          id?: string
          mes: number
          nome: string
          status?: string
          total_comissoes_geradas?: number | null
          total_vendas_confirmadas?: number | null
          updated_at?: string
        }
        Update: {
          ano?: number
          created_at?: string
          data_apuracao_boletos?: string | null
          data_fim?: string
          data_inicio?: string
          data_pagamento_1a_fase?: string | null
          data_pagamento_descontos?: string | null
          fechada_em?: string | null
          fechada_por?: string | null
          id?: string
          mes?: number
          nome?: string
          status?: string
          total_comissoes_geradas?: number | null
          total_vendas_confirmadas?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comissoes_campanhas_fechada_por_fkey"
            columns: ["fechada_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comissoes_campanhas_fechada_por_fkey"
            columns: ["fechada_por"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "comissoes_campanhas_fechada_por_fkey"
            columns: ["fechada_por"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
        ]
      }
      comissoes_config: {
        Row: {
          ativo: boolean
          base_calculo: string
          bonus_meta_atingida: number | null
          bonus_meta_superada: number | null
          created_at: string
          id: string
          nome: string
          percentual_base: number
          tipo_calculo: string
          tipo_vendedor: string
          updated_at: string
          valor_maximo: number | null
          valor_minimo: number | null
        }
        Insert: {
          ativo?: boolean
          base_calculo?: string
          bonus_meta_atingida?: number | null
          bonus_meta_superada?: number | null
          created_at?: string
          id?: string
          nome: string
          percentual_base?: number
          tipo_calculo?: string
          tipo_vendedor?: string
          updated_at?: string
          valor_maximo?: number | null
          valor_minimo?: number | null
        }
        Update: {
          ativo?: boolean
          base_calculo?: string
          bonus_meta_atingida?: number | null
          bonus_meta_superada?: number | null
          created_at?: string
          id?: string
          nome?: string
          percentual_base?: number
          tipo_calculo?: string
          tipo_vendedor?: string
          updated_at?: string
          valor_maximo?: number | null
          valor_minimo?: number | null
        }
        Relationships: []
      }
      comissoes_crescimento_log: {
        Row: {
          campanha_id: string | null
          created_at: string
          data_atingido: string
          id: string
          marco_placas: number
          percentual_recorrente_garantido: number
          valor_pago: number
          vendedor_id: string
        }
        Insert: {
          campanha_id?: string | null
          created_at?: string
          data_atingido?: string
          id?: string
          marco_placas: number
          percentual_recorrente_garantido?: number
          valor_pago: number
          vendedor_id: string
        }
        Update: {
          campanha_id?: string | null
          created_at?: string
          data_atingido?: string
          id?: string
          marco_placas?: number
          percentual_recorrente_garantido?: number
          valor_pago?: number
          vendedor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comissoes_crescimento_log_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "comissoes_campanhas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comissoes_crescimento_log_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comissoes_crescimento_log_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "comissoes_crescimento_log_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
        ]
      }
      comissoes_deducoes: {
        Row: {
          aplicada_em: string
          associado_id: string | null
          campanha_id: string | null
          cobranca_id: string | null
          comissao_id: string | null
          contrato_id: string | null
          created_at: string
          descricao: string | null
          id: string
          tipo: string
          valor: number
          vendedor_id: string
        }
        Insert: {
          aplicada_em?: string
          associado_id?: string | null
          campanha_id?: string | null
          cobranca_id?: string | null
          comissao_id?: string | null
          contrato_id?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          tipo: string
          valor: number
          vendedor_id: string
        }
        Update: {
          aplicada_em?: string
          associado_id?: string | null
          campanha_id?: string | null
          cobranca_id?: string | null
          comissao_id?: string | null
          contrato_id?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          tipo?: string
          valor?: number
          vendedor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comissoes_deducoes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "associados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comissoes_deducoes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "comissoes_deducoes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "comissoes_deducoes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associado_financeiro"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "comissoes_deducoes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associados_publico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comissoes_deducoes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_inadimplentes"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "comissoes_deducoes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "comissoes_deducoes_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "comissoes_campanhas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comissoes_deducoes_comissao_id_fkey"
            columns: ["comissao_id"]
            isOneToOne: false
            referencedRelation: "comissoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comissoes_deducoes_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comissoes_deducoes_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "comissoes_deducoes_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comissoes_deducoes_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "comissoes_deducoes_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
        ]
      }
      comissoes_faixas_adesao: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          percentual_adesao: number
          quantidade_vendas_minima: number
          tipo_consultor: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          percentual_adesao: number
          quantidade_vendas_minima: number
          tipo_consultor?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          percentual_adesao?: number
          quantidade_vendas_minima?: number
          tipo_consultor?: string
          updated_at?: string
        }
        Relationships: []
      }
      comissoes_faixas_classificacao: {
        Row: {
          ativo: boolean
          categoria_tempo: string
          created_at: string
          faixa_placas_base: number
          id: string
          posicao_ranking: number
          tipo_consultor: string
          updated_at: string
          valor_premio: number
        }
        Insert: {
          ativo?: boolean
          categoria_tempo?: string
          created_at?: string
          faixa_placas_base: number
          id?: string
          posicao_ranking: number
          tipo_consultor: string
          updated_at?: string
          valor_premio: number
        }
        Update: {
          ativo?: boolean
          categoria_tempo?: string
          created_at?: string
          faixa_placas_base?: number
          id?: string
          posicao_ranking?: number
          tipo_consultor?: string
          updated_at?: string
          valor_premio?: number
        }
        Relationships: []
      }
      comissoes_faixas_crescimento: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          percentual_minimo_recorrente: number
          placas_confirmadas: number
          tipo_consultor: string
          updated_at: string
          valor_remuneracao: number
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          percentual_minimo_recorrente?: number
          placas_confirmadas: number
          tipo_consultor?: string
          updated_at?: string
          valor_remuneracao: number
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          percentual_minimo_recorrente?: number
          placas_confirmadas?: number
          tipo_consultor?: string
          updated_at?: string
          valor_remuneracao?: number
        }
        Relationships: []
      }
      comissoes_faixas_producao: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          placas_confirmadas_minima: number
          tipo_consultor: string
          updated_at: string
          valor_remuneracao: number
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          placas_confirmadas_minima: number
          tipo_consultor?: string
          updated_at?: string
          valor_remuneracao: number
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          placas_confirmadas_minima?: number
          tipo_consultor?: string
          updated_at?: string
          valor_remuneracao?: number
        }
        Relationships: []
      }
      comissoes_faixas_recorrente: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          percentual_recorrente: number
          placas_maxima: number | null
          placas_minima: number
          tipo_consultor: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          percentual_recorrente: number
          placas_maxima?: number | null
          placas_minima: number
          tipo_consultor: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          percentual_recorrente?: number
          placas_maxima?: number | null
          placas_minima?: number
          tipo_consultor?: string
          updated_at?: string
        }
        Relationships: []
      }
      comissoes_pagamentos: {
        Row: {
          ano_referencia: number
          comprovante_url: string | null
          created_at: string
          data_pagamento: string
          id: string
          mes_referencia: number
          observacoes: string | null
          quantidade_comissoes: number
          valor_total: number
          vendedor_id: string
        }
        Insert: {
          ano_referencia: number
          comprovante_url?: string | null
          created_at?: string
          data_pagamento?: string
          id?: string
          mes_referencia: number
          observacoes?: string | null
          quantidade_comissoes?: number
          valor_total?: number
          vendedor_id: string
        }
        Update: {
          ano_referencia?: number
          comprovante_url?: string | null
          created_at?: string
          data_pagamento?: string
          id?: string
          mes_referencia?: number
          observacoes?: string | null
          quantidade_comissoes?: number
          valor_total?: number
          vendedor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comissoes_pagamentos_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comissoes_pagamentos_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "comissoes_pagamentos_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
        ]
      }
      comissoes_parametros: {
        Row: {
          ativo: boolean
          chave: string
          descricao: string | null
          id: string
          tipo_dado: string
          updated_at: string
          updated_by: string | null
          valor: string
        }
        Insert: {
          ativo?: boolean
          chave: string
          descricao?: string | null
          id?: string
          tipo_dado?: string
          updated_at?: string
          updated_by?: string | null
          valor: string
        }
        Update: {
          ativo?: boolean
          chave?: string
          descricao?: string | null
          id?: string
          tipo_dado?: string
          updated_at?: string
          updated_by?: string | null
          valor?: string
        }
        Relationships: [
          {
            foreignKeyName: "comissoes_parametros_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comissoes_parametros_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "comissoes_parametros_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
        ]
      }
      comissoes_ranking_mensal: {
        Row: {
          campanha_id: string
          categoria_tempo: string
          created_at: string
          id: string
          placas_ativas: number
          posicao_ranking: number | null
          tipo_consultor: string
          trocas_titularidade: number
          updated_at: string
          valor_premio: number | null
          vendas_canceladas: number
          vendas_confirmadas: number
          vendas_liquidas: number
          vendedor_id: string
        }
        Insert: {
          campanha_id: string
          categoria_tempo: string
          created_at?: string
          id?: string
          placas_ativas?: number
          posicao_ranking?: number | null
          tipo_consultor: string
          trocas_titularidade?: number
          updated_at?: string
          valor_premio?: number | null
          vendas_canceladas?: number
          vendas_confirmadas?: number
          vendas_liquidas?: number
          vendedor_id: string
        }
        Update: {
          campanha_id?: string
          categoria_tempo?: string
          created_at?: string
          id?: string
          placas_ativas?: number
          posicao_ranking?: number | null
          tipo_consultor?: string
          trocas_titularidade?: number
          updated_at?: string
          valor_premio?: number | null
          vendas_canceladas?: number
          vendas_confirmadas?: number
          vendas_liquidas?: number
          vendedor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comissoes_ranking_mensal_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "comissoes_campanhas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comissoes_ranking_mensal_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comissoes_ranking_mensal_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "comissoes_ranking_mensal_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
        ]
      }
      comissoes_recorrentes: {
        Row: {
          ano_referencia: number
          campanha_id: string | null
          created_at: string
          id: string
          mes_referencia: number
          percentual_aplicado: number
          placas_ativas: number
          status: string
          total_boletos_pagos: number
          updated_at: string
          valor_recorrente: number
          vendedor_id: string
        }
        Insert: {
          ano_referencia: number
          campanha_id?: string | null
          created_at?: string
          id?: string
          mes_referencia: number
          percentual_aplicado?: number
          placas_ativas?: number
          status?: string
          total_boletos_pagos?: number
          updated_at?: string
          valor_recorrente?: number
          vendedor_id: string
        }
        Update: {
          ano_referencia?: number
          campanha_id?: string | null
          created_at?: string
          id?: string
          mes_referencia?: number
          percentual_aplicado?: number
          placas_ativas?: number
          status?: string
          total_boletos_pagos?: number
          updated_at?: string
          valor_recorrente?: number
          vendedor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comissoes_recorrentes_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "comissoes_campanhas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comissoes_recorrentes_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comissoes_recorrentes_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "comissoes_recorrentes_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
        ]
      }
      configuracoes: {
        Row: {
          categoria: string
          chave: string
          descricao: string | null
          editavel: boolean | null
          id: string
          tipo: string
          updated_at: string | null
          updated_by: string | null
          valor: string
        }
        Insert: {
          categoria: string
          chave: string
          descricao?: string | null
          editavel?: boolean | null
          id?: string
          tipo: string
          updated_at?: string | null
          updated_by?: string | null
          valor: string
        }
        Update: {
          categoria?: string
          chave?: string
          descricao?: string | null
          editavel?: boolean | null
          id?: string
          tipo?: string
          updated_at?: string | null
          updated_by?: string | null
          valor?: string
        }
        Relationships: [
          {
            foreignKeyName: "configuracoes_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "configuracoes_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "configuracoes_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
        ]
      }
      configuracoes_historico: {
        Row: {
          alterado_em: string
          alterado_por: string | null
          chave: string
          id: string
          valor_anterior: string | null
          valor_novo: string
        }
        Insert: {
          alterado_em?: string
          alterado_por?: string | null
          chave: string
          id?: string
          valor_anterior?: string | null
          valor_novo: string
        }
        Update: {
          alterado_em?: string
          alterado_por?: string | null
          chave?: string
          id?: string
          valor_anterior?: string | null
          valor_novo?: string
        }
        Relationships: [
          {
            foreignKeyName: "configuracoes_historico_alterado_por_fkey"
            columns: ["alterado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "configuracoes_historico_alterado_por_fkey"
            columns: ["alterado_por"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "configuracoes_historico_alterado_por_fkey"
            columns: ["alterado_por"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
        ]
      }
      confirmacoes_agendamento: {
        Row: {
          contexto_ia: Json | null
          created_at: string
          id: string
          instalacao_id: string | null
          mensagem_enviada_em: string | null
          novo_servico_id: string | null
          resposta_cliente: string | null
          resposta_recebida_em: string | null
          servico_id: string | null
          status: string
          telefone: string
        }
        Insert: {
          contexto_ia?: Json | null
          created_at?: string
          id?: string
          instalacao_id?: string | null
          mensagem_enviada_em?: string | null
          novo_servico_id?: string | null
          resposta_cliente?: string | null
          resposta_recebida_em?: string | null
          servico_id?: string | null
          status?: string
          telefone: string
        }
        Update: {
          contexto_ia?: Json | null
          created_at?: string
          id?: string
          instalacao_id?: string | null
          mensagem_enviada_em?: string | null
          novo_servico_id?: string | null
          resposta_cliente?: string | null
          resposta_recebida_em?: string | null
          servico_id?: string | null
          status?: string
          telefone?: string
        }
        Relationships: [
          {
            foreignKeyName: "confirmacoes_agendamento_instalacao_id_fkey"
            columns: ["instalacao_id"]
            isOneToOne: false
            referencedRelation: "instalacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "confirmacoes_agendamento_instalacao_id_fkey"
            columns: ["instalacao_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["instalacao_id"]
          },
          {
            foreignKeyName: "confirmacoes_agendamento_novo_servico_id_fkey"
            columns: ["novo_servico_id"]
            isOneToOne: false
            referencedRelation: "servicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "confirmacoes_agendamento_servico_id_fkey"
            columns: ["servico_id"]
            isOneToOne: false
            referencedRelation: "servicos"
            referencedColumns: ["id"]
          },
        ]
      }
      consultas_juridicas: {
        Row: {
          associado_id: string | null
          assunto: string
          created_at: string | null
          decisao: string | null
          decisao_em: string | null
          decisao_observacoes: string | null
          decisao_por: string | null
          departamento: string | null
          descricao: string
          id: string
          numero: string | null
          parecer: string | null
          prioridade: string | null
          processo_id: string | null
          respondido_em: string | null
          respondido_por: string | null
          sinistro_id: string | null
          solicitante_id: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          associado_id?: string | null
          assunto: string
          created_at?: string | null
          decisao?: string | null
          decisao_em?: string | null
          decisao_observacoes?: string | null
          decisao_por?: string | null
          departamento?: string | null
          descricao: string
          id?: string
          numero?: string | null
          parecer?: string | null
          prioridade?: string | null
          processo_id?: string | null
          respondido_em?: string | null
          respondido_por?: string | null
          sinistro_id?: string | null
          solicitante_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          associado_id?: string | null
          assunto?: string
          created_at?: string | null
          decisao?: string | null
          decisao_em?: string | null
          decisao_observacoes?: string | null
          decisao_por?: string | null
          departamento?: string | null
          descricao?: string
          id?: string
          numero?: string | null
          parecer?: string | null
          prioridade?: string | null
          processo_id?: string | null
          respondido_em?: string | null
          respondido_por?: string | null
          sinistro_id?: string | null
          solicitante_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consultas_juridicas_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "associados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultas_juridicas_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "consultas_juridicas_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "consultas_juridicas_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associado_financeiro"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "consultas_juridicas_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associados_publico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultas_juridicas_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_inadimplentes"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "consultas_juridicas_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "consultas_juridicas_decisao_por_fkey"
            columns: ["decisao_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultas_juridicas_decisao_por_fkey"
            columns: ["decisao_por"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "consultas_juridicas_decisao_por_fkey"
            columns: ["decisao_por"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "consultas_juridicas_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultas_juridicas_respondido_por_fkey"
            columns: ["respondido_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultas_juridicas_respondido_por_fkey"
            columns: ["respondido_por"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "consultas_juridicas_respondido_por_fkey"
            columns: ["respondido_por"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "consultas_juridicas_sinistro_id_fkey"
            columns: ["sinistro_id"]
            isOneToOne: false
            referencedRelation: "sinistros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultas_juridicas_solicitante_id_fkey"
            columns: ["solicitante_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultas_juridicas_solicitante_id_fkey"
            columns: ["solicitante_id"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "consultas_juridicas_solicitante_id_fkey"
            columns: ["solicitante_id"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
        ]
      }
      contas_bancarias: {
        Row: {
          agencia: string
          ativo: boolean | null
          banco_codigo: string
          banco_nome: string
          conta: string
          created_at: string | null
          data_saldo: string | null
          descricao: string | null
          digito: string | null
          id: string
          saldo_atual: number | null
          tipo: string | null
          updated_at: string | null
        }
        Insert: {
          agencia: string
          ativo?: boolean | null
          banco_codigo: string
          banco_nome: string
          conta: string
          created_at?: string | null
          data_saldo?: string | null
          descricao?: string | null
          digito?: string | null
          id?: string
          saldo_atual?: number | null
          tipo?: string | null
          updated_at?: string | null
        }
        Update: {
          agencia?: string
          ativo?: boolean | null
          banco_codigo?: string
          banco_nome?: string
          conta?: string
          created_at?: string | null
          data_saldo?: string | null
          descricao?: string | null
          digito?: string | null
          id?: string
          saldo_atual?: number | null
          tipo?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      contas_pagar: {
        Row: {
          agencia: string | null
          aprovado_em: string | null
          aprovado_por: string | null
          banco: string | null
          categoria: string
          comprovante_url: string | null
          conta: string | null
          created_at: string | null
          data_emissao: string
          data_pagamento: string | null
          data_vencimento: string
          forma_pagamento: string | null
          fornecedor_documento: string | null
          fornecedor_nome: string
          id: string
          observacao: string | null
          pago_por: string | null
          pix_chave: string | null
          referencia_id: string | null
          referencia_tipo: string | null
          status: string | null
          subcategoria: string | null
          updated_at: string | null
          valor: number
          valor_pago: number | null
        }
        Insert: {
          agencia?: string | null
          aprovado_em?: string | null
          aprovado_por?: string | null
          banco?: string | null
          categoria: string
          comprovante_url?: string | null
          conta?: string | null
          created_at?: string | null
          data_emissao?: string
          data_pagamento?: string | null
          data_vencimento: string
          forma_pagamento?: string | null
          fornecedor_documento?: string | null
          fornecedor_nome: string
          id?: string
          observacao?: string | null
          pago_por?: string | null
          pix_chave?: string | null
          referencia_id?: string | null
          referencia_tipo?: string | null
          status?: string | null
          subcategoria?: string | null
          updated_at?: string | null
          valor: number
          valor_pago?: number | null
        }
        Update: {
          agencia?: string | null
          aprovado_em?: string | null
          aprovado_por?: string | null
          banco?: string | null
          categoria?: string
          comprovante_url?: string | null
          conta?: string | null
          created_at?: string | null
          data_emissao?: string
          data_pagamento?: string | null
          data_vencimento?: string
          forma_pagamento?: string | null
          fornecedor_documento?: string | null
          fornecedor_nome?: string
          id?: string
          observacao?: string | null
          pago_por?: string | null
          pix_chave?: string | null
          referencia_id?: string | null
          referencia_tipo?: string | null
          status?: string | null
          subcategoria?: string | null
          updated_at?: string | null
          valor?: number
          valor_pago?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contas_pagar_aprovado_por_fkey"
            columns: ["aprovado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contas_pagar_aprovado_por_fkey"
            columns: ["aprovado_por"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "contas_pagar_aprovado_por_fkey"
            columns: ["aprovado_por"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "contas_pagar_pago_por_fkey"
            columns: ["pago_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contas_pagar_pago_por_fkey"
            columns: ["pago_por"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "contas_pagar_pago_por_fkey"
            columns: ["pago_por"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
        ]
      }
      contratos: {
        Row: {
          adesao_cobranca_id: string | null
          adesao_paga: boolean | null
          adesao_paga_em: string | null
          adicionais_selecionados: Json | null
          analista_id: string | null
          app_apolice_enviada: boolean | null
          app_apolice_enviada_em: string | null
          aprovado_em: string | null
          aprovado_por: string | null
          associado_id: string | null
          autentique_documento_id: string | null
          autentique_status: string | null
          autentique_url: string | null
          carencia_isenta: boolean | null
          carencia_motivo_isencao: string | null
          carencia_vidros_isenta: boolean | null
          carencia_vidros_motivo_isencao: string | null
          cliente_bairro: string | null
          cliente_cep: string | null
          cliente_cidade: string | null
          cliente_cnh: string | null
          cliente_cnh_categoria: string | null
          cliente_cnh_validade: string | null
          cliente_complemento: string | null
          cliente_cpf: string | null
          cliente_data_nascimento: string | null
          cliente_email: string | null
          cliente_endereco: string | null
          cliente_estado_civil: string | null
          cliente_logradouro: string | null
          cliente_nome: string | null
          cliente_numero: string | null
          cliente_profissao: string | null
          cliente_rg: string | null
          cliente_rg_orgao: string | null
          cliente_telefone: string | null
          cliente_telefone_secundario: string | null
          cliente_uf: string | null
          cobertura_fipe: number | null
          codigo_fipe: string | null
          cota_minima: number | null
          cota_participacao: number | null
          cotacao_id: string | null
          cotacao_token_publico: string | null
          created_at: string
          created_by: string | null
          data_assinatura: string | null
          data_ativacao: string | null
          data_cancelamento: string | null
          data_carencia_fim: string | null
          data_carencia_inicio: string | null
          data_carencia_vidros_fim: string | null
          data_carencia_vidros_inicio: string | null
          data_envio: string | null
          data_fim: string | null
          data_inicio: string
          data_visualizacao: string | null
          dia_vencimento: number | null
          documentos_completos: boolean | null
          id: string
          lead_id: string | null
          link_gerado_em: string | null
          link_token: string | null
          numero: string
          observacao_aprovacao: string | null
          origem_troca_titularidade_id: string | null
          pdf_assinado_url: string | null
          pdf_url: string | null
          plano_id: string
          status: Database["public"]["Enums"]["status_contrato"]
          tipo_atendimento: string | null
          tipo_entrada: string | null
          tipo_venda: string | null
          tipo_vistoria: string | null
          updated_at: string
          uso_aplicativo: boolean | null
          validade_link: string | null
          valor_adesao: number
          valor_adicional: number | null
          valor_mensal: number
          veiculo_alienado: boolean | null
          veiculo_ano: number | null
          veiculo_ano_fabricacao: number | null
          veiculo_categoria: string | null
          veiculo_chassi: string | null
          veiculo_combustivel: string | null
          veiculo_cor: string | null
          veiculo_financeira: string | null
          veiculo_id: string | null
          veiculo_marca: string | null
          veiculo_modelo: string | null
          veiculo_placa: string | null
          veiculo_procedencia: string | null
          veiculo_renavam: string | null
          veiculo_tipo_uso: string | null
          veiculo_valor_fipe: number | null
          vendedor_id: string | null
          vistoria_completa_data_agendada: string | null
          vistoria_completa_endereco_bairro: string | null
          vistoria_completa_endereco_cep: string | null
          vistoria_completa_endereco_cidade: string | null
          vistoria_completa_endereco_estado: string | null
          vistoria_completa_endereco_logradouro: string | null
          vistoria_completa_endereco_numero: string | null
          vistoria_completa_horario_agendado: string | null
          vistoria_completa_responsavel_eu_mesmo: boolean | null
          vistoria_completa_responsavel_nome: string | null
          vistoria_completa_responsavel_telefone: string | null
          vistoria_concluida_em: string | null
          vistoria_endereco_latitude: number | null
          vistoria_endereco_longitude: number | null
          vistoria_id: string | null
          vistoria_rota_id: string | null
          whatsapp_enviado: boolean | null
          whatsapp_enviado_em: string | null
          whatsapp_erro: string | null
        }
        Insert: {
          adesao_cobranca_id?: string | null
          adesao_paga?: boolean | null
          adesao_paga_em?: string | null
          adicionais_selecionados?: Json | null
          analista_id?: string | null
          app_apolice_enviada?: boolean | null
          app_apolice_enviada_em?: string | null
          aprovado_em?: string | null
          aprovado_por?: string | null
          associado_id?: string | null
          autentique_documento_id?: string | null
          autentique_status?: string | null
          autentique_url?: string | null
          carencia_isenta?: boolean | null
          carencia_motivo_isencao?: string | null
          carencia_vidros_isenta?: boolean | null
          carencia_vidros_motivo_isencao?: string | null
          cliente_bairro?: string | null
          cliente_cep?: string | null
          cliente_cidade?: string | null
          cliente_cnh?: string | null
          cliente_cnh_categoria?: string | null
          cliente_cnh_validade?: string | null
          cliente_complemento?: string | null
          cliente_cpf?: string | null
          cliente_data_nascimento?: string | null
          cliente_email?: string | null
          cliente_endereco?: string | null
          cliente_estado_civil?: string | null
          cliente_logradouro?: string | null
          cliente_nome?: string | null
          cliente_numero?: string | null
          cliente_profissao?: string | null
          cliente_rg?: string | null
          cliente_rg_orgao?: string | null
          cliente_telefone?: string | null
          cliente_telefone_secundario?: string | null
          cliente_uf?: string | null
          cobertura_fipe?: number | null
          codigo_fipe?: string | null
          cota_minima?: number | null
          cota_participacao?: number | null
          cotacao_id?: string | null
          cotacao_token_publico?: string | null
          created_at?: string
          created_by?: string | null
          data_assinatura?: string | null
          data_ativacao?: string | null
          data_cancelamento?: string | null
          data_carencia_fim?: string | null
          data_carencia_inicio?: string | null
          data_carencia_vidros_fim?: string | null
          data_carencia_vidros_inicio?: string | null
          data_envio?: string | null
          data_fim?: string | null
          data_inicio?: string
          data_visualizacao?: string | null
          dia_vencimento?: number | null
          documentos_completos?: boolean | null
          id?: string
          lead_id?: string | null
          link_gerado_em?: string | null
          link_token?: string | null
          numero: string
          observacao_aprovacao?: string | null
          origem_troca_titularidade_id?: string | null
          pdf_assinado_url?: string | null
          pdf_url?: string | null
          plano_id: string
          status?: Database["public"]["Enums"]["status_contrato"]
          tipo_atendimento?: string | null
          tipo_entrada?: string | null
          tipo_venda?: string | null
          tipo_vistoria?: string | null
          updated_at?: string
          uso_aplicativo?: boolean | null
          validade_link?: string | null
          valor_adesao: number
          valor_adicional?: number | null
          valor_mensal: number
          veiculo_alienado?: boolean | null
          veiculo_ano?: number | null
          veiculo_ano_fabricacao?: number | null
          veiculo_categoria?: string | null
          veiculo_chassi?: string | null
          veiculo_combustivel?: string | null
          veiculo_cor?: string | null
          veiculo_financeira?: string | null
          veiculo_id?: string | null
          veiculo_marca?: string | null
          veiculo_modelo?: string | null
          veiculo_placa?: string | null
          veiculo_procedencia?: string | null
          veiculo_renavam?: string | null
          veiculo_tipo_uso?: string | null
          veiculo_valor_fipe?: number | null
          vendedor_id?: string | null
          vistoria_completa_data_agendada?: string | null
          vistoria_completa_endereco_bairro?: string | null
          vistoria_completa_endereco_cep?: string | null
          vistoria_completa_endereco_cidade?: string | null
          vistoria_completa_endereco_estado?: string | null
          vistoria_completa_endereco_logradouro?: string | null
          vistoria_completa_endereco_numero?: string | null
          vistoria_completa_horario_agendado?: string | null
          vistoria_completa_responsavel_eu_mesmo?: boolean | null
          vistoria_completa_responsavel_nome?: string | null
          vistoria_completa_responsavel_telefone?: string | null
          vistoria_concluida_em?: string | null
          vistoria_endereco_latitude?: number | null
          vistoria_endereco_longitude?: number | null
          vistoria_id?: string | null
          vistoria_rota_id?: string | null
          whatsapp_enviado?: boolean | null
          whatsapp_enviado_em?: string | null
          whatsapp_erro?: string | null
        }
        Update: {
          adesao_cobranca_id?: string | null
          adesao_paga?: boolean | null
          adesao_paga_em?: string | null
          adicionais_selecionados?: Json | null
          analista_id?: string | null
          app_apolice_enviada?: boolean | null
          app_apolice_enviada_em?: string | null
          aprovado_em?: string | null
          aprovado_por?: string | null
          associado_id?: string | null
          autentique_documento_id?: string | null
          autentique_status?: string | null
          autentique_url?: string | null
          carencia_isenta?: boolean | null
          carencia_motivo_isencao?: string | null
          carencia_vidros_isenta?: boolean | null
          carencia_vidros_motivo_isencao?: string | null
          cliente_bairro?: string | null
          cliente_cep?: string | null
          cliente_cidade?: string | null
          cliente_cnh?: string | null
          cliente_cnh_categoria?: string | null
          cliente_cnh_validade?: string | null
          cliente_complemento?: string | null
          cliente_cpf?: string | null
          cliente_data_nascimento?: string | null
          cliente_email?: string | null
          cliente_endereco?: string | null
          cliente_estado_civil?: string | null
          cliente_logradouro?: string | null
          cliente_nome?: string | null
          cliente_numero?: string | null
          cliente_profissao?: string | null
          cliente_rg?: string | null
          cliente_rg_orgao?: string | null
          cliente_telefone?: string | null
          cliente_telefone_secundario?: string | null
          cliente_uf?: string | null
          cobertura_fipe?: number | null
          codigo_fipe?: string | null
          cota_minima?: number | null
          cota_participacao?: number | null
          cotacao_id?: string | null
          cotacao_token_publico?: string | null
          created_at?: string
          created_by?: string | null
          data_assinatura?: string | null
          data_ativacao?: string | null
          data_cancelamento?: string | null
          data_carencia_fim?: string | null
          data_carencia_inicio?: string | null
          data_carencia_vidros_fim?: string | null
          data_carencia_vidros_inicio?: string | null
          data_envio?: string | null
          data_fim?: string | null
          data_inicio?: string
          data_visualizacao?: string | null
          dia_vencimento?: number | null
          documentos_completos?: boolean | null
          id?: string
          lead_id?: string | null
          link_gerado_em?: string | null
          link_token?: string | null
          numero?: string
          observacao_aprovacao?: string | null
          origem_troca_titularidade_id?: string | null
          pdf_assinado_url?: string | null
          pdf_url?: string | null
          plano_id?: string
          status?: Database["public"]["Enums"]["status_contrato"]
          tipo_atendimento?: string | null
          tipo_entrada?: string | null
          tipo_venda?: string | null
          tipo_vistoria?: string | null
          updated_at?: string
          uso_aplicativo?: boolean | null
          validade_link?: string | null
          valor_adesao?: number
          valor_adicional?: number | null
          valor_mensal?: number
          veiculo_alienado?: boolean | null
          veiculo_ano?: number | null
          veiculo_ano_fabricacao?: number | null
          veiculo_categoria?: string | null
          veiculo_chassi?: string | null
          veiculo_combustivel?: string | null
          veiculo_cor?: string | null
          veiculo_financeira?: string | null
          veiculo_id?: string | null
          veiculo_marca?: string | null
          veiculo_modelo?: string | null
          veiculo_placa?: string | null
          veiculo_procedencia?: string | null
          veiculo_renavam?: string | null
          veiculo_tipo_uso?: string | null
          veiculo_valor_fipe?: number | null
          vendedor_id?: string | null
          vistoria_completa_data_agendada?: string | null
          vistoria_completa_endereco_bairro?: string | null
          vistoria_completa_endereco_cep?: string | null
          vistoria_completa_endereco_cidade?: string | null
          vistoria_completa_endereco_estado?: string | null
          vistoria_completa_endereco_logradouro?: string | null
          vistoria_completa_endereco_numero?: string | null
          vistoria_completa_horario_agendado?: string | null
          vistoria_completa_responsavel_eu_mesmo?: boolean | null
          vistoria_completa_responsavel_nome?: string | null
          vistoria_completa_responsavel_telefone?: string | null
          vistoria_concluida_em?: string | null
          vistoria_endereco_latitude?: number | null
          vistoria_endereco_longitude?: number | null
          vistoria_id?: string | null
          vistoria_rota_id?: string | null
          whatsapp_enviado?: boolean | null
          whatsapp_enviado_em?: string | null
          whatsapp_erro?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contratos_analista_id_fkey"
            columns: ["analista_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_analista_id_fkey"
            columns: ["analista_id"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "contratos_analista_id_fkey"
            columns: ["analista_id"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "contratos_aprovado_por_fkey"
            columns: ["aprovado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_aprovado_por_fkey"
            columns: ["aprovado_por"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "contratos_aprovado_por_fkey"
            columns: ["aprovado_por"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "contratos_cotacao_id_fkey"
            columns: ["cotacao_id"]
            isOneToOne: false
            referencedRelation: "cotacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "contratos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "contratos_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "contratos_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "planos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "vw_plans_compat"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["veiculo_id"]
          },
          {
            foreignKeyName: "contratos_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["veiculo_id"]
          },
          {
            foreignKeyName: "contratos_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["veiculo_id"]
          },
          {
            foreignKeyName: "contratos_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "vw_veiculos_com_cotas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "contratos_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "contratos_vistoria_id_fkey"
            columns: ["vistoria_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["vistoria_id"]
          },
          {
            foreignKeyName: "contratos_vistoria_id_fkey"
            columns: ["vistoria_id"]
            isOneToOne: false
            referencedRelation: "vistorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_vistoria_rota_id_fkey"
            columns: ["vistoria_rota_id"]
            isOneToOne: false
            referencedRelation: "rotas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_contratos_associado"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "associados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_contratos_associado"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "fk_contratos_associado"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "fk_contratos_associado"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associado_financeiro"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "fk_contratos_associado"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associados_publico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_contratos_associado"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_inadimplentes"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "fk_contratos_associado"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["associado_id"]
          },
        ]
      }
      contratos_documentos: {
        Row: {
          arquivo_nome: string | null
          arquivo_url: string
          contrato_id: string | null
          cotacao_id: string | null
          created_at: string | null
          id: string
          ocr_resultado: Json | null
          status: string | null
          tipo: string
          updated_at: string | null
        }
        Insert: {
          arquivo_nome?: string | null
          arquivo_url: string
          contrato_id?: string | null
          cotacao_id?: string | null
          created_at?: string | null
          id?: string
          ocr_resultado?: Json | null
          status?: string | null
          tipo: string
          updated_at?: string | null
        }
        Update: {
          arquivo_nome?: string | null
          arquivo_url?: string
          contrato_id?: string | null
          cotacao_id?: string | null
          created_at?: string | null
          id?: string
          ocr_resultado?: Json | null
          status?: string | null
          tipo?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contratos_documentos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_documentos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "contratos_documentos_cotacao_id_fkey"
            columns: ["cotacao_id"]
            isOneToOne: false
            referencedRelation: "cotacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      contratos_historico: {
        Row: {
          contrato_id: string
          created_at: string | null
          dados: Json | null
          descricao: string | null
          evento: string
          id: string
          usuario_id: string | null
        }
        Insert: {
          contrato_id: string
          created_at?: string | null
          dados?: Json | null
          descricao?: string | null
          evento: string
          id?: string
          usuario_id?: string | null
        }
        Update: {
          contrato_id?: string
          created_at?: string | null
          dados?: Json | null
          descricao?: string | null
          evento?: string
          id?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contratos_historico_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_historico_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "contratos_historico_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_historico_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "contratos_historico_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
        ]
      }
      cotacao_pdf_config: {
        Row: {
          cor_primaria: string
          cor_secundaria: string
          id: string
          logo_url: string | null
          mensagem_encerramento: string
          mostrar_dados_solicitante: boolean
          mostrar_dados_veiculo: boolean
          mostrar_mensagem_encerramento: boolean
          mostrar_validade: boolean
          mostrar_whatsapp_rodape: boolean
          nome_empresa: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          cor_primaria?: string
          cor_secundaria?: string
          id?: string
          logo_url?: string | null
          mensagem_encerramento?: string
          mostrar_dados_solicitante?: boolean
          mostrar_dados_veiculo?: boolean
          mostrar_mensagem_encerramento?: boolean
          mostrar_validade?: boolean
          mostrar_whatsapp_rodape?: boolean
          nome_empresa?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          cor_primaria?: string
          cor_secundaria?: string
          id?: string
          logo_url?: string | null
          mensagem_encerramento?: string
          mostrar_dados_solicitante?: boolean
          mostrar_dados_veiculo?: boolean
          mostrar_mensagem_encerramento?: boolean
          mostrar_validade?: boolean
          mostrar_whatsapp_rodape?: boolean
          nome_empresa?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      cotacoes: {
        Row: {
          adicionais_selecionados: Json | null
          campanha_desconto_id: string | null
          cancelada_em: string | null
          categoria: string | null
          cidade: string | null
          cliente_bairro: string | null
          cliente_cep: string | null
          cliente_cidade: string | null
          cliente_cnh: string | null
          cliente_cnh_categoria: string | null
          cliente_cnh_validade: string | null
          cliente_complemento: string | null
          cliente_cpf: string | null
          cliente_data_nascimento: string | null
          cliente_estado_civil: string | null
          cliente_logradouro: string | null
          cliente_numero: string | null
          cliente_profissao: string | null
          cliente_rg: string | null
          cliente_rg_orgao: string | null
          cliente_telefone_secundario: string | null
          cliente_uf: string | null
          codigo_fipe: string | null
          combustivel: string | null
          contrato_gerado_id: string | null
          created_at: string
          dados_extras: Json | null
          desagio_aplicado: number | null
          dia_vencimento: number | null
          doc_cnh_frente: string | null
          doc_cnh_verso: string | null
          doc_comprovante: string | null
          doc_crlv: string | null
          doc_selfie: string | null
          email_enviado_em: string | null
          email_solicitante: string | null
          fipe_faixa_cobranca_max: number | null
          fipe_faixa_cobranca_min: number | null
          fipe_menor_aprovado: boolean | null
          id: string
          indicador_id: string | null
          indicador_nome: string | null
          lead_id: string | null
          meses_desconto_campanha: number | null
          motivo_cancelamento: string | null
          nome_solicitante: string | null
          numero: string
          plano_escolhido_id: string | null
          plano_id: string | null
          regiao: string | null
          solicitar_fipe_menor: boolean
          status: Database["public"]["Enums"]["status_cotacao"]
          status_contratacao: string | null
          taxa_administrativa: number
          telefone1_solicitante: string | null
          telefone2_solicitante: string | null
          tipo_instalacao: string | null
          tipo_vistoria: string | null
          token_publico: string | null
          updated_at: string
          uso_aplicativo: boolean | null
          validade_dias: number
          valor_adesao: number
          valor_adesao_original: number | null
          valor_adicional: number | null
          valor_assistencia: number | null
          valor_cota: number
          valor_fipe: number
          valor_mensal_original: number | null
          valor_mensal_promocional: number | null
          valor_rastreamento: number
          valor_total_mensal: number
          veiculo_alienado: boolean | null
          veiculo_ano: number | null
          veiculo_ano_fabricacao: number | null
          veiculo_categoria: string | null
          veiculo_chassi: string | null
          veiculo_combustivel: string | null
          veiculo_cor: string | null
          veiculo_financeira: string | null
          veiculo_marca: string | null
          veiculo_modelo: string | null
          veiculo_placa: string | null
          veiculo_procedencia: string | null
          veiculo_renavam: string | null
          veiculo_tipo_uso: string | null
          vendedor_id: string | null
          vistoria_completa_data_agendada: string | null
          vistoria_completa_endereco_bairro: string | null
          vistoria_completa_endereco_cep: string | null
          vistoria_completa_endereco_cidade: string | null
          vistoria_completa_endereco_estado: string | null
          vistoria_completa_endereco_logradouro: string | null
          vistoria_completa_endereco_numero: string | null
          vistoria_completa_horario_agendado: string | null
          vistoria_completa_periodo: string | null
          vistoria_completa_responsavel_eu_mesmo: boolean | null
          vistoria_completa_responsavel_nome: string | null
          vistoria_completa_responsavel_telefone: string | null
          vistoria_concluida_em: string | null
          vistoria_data_agendada: string | null
          vistoria_endereco_bairro: string | null
          vistoria_endereco_cep: string | null
          vistoria_endereco_cidade: string | null
          vistoria_endereco_estado: string | null
          vistoria_endereco_latitude: number | null
          vistoria_endereco_logradouro: string | null
          vistoria_endereco_longitude: number | null
          vistoria_endereco_numero: string | null
          vistoria_horario_agendado: string | null
          vistoria_id: string | null
          vistoria_periodo: string | null
          vistoria_permite_encaixe: boolean | null
          vistoria_responsavel_eu_mesmo: boolean | null
          vistoria_responsavel_nome: string | null
          vistoria_responsavel_telefone: string | null
          vistoria_rota_id: string | null
          visualizado_em: string | null
        }
        Insert: {
          adicionais_selecionados?: Json | null
          campanha_desconto_id?: string | null
          cancelada_em?: string | null
          categoria?: string | null
          cidade?: string | null
          cliente_bairro?: string | null
          cliente_cep?: string | null
          cliente_cidade?: string | null
          cliente_cnh?: string | null
          cliente_cnh_categoria?: string | null
          cliente_cnh_validade?: string | null
          cliente_complemento?: string | null
          cliente_cpf?: string | null
          cliente_data_nascimento?: string | null
          cliente_estado_civil?: string | null
          cliente_logradouro?: string | null
          cliente_numero?: string | null
          cliente_profissao?: string | null
          cliente_rg?: string | null
          cliente_rg_orgao?: string | null
          cliente_telefone_secundario?: string | null
          cliente_uf?: string | null
          codigo_fipe?: string | null
          combustivel?: string | null
          contrato_gerado_id?: string | null
          created_at?: string
          dados_extras?: Json | null
          desagio_aplicado?: number | null
          dia_vencimento?: number | null
          doc_cnh_frente?: string | null
          doc_cnh_verso?: string | null
          doc_comprovante?: string | null
          doc_crlv?: string | null
          doc_selfie?: string | null
          email_enviado_em?: string | null
          email_solicitante?: string | null
          fipe_faixa_cobranca_max?: number | null
          fipe_faixa_cobranca_min?: number | null
          fipe_menor_aprovado?: boolean | null
          id?: string
          indicador_id?: string | null
          indicador_nome?: string | null
          lead_id?: string | null
          meses_desconto_campanha?: number | null
          motivo_cancelamento?: string | null
          nome_solicitante?: string | null
          numero: string
          plano_escolhido_id?: string | null
          plano_id?: string | null
          regiao?: string | null
          solicitar_fipe_menor?: boolean
          status?: Database["public"]["Enums"]["status_cotacao"]
          status_contratacao?: string | null
          taxa_administrativa?: number
          telefone1_solicitante?: string | null
          telefone2_solicitante?: string | null
          tipo_instalacao?: string | null
          tipo_vistoria?: string | null
          token_publico?: string | null
          updated_at?: string
          uso_aplicativo?: boolean | null
          validade_dias?: number
          valor_adesao: number
          valor_adesao_original?: number | null
          valor_adicional?: number | null
          valor_assistencia?: number | null
          valor_cota: number
          valor_fipe: number
          valor_mensal_original?: number | null
          valor_mensal_promocional?: number | null
          valor_rastreamento?: number
          valor_total_mensal: number
          veiculo_alienado?: boolean | null
          veiculo_ano?: number | null
          veiculo_ano_fabricacao?: number | null
          veiculo_categoria?: string | null
          veiculo_chassi?: string | null
          veiculo_combustivel?: string | null
          veiculo_cor?: string | null
          veiculo_financeira?: string | null
          veiculo_marca?: string | null
          veiculo_modelo?: string | null
          veiculo_placa?: string | null
          veiculo_procedencia?: string | null
          veiculo_renavam?: string | null
          veiculo_tipo_uso?: string | null
          vendedor_id?: string | null
          vistoria_completa_data_agendada?: string | null
          vistoria_completa_endereco_bairro?: string | null
          vistoria_completa_endereco_cep?: string | null
          vistoria_completa_endereco_cidade?: string | null
          vistoria_completa_endereco_estado?: string | null
          vistoria_completa_endereco_logradouro?: string | null
          vistoria_completa_endereco_numero?: string | null
          vistoria_completa_horario_agendado?: string | null
          vistoria_completa_periodo?: string | null
          vistoria_completa_responsavel_eu_mesmo?: boolean | null
          vistoria_completa_responsavel_nome?: string | null
          vistoria_completa_responsavel_telefone?: string | null
          vistoria_concluida_em?: string | null
          vistoria_data_agendada?: string | null
          vistoria_endereco_bairro?: string | null
          vistoria_endereco_cep?: string | null
          vistoria_endereco_cidade?: string | null
          vistoria_endereco_estado?: string | null
          vistoria_endereco_latitude?: number | null
          vistoria_endereco_logradouro?: string | null
          vistoria_endereco_longitude?: number | null
          vistoria_endereco_numero?: string | null
          vistoria_horario_agendado?: string | null
          vistoria_id?: string | null
          vistoria_periodo?: string | null
          vistoria_permite_encaixe?: boolean | null
          vistoria_responsavel_eu_mesmo?: boolean | null
          vistoria_responsavel_nome?: string | null
          vistoria_responsavel_telefone?: string | null
          vistoria_rota_id?: string | null
          visualizado_em?: string | null
        }
        Update: {
          adicionais_selecionados?: Json | null
          campanha_desconto_id?: string | null
          cancelada_em?: string | null
          categoria?: string | null
          cidade?: string | null
          cliente_bairro?: string | null
          cliente_cep?: string | null
          cliente_cidade?: string | null
          cliente_cnh?: string | null
          cliente_cnh_categoria?: string | null
          cliente_cnh_validade?: string | null
          cliente_complemento?: string | null
          cliente_cpf?: string | null
          cliente_data_nascimento?: string | null
          cliente_estado_civil?: string | null
          cliente_logradouro?: string | null
          cliente_numero?: string | null
          cliente_profissao?: string | null
          cliente_rg?: string | null
          cliente_rg_orgao?: string | null
          cliente_telefone_secundario?: string | null
          cliente_uf?: string | null
          codigo_fipe?: string | null
          combustivel?: string | null
          contrato_gerado_id?: string | null
          created_at?: string
          dados_extras?: Json | null
          desagio_aplicado?: number | null
          dia_vencimento?: number | null
          doc_cnh_frente?: string | null
          doc_cnh_verso?: string | null
          doc_comprovante?: string | null
          doc_crlv?: string | null
          doc_selfie?: string | null
          email_enviado_em?: string | null
          email_solicitante?: string | null
          fipe_faixa_cobranca_max?: number | null
          fipe_faixa_cobranca_min?: number | null
          fipe_menor_aprovado?: boolean | null
          id?: string
          indicador_id?: string | null
          indicador_nome?: string | null
          lead_id?: string | null
          meses_desconto_campanha?: number | null
          motivo_cancelamento?: string | null
          nome_solicitante?: string | null
          numero?: string
          plano_escolhido_id?: string | null
          plano_id?: string | null
          regiao?: string | null
          solicitar_fipe_menor?: boolean
          status?: Database["public"]["Enums"]["status_cotacao"]
          status_contratacao?: string | null
          taxa_administrativa?: number
          telefone1_solicitante?: string | null
          telefone2_solicitante?: string | null
          tipo_instalacao?: string | null
          tipo_vistoria?: string | null
          token_publico?: string | null
          updated_at?: string
          uso_aplicativo?: boolean | null
          validade_dias?: number
          valor_adesao?: number
          valor_adesao_original?: number | null
          valor_adicional?: number | null
          valor_assistencia?: number | null
          valor_cota?: number
          valor_fipe?: number
          valor_mensal_original?: number | null
          valor_mensal_promocional?: number | null
          valor_rastreamento?: number
          valor_total_mensal?: number
          veiculo_alienado?: boolean | null
          veiculo_ano?: number | null
          veiculo_ano_fabricacao?: number | null
          veiculo_categoria?: string | null
          veiculo_chassi?: string | null
          veiculo_combustivel?: string | null
          veiculo_cor?: string | null
          veiculo_financeira?: string | null
          veiculo_marca?: string | null
          veiculo_modelo?: string | null
          veiculo_placa?: string | null
          veiculo_procedencia?: string | null
          veiculo_renavam?: string | null
          veiculo_tipo_uso?: string | null
          vendedor_id?: string | null
          vistoria_completa_data_agendada?: string | null
          vistoria_completa_endereco_bairro?: string | null
          vistoria_completa_endereco_cep?: string | null
          vistoria_completa_endereco_cidade?: string | null
          vistoria_completa_endereco_estado?: string | null
          vistoria_completa_endereco_logradouro?: string | null
          vistoria_completa_endereco_numero?: string | null
          vistoria_completa_horario_agendado?: string | null
          vistoria_completa_periodo?: string | null
          vistoria_completa_responsavel_eu_mesmo?: boolean | null
          vistoria_completa_responsavel_nome?: string | null
          vistoria_completa_responsavel_telefone?: string | null
          vistoria_concluida_em?: string | null
          vistoria_data_agendada?: string | null
          vistoria_endereco_bairro?: string | null
          vistoria_endereco_cep?: string | null
          vistoria_endereco_cidade?: string | null
          vistoria_endereco_estado?: string | null
          vistoria_endereco_latitude?: number | null
          vistoria_endereco_logradouro?: string | null
          vistoria_endereco_longitude?: number | null
          vistoria_endereco_numero?: string | null
          vistoria_horario_agendado?: string | null
          vistoria_id?: string | null
          vistoria_periodo?: string | null
          vistoria_permite_encaixe?: boolean | null
          vistoria_responsavel_eu_mesmo?: boolean | null
          vistoria_responsavel_nome?: string | null
          vistoria_responsavel_telefone?: string | null
          vistoria_rota_id?: string | null
          visualizado_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cotacoes_campanha_desconto_id_fkey"
            columns: ["campanha_desconto_id"]
            isOneToOne: false
            referencedRelation: "campanhas_desconto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotacoes_contrato_gerado_id_fkey"
            columns: ["contrato_gerado_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotacoes_contrato_gerado_id_fkey"
            columns: ["contrato_gerado_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "cotacoes_indicador_id_fkey"
            columns: ["indicador_id"]
            isOneToOne: false
            referencedRelation: "associados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotacoes_indicador_id_fkey"
            columns: ["indicador_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "cotacoes_indicador_id_fkey"
            columns: ["indicador_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "cotacoes_indicador_id_fkey"
            columns: ["indicador_id"]
            isOneToOne: false
            referencedRelation: "view_associado_financeiro"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "cotacoes_indicador_id_fkey"
            columns: ["indicador_id"]
            isOneToOne: false
            referencedRelation: "view_associados_publico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotacoes_indicador_id_fkey"
            columns: ["indicador_id"]
            isOneToOne: false
            referencedRelation: "view_inadimplentes"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "cotacoes_indicador_id_fkey"
            columns: ["indicador_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "cotacoes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotacoes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "cotacoes_plano_escolhido_id_fkey"
            columns: ["plano_escolhido_id"]
            isOneToOne: false
            referencedRelation: "planos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotacoes_plano_escolhido_id_fkey"
            columns: ["plano_escolhido_id"]
            isOneToOne: false
            referencedRelation: "vw_plans_compat"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotacoes_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "planos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotacoes_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "vw_plans_compat"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotacoes_vendedor_profiles_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "cotacoes_vistoria_id_fkey"
            columns: ["vistoria_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["vistoria_id"]
          },
          {
            foreignKeyName: "cotacoes_vistoria_id_fkey"
            columns: ["vistoria_id"]
            isOneToOne: false
            referencedRelation: "vistorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotacoes_vistoria_rota_id_fkey"
            columns: ["vistoria_rota_id"]
            isOneToOne: false
            referencedRelation: "rotas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_cotacoes_lead_id"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_cotacoes_lead_id"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["lead_id"]
          },
        ]
      }
      cotacoes_historico: {
        Row: {
          acao: string
          autor_id: string | null
          autor_nome: string | null
          cotacao_id: string
          created_at: string | null
          detalhes: Json | null
          id: string
        }
        Insert: {
          acao: string
          autor_id?: string | null
          autor_nome?: string | null
          cotacao_id: string
          created_at?: string | null
          detalhes?: Json | null
          id?: string
        }
        Update: {
          acao?: string
          autor_id?: string | null
          autor_nome?: string | null
          cotacao_id?: string
          created_at?: string | null
          detalhes?: Json | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cotacoes_historico_cotacao_id_fkey"
            columns: ["cotacao_id"]
            isOneToOne: false
            referencedRelation: "cotacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      cotacoes_publicas: {
        Row: {
          adicionais_selecionados: Json | null
          asaas_boleto_url: string | null
          asaas_charge_id: string | null
          asaas_customer_id: string | null
          asaas_pix_copiacola: string | null
          asaas_pix_qrcode: string | null
          codigo_fipe: string | null
          concluido_em: string | null
          created_at: string | null
          dados_cnh: Json | null
          dados_comprovante: Json | null
          dados_crlv: Json | null
          doc_cnh_frente: string | null
          doc_cnh_verso: string | null
          doc_comprovante: string | null
          doc_crlv: string | null
          doc_selfie: string | null
          documentos_ok_em: string | null
          expires_at: string | null
          face_aprovada: boolean | null
          face_match_score: number | null
          face_verificada_em: string | null
          id: string
          ip_address: string | null
          lead_id: string | null
          pagamento_confirmado_em: string | null
          pagamento_metodo: string | null
          pagamento_status: string | null
          pendencias: Json | null
          pendencias_observacoes: string | null
          plano_escolhido: string | null
          plano_escolhido_em: string | null
          proposta_aceita_em: string | null
          rastreador_agendado_para: string | null
          rastreador_id: string | null
          rastreador_instalado_em: string | null
          regiao: string | null
          selfie_ok_em: string | null
          status: string | null
          termos_aceitos: boolean | null
          termos_aceitos_em: string | null
          tipo_vistoria: string | null
          token: string
          updated_at: string | null
          user_agent: string | null
          uso_aplicativo: boolean | null
          uso_definido_em: string | null
          valor_adesao_final: number | null
          valor_fipe: number | null
          valor_mensal_final: number | null
          valor_primeira_parcela: number | null
          veiculo_ano: number | null
          veiculo_combustivel: string | null
          veiculo_cor: string | null
          veiculo_marca: string | null
          veiculo_modelo: string | null
          veiculo_placa: string | null
          vendedor_id: string | null
          vistoria_agendada_para: string | null
          vistoria_concluida_em: string | null
          vistoria_endereco: string | null
          vistoria_observacoes: string | null
          vistoria_ok_em: string | null
          visualizado_em: string | null
        }
        Insert: {
          adicionais_selecionados?: Json | null
          asaas_boleto_url?: string | null
          asaas_charge_id?: string | null
          asaas_customer_id?: string | null
          asaas_pix_copiacola?: string | null
          asaas_pix_qrcode?: string | null
          codigo_fipe?: string | null
          concluido_em?: string | null
          created_at?: string | null
          dados_cnh?: Json | null
          dados_comprovante?: Json | null
          dados_crlv?: Json | null
          doc_cnh_frente?: string | null
          doc_cnh_verso?: string | null
          doc_comprovante?: string | null
          doc_crlv?: string | null
          doc_selfie?: string | null
          documentos_ok_em?: string | null
          expires_at?: string | null
          face_aprovada?: boolean | null
          face_match_score?: number | null
          face_verificada_em?: string | null
          id?: string
          ip_address?: string | null
          lead_id?: string | null
          pagamento_confirmado_em?: string | null
          pagamento_metodo?: string | null
          pagamento_status?: string | null
          pendencias?: Json | null
          pendencias_observacoes?: string | null
          plano_escolhido?: string | null
          plano_escolhido_em?: string | null
          proposta_aceita_em?: string | null
          rastreador_agendado_para?: string | null
          rastreador_id?: string | null
          rastreador_instalado_em?: string | null
          regiao?: string | null
          selfie_ok_em?: string | null
          status?: string | null
          termos_aceitos?: boolean | null
          termos_aceitos_em?: string | null
          tipo_vistoria?: string | null
          token?: string
          updated_at?: string | null
          user_agent?: string | null
          uso_aplicativo?: boolean | null
          uso_definido_em?: string | null
          valor_adesao_final?: number | null
          valor_fipe?: number | null
          valor_mensal_final?: number | null
          valor_primeira_parcela?: number | null
          veiculo_ano?: number | null
          veiculo_combustivel?: string | null
          veiculo_cor?: string | null
          veiculo_marca?: string | null
          veiculo_modelo?: string | null
          veiculo_placa?: string | null
          vendedor_id?: string | null
          vistoria_agendada_para?: string | null
          vistoria_concluida_em?: string | null
          vistoria_endereco?: string | null
          vistoria_observacoes?: string | null
          vistoria_ok_em?: string | null
          visualizado_em?: string | null
        }
        Update: {
          adicionais_selecionados?: Json | null
          asaas_boleto_url?: string | null
          asaas_charge_id?: string | null
          asaas_customer_id?: string | null
          asaas_pix_copiacola?: string | null
          asaas_pix_qrcode?: string | null
          codigo_fipe?: string | null
          concluido_em?: string | null
          created_at?: string | null
          dados_cnh?: Json | null
          dados_comprovante?: Json | null
          dados_crlv?: Json | null
          doc_cnh_frente?: string | null
          doc_cnh_verso?: string | null
          doc_comprovante?: string | null
          doc_crlv?: string | null
          doc_selfie?: string | null
          documentos_ok_em?: string | null
          expires_at?: string | null
          face_aprovada?: boolean | null
          face_match_score?: number | null
          face_verificada_em?: string | null
          id?: string
          ip_address?: string | null
          lead_id?: string | null
          pagamento_confirmado_em?: string | null
          pagamento_metodo?: string | null
          pagamento_status?: string | null
          pendencias?: Json | null
          pendencias_observacoes?: string | null
          plano_escolhido?: string | null
          plano_escolhido_em?: string | null
          proposta_aceita_em?: string | null
          rastreador_agendado_para?: string | null
          rastreador_id?: string | null
          rastreador_instalado_em?: string | null
          regiao?: string | null
          selfie_ok_em?: string | null
          status?: string | null
          termos_aceitos?: boolean | null
          termos_aceitos_em?: string | null
          tipo_vistoria?: string | null
          token?: string
          updated_at?: string | null
          user_agent?: string | null
          uso_aplicativo?: boolean | null
          uso_definido_em?: string | null
          valor_adesao_final?: number | null
          valor_fipe?: number | null
          valor_mensal_final?: number | null
          valor_primeira_parcela?: number | null
          veiculo_ano?: number | null
          veiculo_combustivel?: string | null
          veiculo_cor?: string | null
          veiculo_marca?: string | null
          veiculo_modelo?: string | null
          veiculo_placa?: string | null
          vendedor_id?: string | null
          vistoria_agendada_para?: string | null
          vistoria_concluida_em?: string | null
          vistoria_endereco?: string | null
          vistoria_observacoes?: string | null
          vistoria_ok_em?: string | null
          visualizado_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cotacoes_publicas_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotacoes_publicas_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "cotacoes_publicas_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotacoes_publicas_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "cotacoes_publicas_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
        ]
      }
      cotacoes_publicas_fotos: {
        Row: {
          aprovada: boolean | null
          cotacao_id: string
          created_at: string | null
          descricao: string | null
          id: string
          latitude: number | null
          longitude: number | null
          motivo_rejeicao: string | null
          tipo: string
          url: string
        }
        Insert: {
          aprovada?: boolean | null
          cotacao_id: string
          created_at?: string | null
          descricao?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          motivo_rejeicao?: string | null
          tipo: string
          url: string
        }
        Update: {
          aprovada?: boolean | null
          cotacao_id?: string
          created_at?: string | null
          descricao?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          motivo_rejeicao?: string | null
          tipo?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "cotacoes_publicas_fotos_cotacao_id_fkey"
            columns: ["cotacao_id"]
            isOneToOne: false
            referencedRelation: "cotacoes_publicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotacoes_publicas_fotos_cotacao_id_fkey"
            columns: ["cotacao_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["cotacao_publica_id"]
          },
        ]
      }
      cotacoes_publicas_historico: {
        Row: {
          acao: string
          cotacao_id: string
          created_at: string | null
          detalhes: Json | null
          id: string
          ip_address: string | null
          status_anterior: string | null
          status_novo: string | null
          user_agent: string | null
        }
        Insert: {
          acao: string
          cotacao_id: string
          created_at?: string | null
          detalhes?: Json | null
          id?: string
          ip_address?: string | null
          status_anterior?: string | null
          status_novo?: string | null
          user_agent?: string | null
        }
        Update: {
          acao?: string
          cotacao_id?: string
          created_at?: string | null
          detalhes?: Json | null
          id?: string
          ip_address?: string | null
          status_anterior?: string | null
          status_novo?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cotacoes_publicas_historico_cotacao_id_fkey"
            columns: ["cotacao_id"]
            isOneToOne: false
            referencedRelation: "cotacoes_publicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotacoes_publicas_historico_cotacao_id_fkey"
            columns: ["cotacao_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["cotacao_publica_id"]
          },
        ]
      }
      cotacoes_vistoria_fotos: {
        Row: {
          arquivo_url: string
          cotacao_id: string
          created_at: string
          id: string
          latitude: number | null
          longitude: number | null
          tipo: string
        }
        Insert: {
          arquivo_url: string
          cotacao_id: string
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          tipo: string
        }
        Update: {
          arquivo_url?: string
          cotacao_id?: string
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "cotacoes_vistoria_fotos_cotacao_id_fkey"
            columns: ["cotacao_id"]
            isOneToOne: false
            referencedRelation: "cotacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      departamentos: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          departamento_pai_id: string | null
          descricao: string | null
          id: string
          nome: string
          responsavel_id: string | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          departamento_pai_id?: string | null
          descricao?: string | null
          id?: string
          nome: string
          responsavel_id?: string | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          departamento_pai_id?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          responsavel_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "departamentos_departamento_pai_id_fkey"
            columns: ["departamento_pai_id"]
            isOneToOne: false
            referencedRelation: "departamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "departamentos_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "departamentos_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "departamentos_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
        ]
      }
      despacho_reboque: {
        Row: {
          chamado_id: string
          ciclo: number
          created_at: string
          distancia_atribuida_km: number | null
          hora_disparo: string
          hora_limite: string
          id: string
          prestador_atribuido_id: string | null
          status: string
          total_aceites: number
          total_enviados: number
          total_recusas: number
          valor_atribuido: number | null
        }
        Insert: {
          chamado_id: string
          ciclo?: number
          created_at?: string
          distancia_atribuida_km?: number | null
          hora_disparo?: string
          hora_limite?: string
          id?: string
          prestador_atribuido_id?: string | null
          status?: string
          total_aceites?: number
          total_enviados?: number
          total_recusas?: number
          valor_atribuido?: number | null
        }
        Update: {
          chamado_id?: string
          ciclo?: number
          created_at?: string
          distancia_atribuida_km?: number | null
          hora_disparo?: string
          hora_limite?: string
          id?: string
          prestador_atribuido_id?: string | null
          status?: string
          total_aceites?: number
          total_enviados?: number
          total_recusas?: number
          valor_atribuido?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "despacho_reboque_chamado_id_fkey"
            columns: ["chamado_id"]
            isOneToOne: false
            referencedRelation: "chamados_assistencia"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despacho_reboque_prestador_atribuido_id_fkey"
            columns: ["prestador_atribuido_id"]
            isOneToOne: false
            referencedRelation: "prestadores_assistencia"
            referencedColumns: ["id"]
          },
        ]
      }
      despacho_reboque_convites: {
        Row: {
          created_at: string
          data_aceite: string | null
          data_recusa: string | null
          data_visualizacao: string | null
          despacho_id: string
          distancia_km: number | null
          etapa_conversacao: string | null
          id: string
          latitude_prestador: number | null
          longitude_prestador: number | null
          prestador_id: string
          status: string
          tempo_chegada_minutos: number | null
          token: string
          token_expira_em: string
          valor_calculado: number | null
          valor_km: number | null
          valor_saida: number | null
          whatsapp_enviado: boolean
        }
        Insert: {
          created_at?: string
          data_aceite?: string | null
          data_recusa?: string | null
          data_visualizacao?: string | null
          despacho_id: string
          distancia_km?: number | null
          etapa_conversacao?: string | null
          id?: string
          latitude_prestador?: number | null
          longitude_prestador?: number | null
          prestador_id: string
          status?: string
          tempo_chegada_minutos?: number | null
          token?: string
          token_expira_em?: string
          valor_calculado?: number | null
          valor_km?: number | null
          valor_saida?: number | null
          whatsapp_enviado?: boolean
        }
        Update: {
          created_at?: string
          data_aceite?: string | null
          data_recusa?: string | null
          data_visualizacao?: string | null
          despacho_id?: string
          distancia_km?: number | null
          etapa_conversacao?: string | null
          id?: string
          latitude_prestador?: number | null
          longitude_prestador?: number | null
          prestador_id?: string
          status?: string
          tempo_chegada_minutos?: number | null
          token?: string
          token_expira_em?: string
          valor_calculado?: number | null
          valor_km?: number | null
          valor_saida?: number | null
          whatsapp_enviado?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "despacho_reboque_convites_despacho_id_fkey"
            columns: ["despacho_id"]
            isOneToOne: false
            referencedRelation: "despacho_reboque"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despacho_reboque_convites_prestador_id_fkey"
            columns: ["prestador_id"]
            isOneToOne: false
            referencedRelation: "prestadores_assistencia"
            referencedColumns: ["id"]
          },
        ]
      }
      despacho_reboque_status_log: {
        Row: {
          chamado_id: string
          created_at: string
          id: string
          latitude: number | null
          longitude: number | null
          observacao: string | null
          prestador_id: string
          status: string
        }
        Insert: {
          chamado_id: string
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          observacao?: string | null
          prestador_id: string
          status: string
        }
        Update: {
          chamado_id?: string
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          observacao?: string | null
          prestador_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "despacho_reboque_status_log_chamado_id_fkey"
            columns: ["chamado_id"]
            isOneToOne: false
            referencedRelation: "chamados_assistencia"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despacho_reboque_status_log_prestador_id_fkey"
            columns: ["prestador_id"]
            isOneToOne: false
            referencedRelation: "prestadores_assistencia"
            referencedColumns: ["id"]
          },
        ]
      }
      despacho_reboque_tracking: {
        Row: {
          chamado_id: string
          created_at: string
          id: string
          latitude: number
          longitude: number
          precisao: number | null
          prestador_id: string
          velocidade: number | null
        }
        Insert: {
          chamado_id: string
          created_at?: string
          id?: string
          latitude: number
          longitude: number
          precisao?: number | null
          prestador_id: string
          velocidade?: number | null
        }
        Update: {
          chamado_id?: string
          created_at?: string
          id?: string
          latitude?: number
          longitude?: number
          precisao?: number | null
          prestador_id?: string
          velocidade?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "despacho_reboque_tracking_chamado_id_fkey"
            columns: ["chamado_id"]
            isOneToOne: false
            referencedRelation: "chamados_assistencia"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despacho_reboque_tracking_prestador_id_fkey"
            columns: ["prestador_id"]
            isOneToOne: false
            referencedRelation: "prestadores_assistencia"
            referencedColumns: ["id"]
          },
        ]
      }
      despesas_rateio: {
        Row: {
          created_at: string | null
          descricao: string | null
          fechamento_id: string
          id: string
          quantidade_eventos: number | null
          sinistros_ids: string[] | null
          tipo_beneficio: string
          total_cotas_elegivel: number | null
          valor_por_cota: number | null
          valor_total: number
        }
        Insert: {
          created_at?: string | null
          descricao?: string | null
          fechamento_id: string
          id?: string
          quantidade_eventos?: number | null
          sinistros_ids?: string[] | null
          tipo_beneficio: string
          total_cotas_elegivel?: number | null
          valor_por_cota?: number | null
          valor_total?: number
        }
        Update: {
          created_at?: string | null
          descricao?: string | null
          fechamento_id?: string
          id?: string
          quantidade_eventos?: number | null
          sinistros_ids?: string[] | null
          tipo_beneficio?: string
          total_cotas_elegivel?: number | null
          valor_por_cota?: number | null
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "despesas_rateio_fechamento_id_fkey"
            columns: ["fechamento_id"]
            isOneToOne: false
            referencedRelation: "fechamentos_mensais"
            referencedColumns: ["id"]
          },
        ]
      }
      despesas_recorrentes: {
        Row: {
          agencia: string | null
          ativo: boolean
          banco: string | null
          categoria: string
          conta: string | null
          created_at: string
          descricao: string
          dia_vencimento: number
          forma_pagamento: string | null
          fornecedor_documento: string | null
          fornecedor_nome: string
          frequencia: string
          id: string
          observacao: string | null
          pix_chave: string | null
          proximo_lancamento: string | null
          subcategoria: string | null
          ultimo_lancamento: string | null
          updated_at: string
          valor: number
        }
        Insert: {
          agencia?: string | null
          ativo?: boolean
          banco?: string | null
          categoria: string
          conta?: string | null
          created_at?: string
          descricao: string
          dia_vencimento?: number
          forma_pagamento?: string | null
          fornecedor_documento?: string | null
          fornecedor_nome: string
          frequencia?: string
          id?: string
          observacao?: string | null
          pix_chave?: string | null
          proximo_lancamento?: string | null
          subcategoria?: string | null
          ultimo_lancamento?: string | null
          updated_at?: string
          valor: number
        }
        Update: {
          agencia?: string | null
          ativo?: boolean
          banco?: string | null
          categoria?: string
          conta?: string | null
          created_at?: string
          descricao?: string
          dia_vencimento?: number
          forma_pagamento?: string | null
          fornecedor_documento?: string | null
          fornecedor_nome?: string
          frequencia?: string
          id?: string
          observacao?: string | null
          pix_chave?: string | null
          proximo_lancamento?: string | null
          subcategoria?: string | null
          ultimo_lancamento?: string | null
          updated_at?: string
          valor?: number
        }
        Relationships: []
      }
      disparos_comunicacao: {
        Row: {
          aberto_em: string | null
          campanha_id: string | null
          clicado_em: string | null
          contato_id: string | null
          contato_tipo: string | null
          created_at: string | null
          email: string | null
          entregue_em: string | null
          enviado_em: string | null
          erro_codigo: string | null
          erro_mensagem: string | null
          id: string
          nome: string | null
          status: string | null
          telefone: string | null
          tentativas: number | null
        }
        Insert: {
          aberto_em?: string | null
          campanha_id?: string | null
          clicado_em?: string | null
          contato_id?: string | null
          contato_tipo?: string | null
          created_at?: string | null
          email?: string | null
          entregue_em?: string | null
          enviado_em?: string | null
          erro_codigo?: string | null
          erro_mensagem?: string | null
          id?: string
          nome?: string | null
          status?: string | null
          telefone?: string | null
          tentativas?: number | null
        }
        Update: {
          aberto_em?: string | null
          campanha_id?: string | null
          clicado_em?: string | null
          contato_id?: string | null
          contato_tipo?: string | null
          created_at?: string | null
          email?: string | null
          entregue_em?: string | null
          enviado_em?: string | null
          erro_codigo?: string | null
          erro_mensagem?: string | null
          id?: string
          nome?: string | null
          status?: string | null
          telefone?: string | null
          tentativas?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "disparos_comunicacao_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "campanhas_comunicacao"
            referencedColumns: ["id"]
          },
        ]
      }
      distribuicao_config: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          distribuir_fins_semana: boolean | null
          fallback_usuario_id: string | null
          id: string
          limite_diario_padrao: number | null
          metodo: string | null
          resetar_contadores_hora: number | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          distribuir_fins_semana?: boolean | null
          fallback_usuario_id?: string | null
          id?: string
          limite_diario_padrao?: number | null
          metodo?: string | null
          resetar_contadores_hora?: number | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          distribuir_fins_semana?: boolean | null
          fallback_usuario_id?: string | null
          id?: string
          limite_diario_padrao?: number | null
          metodo?: string | null
          resetar_contadores_hora?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "distribuicao_config_fallback_usuario_id_fkey"
            columns: ["fallback_usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "distribuicao_config_fallback_usuario_id_fkey"
            columns: ["fallback_usuario_id"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "distribuicao_config_fallback_usuario_id_fkey"
            columns: ["fallback_usuario_id"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
        ]
      }
      distribuicao_historico: {
        Row: {
          atribuido_automaticamente: boolean | null
          created_at: string | null
          id: string
          lead_id: string
          motivo: string | null
          vendedor_id: string | null
        }
        Insert: {
          atribuido_automaticamente?: boolean | null
          created_at?: string | null
          id?: string
          lead_id: string
          motivo?: string | null
          vendedor_id?: string | null
        }
        Update: {
          atribuido_automaticamente?: boolean | null
          created_at?: string | null
          id?: string
          lead_id?: string
          motivo?: string | null
          vendedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "distribuicao_historico_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "distribuicao_historico_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["lead_id"]
          },
        ]
      }
      distribuicao_vendedores: {
        Row: {
          created_at: string | null
          id: string
          leads_hoje: number | null
          limite_diario: number | null
          ordem: number | null
          status: string | null
          total_leads: number | null
          ultima_atribuicao: string | null
          updated_at: string | null
          vendedor_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          leads_hoje?: number | null
          limite_diario?: number | null
          ordem?: number | null
          status?: string | null
          total_leads?: number | null
          ultima_atribuicao?: string | null
          updated_at?: string | null
          vendedor_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          leads_hoje?: number | null
          limite_diario?: number | null
          ordem?: number | null
          status?: string | null
          total_leads?: number | null
          ultima_atribuicao?: string | null
          updated_at?: string | null
          vendedor_id?: string
        }
        Relationships: []
      }
      document_types: {
        Row: {
          code: string
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          is_system: boolean | null
          name: string
          required_variables: Json | null
          send_moment: string | null
          sort_order: number | null
          target_audience: string | null
          updated_at: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          is_system?: boolean | null
          name: string
          required_variables?: Json | null
          send_moment?: string | null
          sort_order?: number | null
          target_audience?: string | null
          updated_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          is_system?: boolean | null
          name?: string
          required_variables?: Json | null
          send_moment?: string | null
          sort_order?: number | null
          target_audience?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      documento_assinaturas: {
        Row: {
          assinado_em: string | null
          autentique_documento_id: string | null
          autentique_url: string | null
          autentique_url_download: string | null
          created_at: string | null
          documento_gerado_id: string
          enviado_em: string | null
          expira_em: string | null
          id: string
          signatarios: Json | null
          status: string | null
          tentativas: number | null
          ultimo_erro: string | null
          updated_at: string | null
        }
        Insert: {
          assinado_em?: string | null
          autentique_documento_id?: string | null
          autentique_url?: string | null
          autentique_url_download?: string | null
          created_at?: string | null
          documento_gerado_id: string
          enviado_em?: string | null
          expira_em?: string | null
          id?: string
          signatarios?: Json | null
          status?: string | null
          tentativas?: number | null
          ultimo_erro?: string | null
          updated_at?: string | null
        }
        Update: {
          assinado_em?: string | null
          autentique_documento_id?: string | null
          autentique_url?: string | null
          autentique_url_download?: string | null
          created_at?: string | null
          documento_gerado_id?: string
          enviado_em?: string | null
          expira_em?: string | null
          id?: string
          signatarios?: Json | null
          status?: string | null
          tentativas?: number | null
          ultimo_erro?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documento_assinaturas_documento_gerado_id_fkey"
            columns: ["documento_gerado_id"]
            isOneToOne: false
            referencedRelation: "documento_gerados"
            referencedColumns: ["id"]
          },
        ]
      }
      documento_categorias: {
        Row: {
          ativo: boolean | null
          cor: string | null
          created_at: string | null
          descricao: string | null
          icone: string | null
          id: string
          nome: string
          ordem: number | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          cor?: string | null
          created_at?: string | null
          descricao?: string | null
          icone?: string | null
          id?: string
          nome: string
          ordem?: number | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          cor?: string | null
          created_at?: string | null
          descricao?: string | null
          icone?: string | null
          id?: string
          nome?: string
          ordem?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      documento_gerados: {
        Row: {
          arquivo_nome: string | null
          arquivo_url: string | null
          assinado: boolean | null
          assinado_em: string | null
          assinatura_id: string | null
          assinatura_ip: string | null
          associado_id: string | null
          autentique_id: string | null
          dados_utilizados: Json
          gerado_em: string | null
          gerado_por: string | null
          id: string
          numero_documento: string | null
          template_id: string | null
        }
        Insert: {
          arquivo_nome?: string | null
          arquivo_url?: string | null
          assinado?: boolean | null
          assinado_em?: string | null
          assinatura_id?: string | null
          assinatura_ip?: string | null
          associado_id?: string | null
          autentique_id?: string | null
          dados_utilizados: Json
          gerado_em?: string | null
          gerado_por?: string | null
          id?: string
          numero_documento?: string | null
          template_id?: string | null
        }
        Update: {
          arquivo_nome?: string | null
          arquivo_url?: string | null
          assinado?: boolean | null
          assinado_em?: string | null
          assinatura_id?: string | null
          assinatura_ip?: string | null
          associado_id?: string | null
          autentique_id?: string | null
          dados_utilizados?: Json
          gerado_em?: string | null
          gerado_por?: string | null
          id?: string
          numero_documento?: string | null
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documento_gerados_assinatura_id_fkey"
            columns: ["assinatura_id"]
            isOneToOne: false
            referencedRelation: "documento_assinaturas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documento_gerados_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "associados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documento_gerados_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "documento_gerados_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "documento_gerados_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associado_financeiro"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "documento_gerados_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associados_publico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documento_gerados_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_inadimplentes"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "documento_gerados_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "documento_gerados_gerado_por_fkey"
            columns: ["gerado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documento_gerados_gerado_por_fkey"
            columns: ["gerado_por"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "documento_gerados_gerado_por_fkey"
            columns: ["gerado_por"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "documento_gerados_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "documento_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      documento_templates: {
        Row: {
          anexar_proposta: boolean | null
          ativo: boolean | null
          cabecalho_html: string | null
          canvas_data: Json | null
          categoria_id: string | null
          codigo: string
          config_layout: Json | null
          conteudo: string
          created_at: string | null
          created_by: string | null
          descricao: string | null
          document_type_id: string | null
          id: string
          is_default: boolean | null
          is_default_autentique: boolean | null
          is_default_evento: boolean | null
          is_default_rastreador: boolean | null
          is_default_saida: boolean | null
          nome: string
          perfis_permitidos: string[] | null
          requer_assinatura: boolean | null
          rodape_html: string | null
          status: Database["public"]["Enums"]["template_status"] | null
          template_html: string | null
          thumbnail_url: string | null
          updated_at: string | null
          variaveis: Json | null
          versao: number | null
        }
        Insert: {
          anexar_proposta?: boolean | null
          ativo?: boolean | null
          cabecalho_html?: string | null
          canvas_data?: Json | null
          categoria_id?: string | null
          codigo: string
          config_layout?: Json | null
          conteudo: string
          created_at?: string | null
          created_by?: string | null
          descricao?: string | null
          document_type_id?: string | null
          id?: string
          is_default?: boolean | null
          is_default_autentique?: boolean | null
          is_default_evento?: boolean | null
          is_default_rastreador?: boolean | null
          is_default_saida?: boolean | null
          nome: string
          perfis_permitidos?: string[] | null
          requer_assinatura?: boolean | null
          rodape_html?: string | null
          status?: Database["public"]["Enums"]["template_status"] | null
          template_html?: string | null
          thumbnail_url?: string | null
          updated_at?: string | null
          variaveis?: Json | null
          versao?: number | null
        }
        Update: {
          anexar_proposta?: boolean | null
          ativo?: boolean | null
          cabecalho_html?: string | null
          canvas_data?: Json | null
          categoria_id?: string | null
          codigo?: string
          config_layout?: Json | null
          conteudo?: string
          created_at?: string | null
          created_by?: string | null
          descricao?: string | null
          document_type_id?: string | null
          id?: string
          is_default?: boolean | null
          is_default_autentique?: boolean | null
          is_default_evento?: boolean | null
          is_default_rastreador?: boolean | null
          is_default_saida?: boolean | null
          nome?: string
          perfis_permitidos?: string[] | null
          requer_assinatura?: boolean | null
          rodape_html?: string | null
          status?: Database["public"]["Enums"]["template_status"] | null
          template_html?: string | null
          thumbnail_url?: string | null
          updated_at?: string | null
          variaveis?: Json | null
          versao?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "documento_templates_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "documento_categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documento_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documento_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "documento_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "documento_templates_document_type_id_fkey"
            columns: ["document_type_id"]
            isOneToOne: false
            referencedRelation: "document_types"
            referencedColumns: ["id"]
          },
        ]
      }
      documento_variaveis: {
        Row: {
          codigo: string
          created_at: string | null
          exemplo: string | null
          formato: string | null
          grupo: string
          id: string
          nome_exibicao: string
          origem_campo: string | null
          origem_tabela: string | null
          tipo: string | null
        }
        Insert: {
          codigo: string
          created_at?: string | null
          exemplo?: string | null
          formato?: string | null
          grupo: string
          id?: string
          nome_exibicao: string
          origem_campo?: string | null
          origem_tabela?: string | null
          tipo?: string | null
        }
        Update: {
          codigo?: string
          created_at?: string | null
          exemplo?: string | null
          formato?: string | null
          grupo?: string
          id?: string
          nome_exibicao?: string
          origem_campo?: string | null
          origem_tabela?: string | null
          tipo?: string | null
        }
        Relationships: []
      }
      documentos: {
        Row: {
          analista_id: string | null
          arquivo_url: string
          associado_id: string
          created_at: string
          data_analise: string | null
          id: string
          motivo_reprovacao: string | null
          nome_arquivo: string
          status: Database["public"]["Enums"]["status_documento"]
          tamanho_bytes: number | null
          tipo: Database["public"]["Enums"]["tipo_documento"]
          veiculo_id: string | null
        }
        Insert: {
          analista_id?: string | null
          arquivo_url: string
          associado_id: string
          created_at?: string
          data_analise?: string | null
          id?: string
          motivo_reprovacao?: string | null
          nome_arquivo: string
          status?: Database["public"]["Enums"]["status_documento"]
          tamanho_bytes?: number | null
          tipo: Database["public"]["Enums"]["tipo_documento"]
          veiculo_id?: string | null
        }
        Update: {
          analista_id?: string | null
          arquivo_url?: string
          associado_id?: string
          created_at?: string
          data_analise?: string | null
          id?: string
          motivo_reprovacao?: string | null
          nome_arquivo?: string
          status?: Database["public"]["Enums"]["status_documento"]
          tamanho_bytes?: number | null
          tipo?: Database["public"]["Enums"]["tipo_documento"]
          veiculo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documentos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "associados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "documentos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "documentos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associado_financeiro"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "documentos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associados_publico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_inadimplentes"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "documentos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "documentos_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["veiculo_id"]
          },
          {
            foreignKeyName: "documentos_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["veiculo_id"]
          },
          {
            foreignKeyName: "documentos_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["veiculo_id"]
          },
          {
            foreignKeyName: "documentos_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "vw_veiculos_com_cotas"
            referencedColumns: ["id"]
          },
        ]
      }
      documentos_solicitados: {
        Row: {
          associado_id: string
          contrato_id: string | null
          created_at: string | null
          descricao: string | null
          documento_id: string | null
          enviado_em: string | null
          id: string
          observacao_cliente: string | null
          observacao_solicitacao: string | null
          solicitado_em: string | null
          solicitado_por: string | null
          status: string | null
          tipo_documento: string
          updated_at: string | null
        }
        Insert: {
          associado_id: string
          contrato_id?: string | null
          created_at?: string | null
          descricao?: string | null
          documento_id?: string | null
          enviado_em?: string | null
          id?: string
          observacao_cliente?: string | null
          observacao_solicitacao?: string | null
          solicitado_em?: string | null
          solicitado_por?: string | null
          status?: string | null
          tipo_documento: string
          updated_at?: string | null
        }
        Update: {
          associado_id?: string
          contrato_id?: string | null
          created_at?: string | null
          descricao?: string | null
          documento_id?: string | null
          enviado_em?: string | null
          id?: string
          observacao_cliente?: string | null
          observacao_solicitacao?: string | null
          solicitado_em?: string | null
          solicitado_por?: string | null
          status?: string | null
          tipo_documento?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documentos_solicitados_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "associados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_solicitados_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "documentos_solicitados_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "documentos_solicitados_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associado_financeiro"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "documentos_solicitados_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associados_publico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_solicitados_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_inadimplentes"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "documentos_solicitados_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "documentos_solicitados_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_solicitados_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "documentos_solicitados_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "documentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_solicitados_solicitado_por_fkey"
            columns: ["solicitado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_solicitados_solicitado_por_fkey"
            columns: ["solicitado_por"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "documentos_solicitados_solicitado_por_fkey"
            columns: ["solicitado_por"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
        ]
      }
      empresas_sindicancia: {
        Row: {
          ativo: boolean | null
          cnpj: string
          created_at: string | null
          especialidades: string[] | null
          id: string
          nome_fantasia: string | null
          observacoes: string | null
          profile_id: string | null
          razao_social: string
          regioes_atuacao: string[] | null
          responsavel_cpf: string | null
          responsavel_email: string | null
          responsavel_nome: string
          responsavel_telefone: string | null
          updated_at: string | null
          valor_por_sindicancia: number | null
        }
        Insert: {
          ativo?: boolean | null
          cnpj: string
          created_at?: string | null
          especialidades?: string[] | null
          id?: string
          nome_fantasia?: string | null
          observacoes?: string | null
          profile_id?: string | null
          razao_social: string
          regioes_atuacao?: string[] | null
          responsavel_cpf?: string | null
          responsavel_email?: string | null
          responsavel_nome: string
          responsavel_telefone?: string | null
          updated_at?: string | null
          valor_por_sindicancia?: number | null
        }
        Update: {
          ativo?: boolean | null
          cnpj?: string
          created_at?: string | null
          especialidades?: string[] | null
          id?: string
          nome_fantasia?: string | null
          observacoes?: string | null
          profile_id?: string | null
          razao_social?: string
          regioes_atuacao?: string[] | null
          responsavel_cpf?: string | null
          responsavel_email?: string | null
          responsavel_nome?: string
          responsavel_telefone?: string | null
          updated_at?: string | null
          valor_por_sindicancia?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "empresas_sindicancia_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "empresas_sindicancia_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "empresas_sindicancia_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
        ]
      }
      encaixes_urgentes: {
        Row: {
          created_at: string
          dados_servico: Json
          expira_em: string | null
          id: string
          motivo: string
          nome_cliente: string
          reservado_em: string | null
          reservado_por: string | null
          servico_id: string
          status: string
          telefone_cliente: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          dados_servico?: Json
          expira_em?: string | null
          id?: string
          motivo?: string
          nome_cliente: string
          reservado_em?: string | null
          reservado_por?: string | null
          servico_id: string
          status?: string
          telefone_cliente: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          dados_servico?: Json
          expira_em?: string | null
          id?: string
          motivo?: string
          nome_cliente?: string
          reservado_em?: string | null
          reservado_por?: string | null
          servico_id?: string
          status?: string
          telefone_cliente?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "encaixes_urgentes_reservado_por_fkey"
            columns: ["reservado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encaixes_urgentes_reservado_por_fkey"
            columns: ["reservado_por"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "encaixes_urgentes_reservado_por_fkey"
            columns: ["reservado_por"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "encaixes_urgentes_servico_id_fkey"
            columns: ["servico_id"]
            isOneToOne: false
            referencedRelation: "servicos"
            referencedColumns: ["id"]
          },
        ]
      }
      entrevistas: {
        Row: {
          avaliacao: string | null
          candidato_id: string
          created_at: string | null
          data_hora: string
          duracao_minutos: number | null
          entrevistador_id: string | null
          entrevistador_nome: string | null
          id: string
          link_online: string | null
          local_entrevista: string | null
          nota: number | null
          observacoes: string | null
          status_entrevista: string | null
          tipo_entrevista: string
          updated_at: string | null
        }
        Insert: {
          avaliacao?: string | null
          candidato_id: string
          created_at?: string | null
          data_hora: string
          duracao_minutos?: number | null
          entrevistador_id?: string | null
          entrevistador_nome?: string | null
          id?: string
          link_online?: string | null
          local_entrevista?: string | null
          nota?: number | null
          observacoes?: string | null
          status_entrevista?: string | null
          tipo_entrevista: string
          updated_at?: string | null
        }
        Update: {
          avaliacao?: string | null
          candidato_id?: string
          created_at?: string | null
          data_hora?: string
          duracao_minutos?: number | null
          entrevistador_id?: string | null
          entrevistador_nome?: string | null
          id?: string
          link_online?: string | null
          local_entrevista?: string | null
          nota?: number | null
          observacoes?: string | null
          status_entrevista?: string | null
          tipo_entrevista?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "entrevistas_candidato_id_fkey"
            columns: ["candidato_id"]
            isOneToOne: false
            referencedRelation: "candidatos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entrevistas_entrevistador_id_fkey"
            columns: ["entrevistador_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entrevistas_entrevistador_id_fkey"
            columns: ["entrevistador_id"]
            isOneToOne: false
            referencedRelation: "view_aniversariantes_mes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entrevistas_entrevistador_id_fkey"
            columns: ["entrevistador_id"]
            isOneToOne: false
            referencedRelation: "view_funcionarios_ativos"
            referencedColumns: ["id"]
          },
        ]
      }
      equipes_comerciais: {
        Row: {
          created_at: string
          id: string
          supervisor_id: string
          vendedor_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          supervisor_id: string
          vendedor_id: string
        }
        Update: {
          created_at?: string
          id?: string
          supervisor_id?: string
          vendedor_id?: string
        }
        Relationships: []
      }
      estoque_movimentacoes: {
        Row: {
          created_at: string | null
          fornecedor: string | null
          id: string
          instalacao_id: string | null
          motivo: string | null
          nota_fiscal: string | null
          observacoes: string | null
          quantidade: number
          rastreador_id: string | null
          status_anterior: string | null
          status_novo: string | null
          tipo: string
          updated_at: string | null
          usuario_id: string | null
          veiculo_id: string | null
        }
        Insert: {
          created_at?: string | null
          fornecedor?: string | null
          id?: string
          instalacao_id?: string | null
          motivo?: string | null
          nota_fiscal?: string | null
          observacoes?: string | null
          quantidade?: number
          rastreador_id?: string | null
          status_anterior?: string | null
          status_novo?: string | null
          tipo: string
          updated_at?: string | null
          usuario_id?: string | null
          veiculo_id?: string | null
        }
        Update: {
          created_at?: string | null
          fornecedor?: string | null
          id?: string
          instalacao_id?: string | null
          motivo?: string | null
          nota_fiscal?: string | null
          observacoes?: string | null
          quantidade?: number
          rastreador_id?: string | null
          status_anterior?: string | null
          status_novo?: string | null
          tipo?: string
          updated_at?: string | null
          usuario_id?: string | null
          veiculo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "estoque_movimentacoes_instalacao_id_fkey"
            columns: ["instalacao_id"]
            isOneToOne: false
            referencedRelation: "instalacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_movimentacoes_instalacao_id_fkey"
            columns: ["instalacao_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["instalacao_id"]
          },
          {
            foreignKeyName: "estoque_movimentacoes_rastreador_id_fkey"
            columns: ["rastreador_id"]
            isOneToOne: false
            referencedRelation: "rastreadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_movimentacoes_rastreador_id_fkey"
            columns: ["rastreador_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["rastreador_id"]
          },
          {
            foreignKeyName: "estoque_movimentacoes_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_movimentacoes_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "estoque_movimentacoes_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "estoque_movimentacoes_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_movimentacoes_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["veiculo_id"]
          },
          {
            foreignKeyName: "estoque_movimentacoes_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["veiculo_id"]
          },
          {
            foreignKeyName: "estoque_movimentacoes_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["veiculo_id"]
          },
          {
            foreignKeyName: "estoque_movimentacoes_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "vw_veiculos_com_cotas"
            referencedColumns: ["id"]
          },
        ]
      }
      evento_cotacoes_pecas: {
        Row: {
          aprovada: boolean | null
          aprovada_em: string | null
          aprovada_por: string | null
          auto_center_id: string
          created_at: string | null
          id: string
          itens: Json
          mensagem_enviada: string | null
          observacoes_auto_center: string | null
          prazo_geral: string | null
          prazo_resposta: string | null
          resposta: Json | null
          sinistro_id: string
          status: string | null
          updated_at: string | null
          valor_total: number | null
          whatsapp_mensagem_id: string | null
        }
        Insert: {
          aprovada?: boolean | null
          aprovada_em?: string | null
          aprovada_por?: string | null
          auto_center_id: string
          created_at?: string | null
          id?: string
          itens?: Json
          mensagem_enviada?: string | null
          observacoes_auto_center?: string | null
          prazo_geral?: string | null
          prazo_resposta?: string | null
          resposta?: Json | null
          sinistro_id: string
          status?: string | null
          updated_at?: string | null
          valor_total?: number | null
          whatsapp_mensagem_id?: string | null
        }
        Update: {
          aprovada?: boolean | null
          aprovada_em?: string | null
          aprovada_por?: string | null
          auto_center_id?: string
          created_at?: string | null
          id?: string
          itens?: Json
          mensagem_enviada?: string | null
          observacoes_auto_center?: string | null
          prazo_geral?: string | null
          prazo_resposta?: string | null
          resposta?: Json | null
          sinistro_id?: string
          status?: string | null
          updated_at?: string | null
          valor_total?: number | null
          whatsapp_mensagem_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evento_cotacoes_pecas_aprovada_por_fkey"
            columns: ["aprovada_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evento_cotacoes_pecas_aprovada_por_fkey"
            columns: ["aprovada_por"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "evento_cotacoes_pecas_aprovada_por_fkey"
            columns: ["aprovada_por"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "evento_cotacoes_pecas_auto_center_id_fkey"
            columns: ["auto_center_id"]
            isOneToOne: false
            referencedRelation: "auto_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evento_cotacoes_pecas_sinistro_id_fkey"
            columns: ["sinistro_id"]
            isOneToOne: false
            referencedRelation: "sinistros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evento_cotacoes_pecas_whatsapp_mensagem_id_fkey"
            columns: ["whatsapp_mensagem_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_mensagens"
            referencedColumns: ["id"]
          },
        ]
      }
      extratos_bancarios: {
        Row: {
          arquivo_nome: string
          arquivo_path: string | null
          conta_bancaria_id: string | null
          created_at: string | null
          data_fim: string
          data_inicio: string
          erro_mensagem: string | null
          id: string
          importado_por: string | null
          qtd_conciliados: number | null
          qtd_lancamentos: number | null
          saldo_final: number | null
          saldo_inicial: number | null
          status: string | null
          total_creditos: number | null
          total_debitos: number | null
          updated_at: string | null
        }
        Insert: {
          arquivo_nome: string
          arquivo_path?: string | null
          conta_bancaria_id?: string | null
          created_at?: string | null
          data_fim: string
          data_inicio: string
          erro_mensagem?: string | null
          id?: string
          importado_por?: string | null
          qtd_conciliados?: number | null
          qtd_lancamentos?: number | null
          saldo_final?: number | null
          saldo_inicial?: number | null
          status?: string | null
          total_creditos?: number | null
          total_debitos?: number | null
          updated_at?: string | null
        }
        Update: {
          arquivo_nome?: string
          arquivo_path?: string | null
          conta_bancaria_id?: string | null
          created_at?: string | null
          data_fim?: string
          data_inicio?: string
          erro_mensagem?: string | null
          id?: string
          importado_por?: string | null
          qtd_conciliados?: number | null
          qtd_lancamentos?: number | null
          saldo_final?: number | null
          saldo_inicial?: number | null
          status?: string | null
          total_creditos?: number | null
          total_debitos?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "extratos_bancarios_conta_bancaria_id_fkey"
            columns: ["conta_bancaria_id"]
            isOneToOne: false
            referencedRelation: "contas_bancarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extratos_bancarios_importado_por_fkey"
            columns: ["importado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extratos_bancarios_importado_por_fkey"
            columns: ["importado_por"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "extratos_bancarios_importado_por_fkey"
            columns: ["importado_por"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
        ]
      }
      faixas_cotas: {
        Row: {
          ajuste_percentual: number | null
          ativo: boolean | null
          cotas_aplicativo: number | null
          cotas_diesel: number | null
          cotas_eletrico: number | null
          cotas_moto: number | null
          cotas_passeio: number | null
          created_at: string | null
          fipe_ate: number
          fipe_de: number
          id: string
          quantidade_cotas: number
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          ajuste_percentual?: number | null
          ativo?: boolean | null
          cotas_aplicativo?: number | null
          cotas_diesel?: number | null
          cotas_eletrico?: number | null
          cotas_moto?: number | null
          cotas_passeio?: number | null
          created_at?: string | null
          fipe_ate: number
          fipe_de: number
          id?: string
          quantidade_cotas: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          ajuste_percentual?: number | null
          ativo?: boolean | null
          cotas_aplicativo?: number | null
          cotas_diesel?: number | null
          cotas_eletrico?: number | null
          cotas_moto?: number | null
          cotas_passeio?: number | null
          created_at?: string | null
          fipe_ate?: number
          fipe_de?: number
          id?: string
          quantidade_cotas?: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      faixas_cotas_historico: {
        Row: {
          ajuste_anterior: number | null
          ajuste_novo: number | null
          alterado_em: string | null
          alterado_por: string | null
          faixa_id: string | null
          id: string
          motivo: string | null
        }
        Insert: {
          ajuste_anterior?: number | null
          ajuste_novo?: number | null
          alterado_em?: string | null
          alterado_por?: string | null
          faixa_id?: string | null
          id?: string
          motivo?: string | null
        }
        Update: {
          ajuste_anterior?: number | null
          ajuste_novo?: number | null
          alterado_em?: string | null
          alterado_por?: string | null
          faixa_id?: string | null
          id?: string
          motivo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "faixas_cotas_historico_faixa_id_fkey"
            columns: ["faixa_id"]
            isOneToOne: false
            referencedRelation: "faixas_cotas"
            referencedColumns: ["id"]
          },
        ]
      }
      faixas_producao: {
        Row: {
          created_at: string | null
          descricao: string | null
          id: string
          is_active: boolean | null
          placas_max: number | null
          placas_min: number
          valor_bonus: number
        }
        Insert: {
          created_at?: string | null
          descricao?: string | null
          id?: string
          is_active?: boolean | null
          placas_max?: number | null
          placas_min: number
          valor_bonus: number
        }
        Update: {
          created_at?: string | null
          descricao?: string | null
          id?: string
          is_active?: boolean | null
          placas_max?: number | null
          placas_min?: number
          valor_bonus?: number
        }
        Relationships: []
      }
      faixas_taxa_administrativa: {
        Row: {
          ajuste_percentual: number | null
          ativo: boolean | null
          created_at: string | null
          fipe_ate: number
          fipe_de: number
          id: string
          updated_at: string | null
          valor_taxa: number
        }
        Insert: {
          ajuste_percentual?: number | null
          ativo?: boolean | null
          created_at?: string | null
          fipe_ate: number
          fipe_de: number
          id?: string
          updated_at?: string | null
          valor_taxa?: number
        }
        Update: {
          ajuste_percentual?: number | null
          ativo?: boolean | null
          created_at?: string | null
          fipe_ate?: number
          fipe_de?: number
          id?: string
          updated_at?: string | null
          valor_taxa?: number
        }
        Relationships: []
      }
      faturamentos: {
        Row: {
          created_at: string | null
          data_envio: string | null
          data_fechamento: string | null
          data_geracao: string | null
          data_vencimento: string | null
          gerado_por: string | null
          id: string
          referencia_ano: number
          referencia_mes: number
          status: string | null
          total_associados: number | null
          total_cobrancas: number | null
          updated_at: string | null
          valor_pago: number | null
          valor_pendente: number | null
          valor_total: number | null
        }
        Insert: {
          created_at?: string | null
          data_envio?: string | null
          data_fechamento?: string | null
          data_geracao?: string | null
          data_vencimento?: string | null
          gerado_por?: string | null
          id?: string
          referencia_ano: number
          referencia_mes: number
          status?: string | null
          total_associados?: number | null
          total_cobrancas?: number | null
          updated_at?: string | null
          valor_pago?: number | null
          valor_pendente?: number | null
          valor_total?: number | null
        }
        Update: {
          created_at?: string | null
          data_envio?: string | null
          data_fechamento?: string | null
          data_geracao?: string | null
          data_vencimento?: string | null
          gerado_por?: string | null
          id?: string
          referencia_ano?: number
          referencia_mes?: number
          status?: string | null
          total_associados?: number | null
          total_cobrancas?: number | null
          updated_at?: string | null
          valor_pago?: number | null
          valor_pendente?: number | null
          valor_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "faturamentos_gerado_por_fkey"
            columns: ["gerado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faturamentos_gerado_por_fkey"
            columns: ["gerado_por"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "faturamentos_gerado_por_fkey"
            columns: ["gerado_por"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
        ]
      }
      fechamentos_contabeis: {
        Row: {
          ano: number
          created_at: string | null
          data_fechamento: string | null
          data_reabertura: string | null
          fechado_por: string | null
          id: string
          mes: number
          motivo_reabertura: string | null
          qtd_lancamentos: number | null
          reaberto_por: string | null
          resultado_periodo: number | null
          status: string | null
          total_creditos: number | null
          total_debitos: number | null
          updated_at: string | null
        }
        Insert: {
          ano: number
          created_at?: string | null
          data_fechamento?: string | null
          data_reabertura?: string | null
          fechado_por?: string | null
          id?: string
          mes: number
          motivo_reabertura?: string | null
          qtd_lancamentos?: number | null
          reaberto_por?: string | null
          resultado_periodo?: number | null
          status?: string | null
          total_creditos?: number | null
          total_debitos?: number | null
          updated_at?: string | null
        }
        Update: {
          ano?: number
          created_at?: string | null
          data_fechamento?: string | null
          data_reabertura?: string | null
          fechado_por?: string | null
          id?: string
          mes?: number
          motivo_reabertura?: string | null
          qtd_lancamentos?: number | null
          reaberto_por?: string | null
          resultado_periodo?: number | null
          status?: string | null
          total_creditos?: number | null
          total_debitos?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fechamentos_contabeis_fechado_por_fkey"
            columns: ["fechado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fechamentos_contabeis_fechado_por_fkey"
            columns: ["fechado_por"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "fechamentos_contabeis_fechado_por_fkey"
            columns: ["fechado_por"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "fechamentos_contabeis_reaberto_por_fkey"
            columns: ["reaberto_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fechamentos_contabeis_reaberto_por_fkey"
            columns: ["reaberto_por"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "fechamentos_contabeis_reaberto_por_fkey"
            columns: ["reaberto_por"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
        ]
      }
      fechamentos_mensais: {
        Row: {
          ano: number
          aprovado_em: string | null
          aprovado_por: string | null
          created_at: string | null
          data_fechamento: string | null
          fechado_em: string | null
          fechado_por: string | null
          id: string
          mes: number
          processado_em: string | null
          processado_por: string | null
          status: string | null
          total_adicionais: number | null
          total_associados_ativos: number | null
          total_cotas_ativas: number | null
          total_despesas_rateio: number | null
          total_geral: number | null
          total_taxa_administrativa: number | null
          updated_at: string | null
        }
        Insert: {
          ano: number
          aprovado_em?: string | null
          aprovado_por?: string | null
          created_at?: string | null
          data_fechamento?: string | null
          fechado_em?: string | null
          fechado_por?: string | null
          id?: string
          mes: number
          processado_em?: string | null
          processado_por?: string | null
          status?: string | null
          total_adicionais?: number | null
          total_associados_ativos?: number | null
          total_cotas_ativas?: number | null
          total_despesas_rateio?: number | null
          total_geral?: number | null
          total_taxa_administrativa?: number | null
          updated_at?: string | null
        }
        Update: {
          ano?: number
          aprovado_em?: string | null
          aprovado_por?: string | null
          created_at?: string | null
          data_fechamento?: string | null
          fechado_em?: string | null
          fechado_por?: string | null
          id?: string
          mes?: number
          processado_em?: string | null
          processado_por?: string | null
          status?: string | null
          total_adicionais?: number | null
          total_associados_ativos?: number | null
          total_cotas_ativas?: number | null
          total_despesas_rateio?: number | null
          total_geral?: number | null
          total_taxa_administrativa?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fechamentos_mensais_aprovado_por_fkey"
            columns: ["aprovado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fechamentos_mensais_aprovado_por_fkey"
            columns: ["aprovado_por"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "fechamentos_mensais_aprovado_por_fkey"
            columns: ["aprovado_por"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "fechamentos_mensais_fechado_por_fkey"
            columns: ["fechado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fechamentos_mensais_fechado_por_fkey"
            columns: ["fechado_por"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "fechamentos_mensais_fechado_por_fkey"
            columns: ["fechado_por"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "fechamentos_mensais_processado_por_fkey"
            columns: ["processado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fechamentos_mensais_processado_por_fkey"
            columns: ["processado_por"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "fechamentos_mensais_processado_por_fkey"
            columns: ["processado_por"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
        ]
      }
      ferias: {
        Row: {
          adiantamento_13: boolean | null
          aprovado_em: string | null
          aprovado_por: string | null
          created_at: string | null
          data_fim: string
          data_inicio: string
          dias_abono: number | null
          dias_gozados: number
          funcionario_id: string
          id: string
          observacoes: string | null
          periodo_aquisitivo_fim: string
          periodo_aquisitivo_inicio: string
          status: string | null
          updated_at: string | null
          valor_abono: number | null
        }
        Insert: {
          adiantamento_13?: boolean | null
          aprovado_em?: string | null
          aprovado_por?: string | null
          created_at?: string | null
          data_fim: string
          data_inicio: string
          dias_abono?: number | null
          dias_gozados: number
          funcionario_id: string
          id?: string
          observacoes?: string | null
          periodo_aquisitivo_fim: string
          periodo_aquisitivo_inicio: string
          status?: string | null
          updated_at?: string | null
          valor_abono?: number | null
        }
        Update: {
          adiantamento_13?: boolean | null
          aprovado_em?: string | null
          aprovado_por?: string | null
          created_at?: string | null
          data_fim?: string
          data_inicio?: string
          dias_abono?: number | null
          dias_gozados?: number
          funcionario_id?: string
          id?: string
          observacoes?: string | null
          periodo_aquisitivo_fim?: string
          periodo_aquisitivo_inicio?: string
          status?: string | null
          updated_at?: string | null
          valor_abono?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ferias_aprovado_por_fkey"
            columns: ["aprovado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ferias_aprovado_por_fkey"
            columns: ["aprovado_por"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "ferias_aprovado_por_fkey"
            columns: ["aprovado_por"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "ferias_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ferias_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "view_aniversariantes_mes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ferias_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "view_funcionarios_ativos"
            referencedColumns: ["id"]
          },
        ]
      }
      fila_servicos: {
        Row: {
          created_at: string | null
          distancia_km: number
          expires_at: string | null
          id: string
          motivo: string | null
          prioridade: number | null
          profissional_id: string
          servico_id: string
          status: string | null
        }
        Insert: {
          created_at?: string | null
          distancia_km: number
          expires_at?: string | null
          id?: string
          motivo?: string | null
          prioridade?: number | null
          profissional_id: string
          servico_id: string
          status?: string | null
        }
        Update: {
          created_at?: string | null
          distancia_km?: number
          expires_at?: string | null
          id?: string
          motivo?: string | null
          prioridade?: number | null
          profissional_id?: string
          servico_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fila_servicos_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fila_servicos_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "fila_servicos_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "fila_servicos_servico_id_fkey"
            columns: ["servico_id"]
            isOneToOne: false
            referencedRelation: "servicos"
            referencedColumns: ["id"]
          },
        ]
      }
      folha_pagamento: {
        Row: {
          adiantamento: number | null
          adicional_noturno: number | null
          ano: number
          aprovado_em: string | null
          aprovado_por: string | null
          bonus: number | null
          calculado_em: string | null
          calculado_por: string | null
          comissoes: number | null
          created_at: string | null
          emprestimo_consignado: number | null
          funcionario_id: string
          horas_extras_qtd: number | null
          horas_extras_valor: number | null
          id: string
          inss: number
          irrf: number
          mes: number
          observacoes: string | null
          outros_descontos: number | null
          outros_proventos: number | null
          plano_saude: number | null
          salario_base: number
          salario_liquido: number
          status: string | null
          total_descontos: number
          total_proventos: number
          updated_at: string | null
          vale_refeicao: number | null
          vale_transporte: number | null
        }
        Insert: {
          adiantamento?: number | null
          adicional_noturno?: number | null
          ano: number
          aprovado_em?: string | null
          aprovado_por?: string | null
          bonus?: number | null
          calculado_em?: string | null
          calculado_por?: string | null
          comissoes?: number | null
          created_at?: string | null
          emprestimo_consignado?: number | null
          funcionario_id: string
          horas_extras_qtd?: number | null
          horas_extras_valor?: number | null
          id?: string
          inss?: number
          irrf?: number
          mes: number
          observacoes?: string | null
          outros_descontos?: number | null
          outros_proventos?: number | null
          plano_saude?: number | null
          salario_base?: number
          salario_liquido?: number
          status?: string | null
          total_descontos?: number
          total_proventos?: number
          updated_at?: string | null
          vale_refeicao?: number | null
          vale_transporte?: number | null
        }
        Update: {
          adiantamento?: number | null
          adicional_noturno?: number | null
          ano?: number
          aprovado_em?: string | null
          aprovado_por?: string | null
          bonus?: number | null
          calculado_em?: string | null
          calculado_por?: string | null
          comissoes?: number | null
          created_at?: string | null
          emprestimo_consignado?: number | null
          funcionario_id?: string
          horas_extras_qtd?: number | null
          horas_extras_valor?: number | null
          id?: string
          inss?: number
          irrf?: number
          mes?: number
          observacoes?: string | null
          outros_descontos?: number | null
          outros_proventos?: number | null
          plano_saude?: number | null
          salario_base?: number
          salario_liquido?: number
          status?: string | null
          total_descontos?: number
          total_proventos?: number
          updated_at?: string | null
          vale_refeicao?: number | null
          vale_transporte?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "folha_pagamento_aprovado_por_fkey"
            columns: ["aprovado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folha_pagamento_aprovado_por_fkey"
            columns: ["aprovado_por"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "folha_pagamento_aprovado_por_fkey"
            columns: ["aprovado_por"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "folha_pagamento_calculado_por_fkey"
            columns: ["calculado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folha_pagamento_calculado_por_fkey"
            columns: ["calculado_por"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "folha_pagamento_calculado_por_fkey"
            columns: ["calculado_por"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "folha_pagamento_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folha_pagamento_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "view_aniversariantes_mes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folha_pagamento_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "view_funcionarios_ativos"
            referencedColumns: ["id"]
          },
        ]
      }
      fotos_reboquista: {
        Row: {
          arquivo_url: string
          chamado_id: string
          created_at: string
          id: string
          momento: string | null
          observacao: string | null
          uploaded_by: string
        }
        Insert: {
          arquivo_url: string
          chamado_id: string
          created_at?: string
          id?: string
          momento?: string | null
          observacao?: string | null
          uploaded_by: string
        }
        Update: {
          arquivo_url?: string
          chamado_id?: string
          created_at?: string
          id?: string
          momento?: string | null
          observacao?: string | null
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "fotos_reboquista_chamado_id_fkey"
            columns: ["chamado_id"]
            isOneToOne: false
            referencedRelation: "chamados_assistencia"
            referencedColumns: ["id"]
          },
        ]
      }
      funcionarios: {
        Row: {
          agencia: string | null
          ano_recorde: number | null
          bairro: string | null
          banco: string | null
          carga_horaria_semanal: number | null
          cargo_id: string | null
          celular: string | null
          cep: string | null
          certificado_reservista: string | null
          cidade: string | null
          cnh: string | null
          cnh_categoria: string | null
          cnh_validade: string | null
          complemento: string | null
          conta: string | null
          cpf: string
          created_at: string | null
          ctps_numero: string | null
          ctps_serie: string | null
          ctps_uf: string | null
          data_admissao: string
          data_demissao: string | null
          data_nascimento: string | null
          departamento_id: string | null
          email_pessoal: string | null
          estado: string | null
          estado_civil: string | null
          foto_url: string | null
          gestor_id: string | null
          horario_entrada: string | null
          horario_saida: string | null
          id: string
          intervalo_minutos: number | null
          logradouro: string | null
          matricula: string | null
          mes_recorde: number | null
          motivo_demissao: string | null
          nacionalidade: string | null
          naturalidade: string | null
          nome_completo: string
          numero: string | null
          pis: string | null
          pix_chave: string | null
          pix_tipo: string | null
          recorde_vendas_mensal: number | null
          rg: string | null
          rg_orgao: string | null
          salario_atual: number | null
          secao_eleitoral: string | null
          sexo: string | null
          status: string | null
          telefone: string | null
          tipo_conta: string | null
          tipo_contrato: string | null
          titulo_eleitor: string | null
          updated_at: string | null
          usuario_id: string | null
          zona_eleitoral: string | null
        }
        Insert: {
          agencia?: string | null
          ano_recorde?: number | null
          bairro?: string | null
          banco?: string | null
          carga_horaria_semanal?: number | null
          cargo_id?: string | null
          celular?: string | null
          cep?: string | null
          certificado_reservista?: string | null
          cidade?: string | null
          cnh?: string | null
          cnh_categoria?: string | null
          cnh_validade?: string | null
          complemento?: string | null
          conta?: string | null
          cpf: string
          created_at?: string | null
          ctps_numero?: string | null
          ctps_serie?: string | null
          ctps_uf?: string | null
          data_admissao: string
          data_demissao?: string | null
          data_nascimento?: string | null
          departamento_id?: string | null
          email_pessoal?: string | null
          estado?: string | null
          estado_civil?: string | null
          foto_url?: string | null
          gestor_id?: string | null
          horario_entrada?: string | null
          horario_saida?: string | null
          id?: string
          intervalo_minutos?: number | null
          logradouro?: string | null
          matricula?: string | null
          mes_recorde?: number | null
          motivo_demissao?: string | null
          nacionalidade?: string | null
          naturalidade?: string | null
          nome_completo: string
          numero?: string | null
          pis?: string | null
          pix_chave?: string | null
          pix_tipo?: string | null
          recorde_vendas_mensal?: number | null
          rg?: string | null
          rg_orgao?: string | null
          salario_atual?: number | null
          secao_eleitoral?: string | null
          sexo?: string | null
          status?: string | null
          telefone?: string | null
          tipo_conta?: string | null
          tipo_contrato?: string | null
          titulo_eleitor?: string | null
          updated_at?: string | null
          usuario_id?: string | null
          zona_eleitoral?: string | null
        }
        Update: {
          agencia?: string | null
          ano_recorde?: number | null
          bairro?: string | null
          banco?: string | null
          carga_horaria_semanal?: number | null
          cargo_id?: string | null
          celular?: string | null
          cep?: string | null
          certificado_reservista?: string | null
          cidade?: string | null
          cnh?: string | null
          cnh_categoria?: string | null
          cnh_validade?: string | null
          complemento?: string | null
          conta?: string | null
          cpf?: string
          created_at?: string | null
          ctps_numero?: string | null
          ctps_serie?: string | null
          ctps_uf?: string | null
          data_admissao?: string
          data_demissao?: string | null
          data_nascimento?: string | null
          departamento_id?: string | null
          email_pessoal?: string | null
          estado?: string | null
          estado_civil?: string | null
          foto_url?: string | null
          gestor_id?: string | null
          horario_entrada?: string | null
          horario_saida?: string | null
          id?: string
          intervalo_minutos?: number | null
          logradouro?: string | null
          matricula?: string | null
          mes_recorde?: number | null
          motivo_demissao?: string | null
          nacionalidade?: string | null
          naturalidade?: string | null
          nome_completo?: string
          numero?: string | null
          pis?: string | null
          pix_chave?: string | null
          pix_tipo?: string | null
          recorde_vendas_mensal?: number | null
          rg?: string | null
          rg_orgao?: string | null
          salario_atual?: number | null
          secao_eleitoral?: string | null
          sexo?: string | null
          status?: string | null
          telefone?: string | null
          tipo_conta?: string | null
          tipo_contrato?: string | null
          titulo_eleitor?: string | null
          updated_at?: string | null
          usuario_id?: string | null
          zona_eleitoral?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "funcionarios_cargo_id_fkey"
            columns: ["cargo_id"]
            isOneToOne: false
            referencedRelation: "cargos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcionarios_departamento_id_fkey"
            columns: ["departamento_id"]
            isOneToOne: false
            referencedRelation: "departamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcionarios_gestor_id_fkey"
            columns: ["gestor_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcionarios_gestor_id_fkey"
            columns: ["gestor_id"]
            isOneToOne: false
            referencedRelation: "view_aniversariantes_mes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcionarios_gestor_id_fkey"
            columns: ["gestor_id"]
            isOneToOne: false
            referencedRelation: "view_funcionarios_ativos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcionarios_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcionarios_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: true
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "funcionarios_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: true
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
        ]
      }
      funcionarios_beneficios: {
        Row: {
          ativo: boolean | null
          beneficio_id: string
          created_at: string | null
          dados_adicionais: Json | null
          data_fim: string | null
          data_inicio: string
          funcionario_id: string
          id: string
          valor_empresa: number | null
          valor_funcionario: number | null
        }
        Insert: {
          ativo?: boolean | null
          beneficio_id: string
          created_at?: string | null
          dados_adicionais?: Json | null
          data_fim?: string | null
          data_inicio: string
          funcionario_id: string
          id?: string
          valor_empresa?: number | null
          valor_funcionario?: number | null
        }
        Update: {
          ativo?: boolean | null
          beneficio_id?: string
          created_at?: string | null
          dados_adicionais?: Json | null
          data_fim?: string | null
          data_inicio?: string
          funcionario_id?: string
          id?: string
          valor_empresa?: number | null
          valor_funcionario?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "funcionarios_beneficios_beneficio_id_fkey"
            columns: ["beneficio_id"]
            isOneToOne: false
            referencedRelation: "beneficios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcionarios_beneficios_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcionarios_beneficios_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "view_aniversariantes_mes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcionarios_beneficios_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "view_funcionarios_ativos"
            referencedColumns: ["id"]
          },
        ]
      }
      funcionarios_dependentes: {
        Row: {
          cpf: string | null
          created_at: string | null
          data_nascimento: string | null
          funcionario_id: string
          id: string
          inclui_ir: boolean | null
          inclui_plano_saude: boolean | null
          nome: string
          parentesco: string | null
        }
        Insert: {
          cpf?: string | null
          created_at?: string | null
          data_nascimento?: string | null
          funcionario_id: string
          id?: string
          inclui_ir?: boolean | null
          inclui_plano_saude?: boolean | null
          nome: string
          parentesco?: string | null
        }
        Update: {
          cpf?: string | null
          created_at?: string | null
          data_nascimento?: string | null
          funcionario_id?: string
          id?: string
          inclui_ir?: boolean | null
          inclui_plano_saude?: boolean | null
          nome?: string
          parentesco?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "funcionarios_dependentes_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcionarios_dependentes_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "view_aniversariantes_mes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcionarios_dependentes_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "view_funcionarios_ativos"
            referencedColumns: ["id"]
          },
        ]
      }
      funcionarios_documentos: {
        Row: {
          arquivo_url: string
          created_at: string | null
          data_validade: string | null
          enviado_por: string | null
          funcionario_id: string
          id: string
          nome: string
          observacoes: string | null
          tipo: string
        }
        Insert: {
          arquivo_url: string
          created_at?: string | null
          data_validade?: string | null
          enviado_por?: string | null
          funcionario_id: string
          id?: string
          nome: string
          observacoes?: string | null
          tipo: string
        }
        Update: {
          arquivo_url?: string
          created_at?: string | null
          data_validade?: string | null
          enviado_por?: string | null
          funcionario_id?: string
          id?: string
          nome?: string
          observacoes?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "funcionarios_documentos_enviado_por_fkey"
            columns: ["enviado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcionarios_documentos_enviado_por_fkey"
            columns: ["enviado_por"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "funcionarios_documentos_enviado_por_fkey"
            columns: ["enviado_por"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "funcionarios_documentos_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcionarios_documentos_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "view_aniversariantes_mes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcionarios_documentos_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "view_funcionarios_ativos"
            referencedColumns: ["id"]
          },
        ]
      }
      funcionarios_historico: {
        Row: {
          cargo_anterior_id: string | null
          cargo_novo_id: string | null
          created_at: string | null
          data_vigencia: string
          departamento_anterior_id: string | null
          departamento_novo_id: string | null
          funcionario_id: string
          id: string
          motivo: string | null
          registrado_por: string | null
          salario_anterior: number | null
          salario_novo: number | null
          tipo: string
        }
        Insert: {
          cargo_anterior_id?: string | null
          cargo_novo_id?: string | null
          created_at?: string | null
          data_vigencia: string
          departamento_anterior_id?: string | null
          departamento_novo_id?: string | null
          funcionario_id: string
          id?: string
          motivo?: string | null
          registrado_por?: string | null
          salario_anterior?: number | null
          salario_novo?: number | null
          tipo: string
        }
        Update: {
          cargo_anterior_id?: string | null
          cargo_novo_id?: string | null
          created_at?: string | null
          data_vigencia?: string
          departamento_anterior_id?: string | null
          departamento_novo_id?: string | null
          funcionario_id?: string
          id?: string
          motivo?: string | null
          registrado_por?: string | null
          salario_anterior?: number | null
          salario_novo?: number | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "funcionarios_historico_cargo_anterior_id_fkey"
            columns: ["cargo_anterior_id"]
            isOneToOne: false
            referencedRelation: "cargos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcionarios_historico_cargo_novo_id_fkey"
            columns: ["cargo_novo_id"]
            isOneToOne: false
            referencedRelation: "cargos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcionarios_historico_departamento_anterior_id_fkey"
            columns: ["departamento_anterior_id"]
            isOneToOne: false
            referencedRelation: "departamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcionarios_historico_departamento_novo_id_fkey"
            columns: ["departamento_novo_id"]
            isOneToOne: false
            referencedRelation: "departamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcionarios_historico_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcionarios_historico_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "view_aniversariantes_mes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcionarios_historico_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "view_funcionarios_ativos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcionarios_historico_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcionarios_historico_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "funcionarios_historico_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
        ]
      }
      funcionarios_treinamentos: {
        Row: {
          certificado_url: string | null
          created_at: string | null
          data_conclusao: string | null
          data_inscricao: string | null
          funcionario_id: string
          id: string
          nota: number | null
          observacoes: string | null
          status: string | null
          treinamento_id: string
        }
        Insert: {
          certificado_url?: string | null
          created_at?: string | null
          data_conclusao?: string | null
          data_inscricao?: string | null
          funcionario_id: string
          id?: string
          nota?: number | null
          observacoes?: string | null
          status?: string | null
          treinamento_id: string
        }
        Update: {
          certificado_url?: string | null
          created_at?: string | null
          data_conclusao?: string | null
          data_inscricao?: string | null
          funcionario_id?: string
          id?: string
          nota?: number | null
          observacoes?: string | null
          status?: string | null
          treinamento_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "funcionarios_treinamentos_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcionarios_treinamentos_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "view_aniversariantes_mes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcionarios_treinamentos_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "view_funcionarios_ativos"
            referencedColumns: ["id"]
          },
        ]
      }
      gastos_beneficios: {
        Row: {
          associado_id: string
          beneficio_id: string
          beneficio_tipo: string
          chamado_id: string | null
          contrato_id: string | null
          created_at: string | null
          data_ocorrencia: string
          descricao: string | null
          id: string
          sinistro_id: string | null
          valor_gasto: number
        }
        Insert: {
          associado_id: string
          beneficio_id: string
          beneficio_tipo: string
          chamado_id?: string | null
          contrato_id?: string | null
          created_at?: string | null
          data_ocorrencia: string
          descricao?: string | null
          id?: string
          sinistro_id?: string | null
          valor_gasto: number
        }
        Update: {
          associado_id?: string
          beneficio_id?: string
          beneficio_tipo?: string
          chamado_id?: string | null
          contrato_id?: string | null
          created_at?: string | null
          data_ocorrencia?: string
          descricao?: string | null
          id?: string
          sinistro_id?: string | null
          valor_gasto?: number
        }
        Relationships: [
          {
            foreignKeyName: "gastos_beneficios_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "associados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gastos_beneficios_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "gastos_beneficios_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "gastos_beneficios_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associado_financeiro"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "gastos_beneficios_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associados_publico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gastos_beneficios_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_inadimplentes"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "gastos_beneficios_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "gastos_beneficios_chamado_id_fkey"
            columns: ["chamado_id"]
            isOneToOne: false
            referencedRelation: "chamados_assistencia"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gastos_beneficios_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gastos_beneficios_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "gastos_beneficios_sinistro_id_fkey"
            columns: ["sinistro_id"]
            isOneToOne: false
            referencedRelation: "sinistros"
            referencedColumns: ["id"]
          },
        ]
      }
      grades_comissao: {
        Row: {
          ativo: boolean
          created_at: string
          created_by: string | null
          descricao: string | null
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      grades_comissao_niveis: {
        Row: {
          created_at: string
          grade_id: string
          id: string
          nome: string
          ordem: number
          percentual: number
        }
        Insert: {
          created_at?: string
          grade_id: string
          id?: string
          nome: string
          ordem?: number
          percentual: number
        }
        Update: {
          created_at?: string
          grade_id?: string
          id?: string
          nome?: string
          ordem?: number
          percentual?: number
        }
        Relationships: [
          {
            foreignKeyName: "grades_comissao_niveis_grade_id_fkey"
            columns: ["grade_id"]
            isOneToOne: false
            referencedRelation: "grades_comissao"
            referencedColumns: ["id"]
          },
        ]
      }
      hinova_mapeamentos: {
        Row: {
          ativo: boolean | null
          codigo_hinova: number
          codigo_local: string
          created_at: string | null
          descricao: string | null
          id: string
          tipo: string
        }
        Insert: {
          ativo?: boolean | null
          codigo_hinova: number
          codigo_local: string
          created_at?: string | null
          descricao?: string | null
          id?: string
          tipo: string
        }
        Update: {
          ativo?: boolean | null
          codigo_hinova?: number
          codigo_local?: string
          created_at?: string | null
          descricao?: string | null
          id?: string
          tipo?: string
        }
        Relationships: []
      }
      indicacoes: {
        Row: {
          associado_id: string | null
          codigo: string | null
          created_at: string | null
          data_contato: string | null
          data_conversao: string | null
          data_indicacao: string | null
          data_recompensa: string | null
          id: string
          indicado_email: string | null
          indicado_nome: string
          indicado_telefone: string
          indicador_id: string | null
          indicador_nome: string | null
          indicador_telefone: string | null
          lead_id: string | null
          link_referencia: string | null
          observacoes: string | null
          programa_id: string | null
          recompensa_paga: boolean | null
          status: string | null
          updated_at: string | null
          valor_recompensa: number | null
        }
        Insert: {
          associado_id?: string | null
          codigo?: string | null
          created_at?: string | null
          data_contato?: string | null
          data_conversao?: string | null
          data_indicacao?: string | null
          data_recompensa?: string | null
          id?: string
          indicado_email?: string | null
          indicado_nome: string
          indicado_telefone: string
          indicador_id?: string | null
          indicador_nome?: string | null
          indicador_telefone?: string | null
          lead_id?: string | null
          link_referencia?: string | null
          observacoes?: string | null
          programa_id?: string | null
          recompensa_paga?: boolean | null
          status?: string | null
          updated_at?: string | null
          valor_recompensa?: number | null
        }
        Update: {
          associado_id?: string | null
          codigo?: string | null
          created_at?: string | null
          data_contato?: string | null
          data_conversao?: string | null
          data_indicacao?: string | null
          data_recompensa?: string | null
          id?: string
          indicado_email?: string | null
          indicado_nome?: string
          indicado_telefone?: string
          indicador_id?: string | null
          indicador_nome?: string | null
          indicador_telefone?: string | null
          lead_id?: string | null
          link_referencia?: string | null
          observacoes?: string | null
          programa_id?: string | null
          recompensa_paga?: boolean | null
          status?: string | null
          updated_at?: string | null
          valor_recompensa?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "indicacoes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "associados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "indicacoes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "indicacoes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "indicacoes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associado_financeiro"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "indicacoes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associados_publico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "indicacoes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_inadimplentes"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "indicacoes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "indicacoes_indicador_id_fkey"
            columns: ["indicador_id"]
            isOneToOne: false
            referencedRelation: "associados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "indicacoes_indicador_id_fkey"
            columns: ["indicador_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "indicacoes_indicador_id_fkey"
            columns: ["indicador_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "indicacoes_indicador_id_fkey"
            columns: ["indicador_id"]
            isOneToOne: false
            referencedRelation: "view_associado_financeiro"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "indicacoes_indicador_id_fkey"
            columns: ["indicador_id"]
            isOneToOne: false
            referencedRelation: "view_associados_publico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "indicacoes_indicador_id_fkey"
            columns: ["indicador_id"]
            isOneToOne: false
            referencedRelation: "view_inadimplentes"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "indicacoes_indicador_id_fkey"
            columns: ["indicador_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "indicacoes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "indicacoes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "indicacoes_programa_id_fkey"
            columns: ["programa_id"]
            isOneToOne: false
            referencedRelation: "programa_indicacao"
            referencedColumns: ["id"]
          },
        ]
      }
      indicadores_atuariais: {
        Row: {
          ano: number
          cancelamentos: number | null
          churn_rate: number | null
          cobertura_sinistros_meses: number | null
          created_at: string | null
          crescimento_liquido: number | null
          despesas_operacionais: number | null
          despesas_sinistros: number | null
          frequencia_sinistros: number | null
          id: string
          margem_operacional: number | null
          mes: number
          novos_associados: number | null
          receita_bruta: number | null
          receita_liquida: number | null
          resultado_operacional: number | null
          saldo_fundo_reserva: number | null
          sinistralidade_bruta: number | null
          sinistralidade_liquida: number | null
          taxa_cancelamento: number | null
          taxa_crescimento: number | null
          taxa_retencao: number | null
          ticket_medio_mensalidade: number | null
          ticket_medio_sinistro: number | null
          updated_at: string | null
        }
        Insert: {
          ano: number
          cancelamentos?: number | null
          churn_rate?: number | null
          cobertura_sinistros_meses?: number | null
          created_at?: string | null
          crescimento_liquido?: number | null
          despesas_operacionais?: number | null
          despesas_sinistros?: number | null
          frequencia_sinistros?: number | null
          id?: string
          margem_operacional?: number | null
          mes: number
          novos_associados?: number | null
          receita_bruta?: number | null
          receita_liquida?: number | null
          resultado_operacional?: number | null
          saldo_fundo_reserva?: number | null
          sinistralidade_bruta?: number | null
          sinistralidade_liquida?: number | null
          taxa_cancelamento?: number | null
          taxa_crescimento?: number | null
          taxa_retencao?: number | null
          ticket_medio_mensalidade?: number | null
          ticket_medio_sinistro?: number | null
          updated_at?: string | null
        }
        Update: {
          ano?: number
          cancelamentos?: number | null
          churn_rate?: number | null
          cobertura_sinistros_meses?: number | null
          created_at?: string | null
          crescimento_liquido?: number | null
          despesas_operacionais?: number | null
          despesas_sinistros?: number | null
          frequencia_sinistros?: number | null
          id?: string
          margem_operacional?: number | null
          mes?: number
          novos_associados?: number | null
          receita_bruta?: number | null
          receita_liquida?: number | null
          resultado_operacional?: number | null
          saldo_fundo_reserva?: number | null
          sinistralidade_bruta?: number | null
          sinistralidade_liquida?: number | null
          taxa_cancelamento?: number | null
          taxa_crescimento?: number | null
          taxa_retencao?: number | null
          ticket_medio_mensalidade?: number | null
          ticket_medio_sinistro?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      instalacao_fotos: {
        Row: {
          arquivo_url: string
          created_at: string
          id: string
          instalacao_id: string
          tipo: string
        }
        Insert: {
          arquivo_url: string
          created_at?: string
          id?: string
          instalacao_id: string
          tipo: string
        }
        Update: {
          arquivo_url?: string
          created_at?: string
          id?: string
          instalacao_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "instalacao_fotos_instalacao_id_fkey"
            columns: ["instalacao_id"]
            isOneToOne: false
            referencedRelation: "instalacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instalacao_fotos_instalacao_id_fkey"
            columns: ["instalacao_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["instalacao_id"]
          },
        ]
      }
      instalacoes: {
        Row: {
          assinatura_cliente_url: string | null
          associado_id: string
          bairro: string | null
          cep: string | null
          checklist_data: Json | null
          cidade: string | null
          complemento: string | null
          concluida_em: string | null
          contrato_id: string | null
          cotacao_id: string | null
          created_at: string
          data_agendada: string
          data_agendada_original: string | null
          em_rota_em: string | null
          encaixe_executado: boolean | null
          endereco_latitude: number | null
          endereco_longitude: number | null
          hora_agendada: string | null
          id: string
          imei_rastreador: string | null
          iniciada_em: string | null
          instalador_id: string | null
          instalador_responsavel_id: string | null
          lead_id: string | null
          local_vistoria: string | null
          logradouro: string | null
          numero: string | null
          observacoes: string | null
          periodo: Database["public"]["Enums"]["periodo_instalacao"]
          permite_encaixe: boolean | null
          quilometragem: number | null
          rastreador_id: string | null
          rota_id: string | null
          status: Database["public"]["Enums"]["status_instalacao"]
          uf: string | null
          updated_at: string
          veiculo_id: string
        }
        Insert: {
          assinatura_cliente_url?: string | null
          associado_id: string
          bairro?: string | null
          cep?: string | null
          checklist_data?: Json | null
          cidade?: string | null
          complemento?: string | null
          concluida_em?: string | null
          contrato_id?: string | null
          cotacao_id?: string | null
          created_at?: string
          data_agendada: string
          data_agendada_original?: string | null
          em_rota_em?: string | null
          encaixe_executado?: boolean | null
          endereco_latitude?: number | null
          endereco_longitude?: number | null
          hora_agendada?: string | null
          id?: string
          imei_rastreador?: string | null
          iniciada_em?: string | null
          instalador_id?: string | null
          instalador_responsavel_id?: string | null
          lead_id?: string | null
          local_vistoria?: string | null
          logradouro?: string | null
          numero?: string | null
          observacoes?: string | null
          periodo?: Database["public"]["Enums"]["periodo_instalacao"]
          permite_encaixe?: boolean | null
          quilometragem?: number | null
          rastreador_id?: string | null
          rota_id?: string | null
          status?: Database["public"]["Enums"]["status_instalacao"]
          uf?: string | null
          updated_at?: string
          veiculo_id: string
        }
        Update: {
          assinatura_cliente_url?: string | null
          associado_id?: string
          bairro?: string | null
          cep?: string | null
          checklist_data?: Json | null
          cidade?: string | null
          complemento?: string | null
          concluida_em?: string | null
          contrato_id?: string | null
          cotacao_id?: string | null
          created_at?: string
          data_agendada?: string
          data_agendada_original?: string | null
          em_rota_em?: string | null
          encaixe_executado?: boolean | null
          endereco_latitude?: number | null
          endereco_longitude?: number | null
          hora_agendada?: string | null
          id?: string
          imei_rastreador?: string | null
          iniciada_em?: string | null
          instalador_id?: string | null
          instalador_responsavel_id?: string | null
          lead_id?: string | null
          local_vistoria?: string | null
          logradouro?: string | null
          numero?: string | null
          observacoes?: string | null
          periodo?: Database["public"]["Enums"]["periodo_instalacao"]
          permite_encaixe?: boolean | null
          quilometragem?: number | null
          rastreador_id?: string | null
          rota_id?: string | null
          status?: Database["public"]["Enums"]["status_instalacao"]
          uf?: string | null
          updated_at?: string
          veiculo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "instalacoes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "associados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instalacoes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "instalacoes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "instalacoes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associado_financeiro"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "instalacoes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associados_publico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instalacoes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_inadimplentes"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "instalacoes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "instalacoes_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instalacoes_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "instalacoes_cotacao_id_fkey"
            columns: ["cotacao_id"]
            isOneToOne: false
            referencedRelation: "cotacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instalacoes_instalador_id_fkey"
            columns: ["instalador_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instalacoes_instalador_id_fkey"
            columns: ["instalador_id"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "instalacoes_instalador_id_fkey"
            columns: ["instalador_id"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "instalacoes_instalador_responsavel_id_fkey"
            columns: ["instalador_responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instalacoes_instalador_responsavel_id_fkey"
            columns: ["instalador_responsavel_id"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "instalacoes_instalador_responsavel_id_fkey"
            columns: ["instalador_responsavel_id"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "instalacoes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instalacoes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "instalacoes_rastreador_id_fkey"
            columns: ["rastreador_id"]
            isOneToOne: false
            referencedRelation: "rastreadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instalacoes_rastreador_id_fkey"
            columns: ["rastreador_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["rastreador_id"]
          },
          {
            foreignKeyName: "instalacoes_rota_id_fkey"
            columns: ["rota_id"]
            isOneToOne: false
            referencedRelation: "rotas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instalacoes_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instalacoes_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["veiculo_id"]
          },
          {
            foreignKeyName: "instalacoes_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["veiculo_id"]
          },
          {
            foreignKeyName: "instalacoes_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["veiculo_id"]
          },
          {
            foreignKeyName: "instalacoes_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "vw_veiculos_com_cotas"
            referencedColumns: ["id"]
          },
        ]
      }
      instalacoes_pendentes_criacao: {
        Row: {
          contrato_id: string | null
          cotacao_id: string | null
          created_at: string | null
          erro_detalhes: string | null
          id: string
          motivo: string | null
          resolvido: boolean | null
          resolvido_em: string | null
          resolvido_por: string | null
          tentativas: number | null
          ultima_tentativa: string | null
        }
        Insert: {
          contrato_id?: string | null
          cotacao_id?: string | null
          created_at?: string | null
          erro_detalhes?: string | null
          id?: string
          motivo?: string | null
          resolvido?: boolean | null
          resolvido_em?: string | null
          resolvido_por?: string | null
          tentativas?: number | null
          ultima_tentativa?: string | null
        }
        Update: {
          contrato_id?: string | null
          cotacao_id?: string | null
          created_at?: string | null
          erro_detalhes?: string | null
          id?: string
          motivo?: string | null
          resolvido?: boolean | null
          resolvido_em?: string | null
          resolvido_por?: string | null
          tentativas?: number | null
          ultima_tentativa?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "instalacoes_pendentes_criacao_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instalacoes_pendentes_criacao_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "instalacoes_pendentes_criacao_cotacao_id_fkey"
            columns: ["cotacao_id"]
            isOneToOne: false
            referencedRelation: "cotacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instalacoes_pendentes_criacao_resolvido_por_fkey"
            columns: ["resolvido_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instalacoes_pendentes_criacao_resolvido_por_fkey"
            columns: ["resolvido_por"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "instalacoes_pendentes_criacao_resolvido_por_fkey"
            columns: ["resolvido_por"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
        ]
      }
      integracoes_credenciais: {
        Row: {
          configurado: boolean | null
          created_at: string | null
          credenciais_encrypted: string
          id: string
          integracao: string
          iv: string
          testado_em: string | null
          teste_mensagem: string | null
          teste_sucesso: boolean | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          configurado?: boolean | null
          created_at?: string | null
          credenciais_encrypted: string
          id?: string
          integracao: string
          iv: string
          testado_em?: string | null
          teste_mensagem?: string | null
          teste_sucesso?: boolean | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          configurado?: boolean | null
          created_at?: string | null
          credenciais_encrypted?: string
          id?: string
          integracao?: string
          iv?: string
          testado_em?: string | null
          teste_mensagem?: string | null
          teste_sucesso?: boolean | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integracoes_credenciais_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integracoes_credenciais_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "integracoes_credenciais_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
        ]
      }
      integracoes_health_checks: {
        Row: {
          conexao_ok: boolean
          created_at: string
          detalhes: Json | null
          erro_mensagem: string | null
          id: string
          integracao: string
          tempo_resposta_ms: number | null
        }
        Insert: {
          conexao_ok?: boolean
          created_at?: string
          detalhes?: Json | null
          erro_mensagem?: string | null
          id?: string
          integracao: string
          tempo_resposta_ms?: number | null
        }
        Update: {
          conexao_ok?: boolean
          created_at?: string
          detalhes?: Json | null
          erro_mensagem?: string | null
          id?: string
          integracao?: string
          tempo_resposta_ms?: number | null
        }
        Relationships: []
      }
      lancamentos_contabeis: {
        Row: {
          complemento: string | null
          created_at: string | null
          criado_por: string | null
          data_competencia: string
          data_lancamento: string
          documento_numero: string | null
          documento_tipo: string | null
          estornado_em: string | null
          estornado_por: string | null
          historico: string
          id: string
          lancamento_estorno_id: string | null
          lote_id: string | null
          motivo_estorno: string | null
          numero: string | null
          origem: string
          origem_id: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          complemento?: string | null
          created_at?: string | null
          criado_por?: string | null
          data_competencia: string
          data_lancamento: string
          documento_numero?: string | null
          documento_tipo?: string | null
          estornado_em?: string | null
          estornado_por?: string | null
          historico: string
          id?: string
          lancamento_estorno_id?: string | null
          lote_id?: string | null
          motivo_estorno?: string | null
          numero?: string | null
          origem: string
          origem_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          complemento?: string | null
          created_at?: string | null
          criado_por?: string | null
          data_competencia?: string
          data_lancamento?: string
          documento_numero?: string | null
          documento_tipo?: string | null
          estornado_em?: string | null
          estornado_por?: string | null
          historico?: string
          id?: string
          lancamento_estorno_id?: string | null
          lote_id?: string | null
          motivo_estorno?: string | null
          numero?: string | null
          origem?: string
          origem_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lancamentos_contabeis_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_contabeis_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "lancamentos_contabeis_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "lancamentos_contabeis_estornado_por_fkey"
            columns: ["estornado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_contabeis_estornado_por_fkey"
            columns: ["estornado_por"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "lancamentos_contabeis_estornado_por_fkey"
            columns: ["estornado_por"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "lancamentos_contabeis_lancamento_estorno_id_fkey"
            columns: ["lancamento_estorno_id"]
            isOneToOne: false
            referencedRelation: "lancamentos_contabeis"
            referencedColumns: ["id"]
          },
        ]
      }
      lancamentos_partidas: {
        Row: {
          conta_id: string
          created_at: string | null
          id: string
          lancamento_id: string
          ordem: number | null
          tipo: string
          valor: number
        }
        Insert: {
          conta_id: string
          created_at?: string | null
          id?: string
          lancamento_id: string
          ordem?: number | null
          tipo: string
          valor: number
        }
        Update: {
          conta_id?: string
          created_at?: string | null
          id?: string
          lancamento_id?: string
          ordem?: number | null
          tipo?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "lancamentos_partidas_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "plano_contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_partidas_lancamento_id_fkey"
            columns: ["lancamento_id"]
            isOneToOne: false
            referencedRelation: "lancamentos_contabeis"
            referencedColumns: ["id"]
          },
        ]
      }
      landing_pages: {
        Row: {
          campanha_id: string | null
          conversoes: number | null
          created_at: string | null
          criado_por: string | null
          id: string
          nome: string
          slug: string
          status: string | null
          taxa_conversao: number | null
          updated_at: string | null
          url: string | null
          url_preview: string | null
          visitas: number | null
        }
        Insert: {
          campanha_id?: string | null
          conversoes?: number | null
          created_at?: string | null
          criado_por?: string | null
          id?: string
          nome: string
          slug: string
          status?: string | null
          taxa_conversao?: number | null
          updated_at?: string | null
          url?: string | null
          url_preview?: string | null
          visitas?: number | null
        }
        Update: {
          campanha_id?: string | null
          conversoes?: number | null
          created_at?: string | null
          criado_por?: string | null
          id?: string
          nome?: string
          slug?: string
          status?: string | null
          taxa_conversao?: number | null
          updated_at?: string | null
          url?: string | null
          url_preview?: string | null
          visitas?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "landing_pages_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "campanhas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "landing_pages_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "landing_pages_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "landing_pages_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
        ]
      }
      lead_fontes: {
        Row: {
          ativa: boolean | null
          codigo: string
          created_at: string | null
          descricao: string | null
          etapa_inicial: Database["public"]["Enums"]["etapa_lead"] | null
          id: string
          nome: string
          total_leads: number | null
          updated_at: string | null
          vendedor_padrao_id: string | null
        }
        Insert: {
          ativa?: boolean | null
          codigo: string
          created_at?: string | null
          descricao?: string | null
          etapa_inicial?: Database["public"]["Enums"]["etapa_lead"] | null
          id?: string
          nome: string
          total_leads?: number | null
          updated_at?: string | null
          vendedor_padrao_id?: string | null
        }
        Update: {
          ativa?: boolean | null
          codigo?: string
          created_at?: string | null
          descricao?: string | null
          etapa_inicial?: Database["public"]["Enums"]["etapa_lead"] | null
          id?: string
          nome?: string
          total_leads?: number | null
          updated_at?: string | null
          vendedor_padrao_id?: string | null
        }
        Relationships: []
      }
      leads: {
        Row: {
          associado_id: string | null
          ativo: boolean
          campanha_id: string | null
          codigo_fipe: string | null
          contrato_assinado_em: string | null
          contrato_enviado_em: string | null
          contrato_id: string | null
          contrato_status: string | null
          cotacao_id: string | null
          cpf: string | null
          created_at: string
          data_conversao: string | null
          data_perda: string | null
          data_primeiro_contato: string | null
          data_proxima_acao: string | null
          data_ultimo_contato: string | null
          email: string | null
          etapa: Database["public"]["Enums"]["etapa_lead"]
          fonte_id: string | null
          id: string
          indicador_id: string | null
          motivo_perda: string | null
          nome: string
          observacao_perda: string | null
          observacoes: string | null
          origem: Database["public"]["Enums"]["origem_lead"]
          plano_escolhido_id: string | null
          plano_escolhido_nome: string | null
          plano_escolhido_valor: number | null
          planos_interesse: string[] | null
          proposta_assinada_em: string | null
          proposta_enviada_em: string | null
          telefone: string
          updated_at: string
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          veiculo_ano: number | null
          veiculo_cor: string | null
          veiculo_fipe: number | null
          veiculo_marca: string | null
          veiculo_modelo: string | null
          veiculo_placa: string | null
          vendedor_id: string | null
        }
        Insert: {
          associado_id?: string | null
          ativo?: boolean
          campanha_id?: string | null
          codigo_fipe?: string | null
          contrato_assinado_em?: string | null
          contrato_enviado_em?: string | null
          contrato_id?: string | null
          contrato_status?: string | null
          cotacao_id?: string | null
          cpf?: string | null
          created_at?: string
          data_conversao?: string | null
          data_perda?: string | null
          data_primeiro_contato?: string | null
          data_proxima_acao?: string | null
          data_ultimo_contato?: string | null
          email?: string | null
          etapa?: Database["public"]["Enums"]["etapa_lead"]
          fonte_id?: string | null
          id?: string
          indicador_id?: string | null
          motivo_perda?: string | null
          nome: string
          observacao_perda?: string | null
          observacoes?: string | null
          origem?: Database["public"]["Enums"]["origem_lead"]
          plano_escolhido_id?: string | null
          plano_escolhido_nome?: string | null
          plano_escolhido_valor?: number | null
          planos_interesse?: string[] | null
          proposta_assinada_em?: string | null
          proposta_enviada_em?: string | null
          telefone: string
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          veiculo_ano?: number | null
          veiculo_cor?: string | null
          veiculo_fipe?: number | null
          veiculo_marca?: string | null
          veiculo_modelo?: string | null
          veiculo_placa?: string | null
          vendedor_id?: string | null
        }
        Update: {
          associado_id?: string | null
          ativo?: boolean
          campanha_id?: string | null
          codigo_fipe?: string | null
          contrato_assinado_em?: string | null
          contrato_enviado_em?: string | null
          contrato_id?: string | null
          contrato_status?: string | null
          cotacao_id?: string | null
          cpf?: string | null
          created_at?: string
          data_conversao?: string | null
          data_perda?: string | null
          data_primeiro_contato?: string | null
          data_proxima_acao?: string | null
          data_ultimo_contato?: string | null
          email?: string | null
          etapa?: Database["public"]["Enums"]["etapa_lead"]
          fonte_id?: string | null
          id?: string
          indicador_id?: string | null
          motivo_perda?: string | null
          nome?: string
          observacao_perda?: string | null
          observacoes?: string | null
          origem?: Database["public"]["Enums"]["origem_lead"]
          plano_escolhido_id?: string | null
          plano_escolhido_nome?: string | null
          plano_escolhido_valor?: number | null
          planos_interesse?: string[] | null
          proposta_assinada_em?: string | null
          proposta_enviada_em?: string | null
          telefone?: string
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          veiculo_ano?: number | null
          veiculo_cor?: string | null
          veiculo_fipe?: number | null
          veiculo_marca?: string | null
          veiculo_modelo?: string | null
          veiculo_placa?: string | null
          vendedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "associados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "leads_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "leads_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associado_financeiro"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "leads_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associados_publico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_inadimplentes"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "leads_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "leads_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "campanhas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_cotacao_id_fkey"
            columns: ["cotacao_id"]
            isOneToOne: false
            referencedRelation: "cotacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_fonte_id_fkey"
            columns: ["fonte_id"]
            isOneToOne: false
            referencedRelation: "lead_fontes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_plano_escolhido_id_fkey"
            columns: ["plano_escolhido_id"]
            isOneToOne: false
            referencedRelation: "planos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_plano_escolhido_id_fkey"
            columns: ["plano_escolhido_id"]
            isOneToOne: false
            referencedRelation: "vw_plans_compat"
            referencedColumns: ["id"]
          },
        ]
      }
      leads_historico: {
        Row: {
          acao: string
          created_at: string | null
          dados_extras: Json | null
          descricao: string | null
          etapa_anterior: string | null
          etapa_nova: string | null
          id: string
          lead_id: string
          usuario_id: string | null
          usuario_nome: string | null
        }
        Insert: {
          acao: string
          created_at?: string | null
          dados_extras?: Json | null
          descricao?: string | null
          etapa_anterior?: string | null
          etapa_nova?: string | null
          id?: string
          lead_id: string
          usuario_id?: string | null
          usuario_nome?: string | null
        }
        Update: {
          acao?: string
          created_at?: string | null
          dados_extras?: Json | null
          descricao?: string | null
          etapa_anterior?: string | null
          etapa_nova?: string | null
          id?: string
          lead_id?: string
          usuario_id?: string | null
          usuario_nome?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_historico_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_historico_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["lead_id"]
          },
        ]
      }
      leads_interesse_planos: {
        Row: {
          created_at: string | null
          id: string
          lead_id: string
          plano_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          lead_id: string
          plano_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          lead_id?: string
          plano_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_interesse_planos_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_interesse_planos_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "leads_interesse_planos_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "planos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_interesse_planos_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "vw_plans_compat"
            referencedColumns: ["id"]
          },
        ]
      }
      logs_auditoria: {
        Row: {
          acao: string
          created_at: string | null
          dados_anteriores: Json | null
          dados_novos: Json | null
          descricao: string | null
          id: string
          ip_address: string | null
          modulo: string | null
          registro_id: string | null
          tabela: string | null
          user_agent: string | null
          usuario_id: string | null
          usuario_nome: string | null
        }
        Insert: {
          acao: string
          created_at?: string | null
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          descricao?: string | null
          id?: string
          ip_address?: string | null
          modulo?: string | null
          registro_id?: string | null
          tabela?: string | null
          user_agent?: string | null
          usuario_id?: string | null
          usuario_nome?: string | null
        }
        Update: {
          acao?: string
          created_at?: string | null
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          descricao?: string | null
          id?: string
          ip_address?: string | null
          modulo?: string | null
          registro_id?: string | null
          tabela?: string | null
          user_agent?: string | null
          usuario_id?: string | null
          usuario_nome?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "logs_auditoria_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "logs_auditoria_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "logs_auditoria_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
        ]
      }
      main_coverages: {
        Row: {
          created_at: string | null
          display_order: number | null
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          subtitle: string | null
        }
        Insert: {
          created_at?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          subtitle?: string | null
        }
        Update: {
          created_at?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          subtitle?: string | null
        }
        Relationships: []
      }
      materiais_marketing: {
        Row: {
          altura: number | null
          arquivo_url: string | null
          campanha_id: string | null
          created_at: string | null
          criado_por: string | null
          downloads: number | null
          formato: string | null
          id: string
          largura: number | null
          nome: string
          status: string | null
          thumbnail_url: string | null
          tipo: string
        }
        Insert: {
          altura?: number | null
          arquivo_url?: string | null
          campanha_id?: string | null
          created_at?: string | null
          criado_por?: string | null
          downloads?: number | null
          formato?: string | null
          id?: string
          largura?: number | null
          nome: string
          status?: string | null
          thumbnail_url?: string | null
          tipo: string
        }
        Update: {
          altura?: number | null
          arquivo_url?: string | null
          campanha_id?: string | null
          created_at?: string | null
          criado_por?: string | null
          downloads?: number | null
          formato?: string | null
          id?: string
          largura?: number | null
          nome?: string
          status?: string | null
          thumbnail_url?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "materiais_marketing_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "campanhas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "materiais_marketing_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "materiais_marketing_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "materiais_marketing_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
        ]
      }
      metas_vendas: {
        Row: {
          ano: number
          created_at: string | null
          id: string
          mes: number
          meta_contratos: number | null
          meta_cotacoes: number | null
          meta_leads: number | null
          meta_valor: number | null
          realizado_contratos: number | null
          realizado_cotacoes: number | null
          realizado_leads: number | null
          realizado_valor: number | null
          updated_at: string | null
          vendedor_id: string
        }
        Insert: {
          ano: number
          created_at?: string | null
          id?: string
          mes: number
          meta_contratos?: number | null
          meta_cotacoes?: number | null
          meta_leads?: number | null
          meta_valor?: number | null
          realizado_contratos?: number | null
          realizado_cotacoes?: number | null
          realizado_leads?: number | null
          realizado_valor?: number | null
          updated_at?: string | null
          vendedor_id: string
        }
        Update: {
          ano?: number
          created_at?: string | null
          id?: string
          mes?: number
          meta_contratos?: number | null
          meta_cotacoes?: number | null
          meta_leads?: number | null
          meta_valor?: number | null
          realizado_contratos?: number | null
          realizado_cotacoes?: number | null
          realizado_leads?: number | null
          realizado_valor?: number | null
          updated_at?: string | null
          vendedor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "metas_vendas_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metas_vendas_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "metas_vendas_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
        ]
      }
      migracao_decisoes_historico: {
        Row: {
          analista_id: string
          analista_nome: string | null
          created_at: string | null
          decisao: string
          id: string
          motivo: string | null
          solicitacao_id: string
        }
        Insert: {
          analista_id: string
          analista_nome?: string | null
          created_at?: string | null
          decisao: string
          id?: string
          motivo?: string | null
          solicitacao_id: string
        }
        Update: {
          analista_id?: string
          analista_nome?: string | null
          created_at?: string | null
          decisao?: string
          id?: string
          motivo?: string | null
          solicitacao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "migracao_decisoes_historico_solicitacao_id_fkey"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "solicitacoes_migracao"
            referencedColumns: ["id"]
          },
        ]
      }
      movimentacoes_bancarias: {
        Row: {
          categoria: string | null
          cobranca_id: string | null
          conciliado: boolean | null
          conciliado_em: string | null
          conciliado_por: string | null
          conta_bancaria_id: string | null
          created_at: string | null
          data_lancamento: string
          data_origem: string | null
          descricao: string
          documento: string | null
          documento_pagador: string | null
          extrato_id: string | null
          hash_lancamento: string | null
          id: string
          nome_pagador: string | null
          observacao_conciliacao: string | null
          origem_pagamento: string | null
          saldo_apos: number | null
          subcategoria: string | null
          tipo: string
          updated_at: string | null
          valor: number
        }
        Insert: {
          categoria?: string | null
          cobranca_id?: string | null
          conciliado?: boolean | null
          conciliado_em?: string | null
          conciliado_por?: string | null
          conta_bancaria_id?: string | null
          created_at?: string | null
          data_lancamento: string
          data_origem?: string | null
          descricao: string
          documento?: string | null
          documento_pagador?: string | null
          extrato_id?: string | null
          hash_lancamento?: string | null
          id?: string
          nome_pagador?: string | null
          observacao_conciliacao?: string | null
          origem_pagamento?: string | null
          saldo_apos?: number | null
          subcategoria?: string | null
          tipo: string
          updated_at?: string | null
          valor: number
        }
        Update: {
          categoria?: string | null
          cobranca_id?: string | null
          conciliado?: boolean | null
          conciliado_em?: string | null
          conciliado_por?: string | null
          conta_bancaria_id?: string | null
          created_at?: string | null
          data_lancamento?: string
          data_origem?: string | null
          descricao?: string
          documento?: string | null
          documento_pagador?: string | null
          extrato_id?: string | null
          hash_lancamento?: string | null
          id?: string
          nome_pagador?: string | null
          observacao_conciliacao?: string | null
          origem_pagamento?: string | null
          saldo_apos?: number | null
          subcategoria?: string | null
          tipo?: string
          updated_at?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "movimentacoes_bancarias_cobranca_id_fkey"
            columns: ["cobranca_id"]
            isOneToOne: false
            referencedRelation: "cobrancas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentacoes_bancarias_conciliado_por_fkey"
            columns: ["conciliado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentacoes_bancarias_conciliado_por_fkey"
            columns: ["conciliado_por"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "movimentacoes_bancarias_conciliado_por_fkey"
            columns: ["conciliado_por"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "movimentacoes_bancarias_conta_bancaria_id_fkey"
            columns: ["conta_bancaria_id"]
            isOneToOne: false
            referencedRelation: "contas_bancarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentacoes_bancarias_extrato_id_fkey"
            columns: ["extrato_id"]
            isOneToOne: false
            referencedRelation: "extratos_bancarios"
            referencedColumns: ["id"]
          },
        ]
      }
      movimentacoes_financeiras: {
        Row: {
          categoria: string
          created_at: string | null
          data_competencia: string | null
          data_movimentacao: string
          descricao: string
          id: string
          observacao: string | null
          referencia_id: string | null
          referencia_tipo: string | null
          registrado_por: string | null
          tipo: string
          valor: number
        }
        Insert: {
          categoria: string
          created_at?: string | null
          data_competencia?: string | null
          data_movimentacao: string
          descricao: string
          id?: string
          observacao?: string | null
          referencia_id?: string | null
          referencia_tipo?: string | null
          registrado_por?: string | null
          tipo: string
          valor: number
        }
        Update: {
          categoria?: string
          created_at?: string | null
          data_competencia?: string | null
          data_movimentacao?: string
          descricao?: string
          id?: string
          observacao?: string | null
          referencia_id?: string | null
          referencia_tipo?: string | null
          registrado_por?: string | null
          tipo?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "movimentacoes_financeiras_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentacoes_financeiras_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "movimentacoes_financeiras_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
        ]
      }
      negativacoes: {
        Row: {
          acordo_id: string | null
          associado_id: string
          baixado_por: string | null
          cobranca_id: string | null
          created_at: string | null
          data_baixa: string | null
          data_divida: string
          data_envio: string | null
          data_negativacao: string | null
          enviado_por: string | null
          id: string
          motivo_baixa: string | null
          orgao: string
          protocolo_baixa: string | null
          protocolo_envio: string | null
          status: string | null
          updated_at: string | null
          valor: number
        }
        Insert: {
          acordo_id?: string | null
          associado_id: string
          baixado_por?: string | null
          cobranca_id?: string | null
          created_at?: string | null
          data_baixa?: string | null
          data_divida: string
          data_envio?: string | null
          data_negativacao?: string | null
          enviado_por?: string | null
          id?: string
          motivo_baixa?: string | null
          orgao: string
          protocolo_baixa?: string | null
          protocolo_envio?: string | null
          status?: string | null
          updated_at?: string | null
          valor: number
        }
        Update: {
          acordo_id?: string | null
          associado_id?: string
          baixado_por?: string | null
          cobranca_id?: string | null
          created_at?: string | null
          data_baixa?: string | null
          data_divida?: string
          data_envio?: string | null
          data_negativacao?: string | null
          enviado_por?: string | null
          id?: string
          motivo_baixa?: string | null
          orgao?: string
          protocolo_baixa?: string | null
          protocolo_envio?: string | null
          status?: string | null
          updated_at?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "negativacoes_acordo_id_fkey"
            columns: ["acordo_id"]
            isOneToOne: false
            referencedRelation: "acordos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "negativacoes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "associados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "negativacoes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "negativacoes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "negativacoes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associado_financeiro"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "negativacoes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associados_publico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "negativacoes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_inadimplentes"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "negativacoes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "negativacoes_cobranca_id_fkey"
            columns: ["cobranca_id"]
            isOneToOne: false
            referencedRelation: "cobrancas"
            referencedColumns: ["id"]
          },
        ]
      }
      notificacoes: {
        Row: {
          canal_email: boolean | null
          canal_push: boolean | null
          canal_sistema: boolean | null
          canal_whatsapp: boolean | null
          categoria: string | null
          created_at: string
          dados: Json | null
          data_expiracao: string | null
          destino: string | null
          destino_id: string | null
          icone: string | null
          id: string
          lida: boolean
          lida_em: string | null
          link: string | null
          mensagem: string
          modulo: string | null
          prioridade: string | null
          referencia_id: string | null
          referencia_tipo: string | null
          subtipo: string | null
          tipo: string
          titulo: string
          user_id: string
        }
        Insert: {
          canal_email?: boolean | null
          canal_push?: boolean | null
          canal_sistema?: boolean | null
          canal_whatsapp?: boolean | null
          categoria?: string | null
          created_at?: string
          dados?: Json | null
          data_expiracao?: string | null
          destino?: string | null
          destino_id?: string | null
          icone?: string | null
          id?: string
          lida?: boolean
          lida_em?: string | null
          link?: string | null
          mensagem: string
          modulo?: string | null
          prioridade?: string | null
          referencia_id?: string | null
          referencia_tipo?: string | null
          subtipo?: string | null
          tipo?: string
          titulo: string
          user_id: string
        }
        Update: {
          canal_email?: boolean | null
          canal_push?: boolean | null
          canal_sistema?: boolean | null
          canal_whatsapp?: boolean | null
          categoria?: string | null
          created_at?: string
          dados?: Json | null
          data_expiracao?: string | null
          destino?: string | null
          destino_id?: string | null
          icone?: string | null
          id?: string
          lida?: boolean
          lida_em?: string | null
          link?: string | null
          mensagem?: string
          modulo?: string | null
          prioridade?: string | null
          referencia_id?: string | null
          referencia_tipo?: string | null
          subtipo?: string | null
          tipo?: string
          titulo?: string
          user_id?: string
        }
        Relationships: []
      }
      notificacoes_lidas: {
        Row: {
          id: string
          lida_em: string | null
          notificacao_id: string
          usuario_id: string
        }
        Insert: {
          id?: string
          lida_em?: string | null
          notificacao_id: string
          usuario_id: string
        }
        Update: {
          id?: string
          lida_em?: string | null
          notificacao_id?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificacoes_lidas_notificacao_id_fkey"
            columns: ["notificacao_id"]
            isOneToOne: false
            referencedRelation: "notificacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificacoes_lidas_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificacoes_lidas_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "notificacoes_lidas_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
        ]
      }
      notificacoes_preferencias: {
        Row: {
          created_at: string | null
          email_alertas_criticos: boolean | null
          email_ativo: boolean | null
          email_resumo_diario: boolean | null
          horario_resumo: string | null
          id: string
          notif_comunicados: boolean | null
          notif_financeiro: boolean | null
          notif_veiculo: boolean | null
          onboarding_completo: boolean | null
          push_ativo: boolean | null
          som_notificacao: boolean | null
          tipo_usuario: string
          updated_at: string | null
          usuario_id: string
          whatsapp_ativo: boolean | null
          whatsapp_horario_fim: string | null
          whatsapp_horario_inicio: string | null
        }
        Insert: {
          created_at?: string | null
          email_alertas_criticos?: boolean | null
          email_ativo?: boolean | null
          email_resumo_diario?: boolean | null
          horario_resumo?: string | null
          id?: string
          notif_comunicados?: boolean | null
          notif_financeiro?: boolean | null
          notif_veiculo?: boolean | null
          onboarding_completo?: boolean | null
          push_ativo?: boolean | null
          som_notificacao?: boolean | null
          tipo_usuario?: string
          updated_at?: string | null
          usuario_id: string
          whatsapp_ativo?: boolean | null
          whatsapp_horario_fim?: string | null
          whatsapp_horario_inicio?: string | null
        }
        Update: {
          created_at?: string | null
          email_alertas_criticos?: boolean | null
          email_ativo?: boolean | null
          email_resumo_diario?: boolean | null
          horario_resumo?: string | null
          id?: string
          notif_comunicados?: boolean | null
          notif_financeiro?: boolean | null
          notif_veiculo?: boolean | null
          onboarding_completo?: boolean | null
          push_ativo?: boolean | null
          som_notificacao?: boolean | null
          tipo_usuario?: string
          updated_at?: string | null
          usuario_id?: string
          whatsapp_ativo?: boolean | null
          whatsapp_horario_fim?: string | null
          whatsapp_horario_inicio?: string | null
        }
        Relationships: []
      }
      notificacoes_sistema: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          criado_por: string | null
          destino: string
          destino_id: string | null
          destino_role: Database["public"]["Enums"]["app_role"] | null
          expira_em: string | null
          id: string
          link: string | null
          mensagem: string
          tipo: string | null
          titulo: string
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          criado_por?: string | null
          destino: string
          destino_id?: string | null
          destino_role?: Database["public"]["Enums"]["app_role"] | null
          expira_em?: string | null
          id?: string
          link?: string | null
          mensagem: string
          tipo?: string | null
          titulo: string
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          criado_por?: string | null
          destino?: string
          destino_id?: string | null
          destino_role?: Database["public"]["Enums"]["app_role"] | null
          expira_em?: string | null
          id?: string
          link?: string | null
          mensagem?: string
          tipo?: string | null
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificacoes_sistema_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificacoes_sistema_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "notificacoes_sistema_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
        ]
      }
      notificacoes_vendas: {
        Row: {
          created_at: string | null
          dados_extras: Json | null
          id: string
          lead_id: string | null
          lida: boolean | null
          lida_em: string | null
          mensagem: string | null
          tipo: string
          titulo: string
          usuario_id: string
        }
        Insert: {
          created_at?: string | null
          dados_extras?: Json | null
          id?: string
          lead_id?: string | null
          lida?: boolean | null
          lida_em?: string | null
          mensagem?: string | null
          tipo: string
          titulo: string
          usuario_id: string
        }
        Update: {
          created_at?: string | null
          dados_extras?: Json | null
          id?: string
          lead_id?: string | null
          lida?: boolean | null
          lida_em?: string | null
          mensagem?: string | null
          tipo?: string
          titulo?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificacoes_vendas_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificacoes_vendas_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "notificacoes_vendas_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificacoes_vendas_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "notificacoes_vendas_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
        ]
      }
      oficinas: {
        Row: {
          agencia: string | null
          bairro: string | null
          banco: string | null
          cep: string | null
          cidade: string
          cnpj: string
          complemento: string | null
          conta: string | null
          created_at: string | null
          email: string | null
          especialidades: string[] | null
          estado: string
          id: string
          inscricao_estadual: string | null
          is_base_pratic: boolean | null
          latitude: number | null
          logradouro: string | null
          longitude: number | null
          marcas_atendidas: string[] | null
          nome_fantasia: string | null
          nota_media: number | null
          numero: string | null
          pix_chave: string | null
          pix_tipo: Database["public"]["Enums"]["tipo_pix"] | null
          razao_social: string
          status: Database["public"]["Enums"]["status_oficina"] | null
          telefone: string | null
          total_avaliacoes: number | null
          updated_at: string | null
          whatsapp: string | null
        }
        Insert: {
          agencia?: string | null
          bairro?: string | null
          banco?: string | null
          cep?: string | null
          cidade: string
          cnpj: string
          complemento?: string | null
          conta?: string | null
          created_at?: string | null
          email?: string | null
          especialidades?: string[] | null
          estado: string
          id?: string
          inscricao_estadual?: string | null
          is_base_pratic?: boolean | null
          latitude?: number | null
          logradouro?: string | null
          longitude?: number | null
          marcas_atendidas?: string[] | null
          nome_fantasia?: string | null
          nota_media?: number | null
          numero?: string | null
          pix_chave?: string | null
          pix_tipo?: Database["public"]["Enums"]["tipo_pix"] | null
          razao_social: string
          status?: Database["public"]["Enums"]["status_oficina"] | null
          telefone?: string | null
          total_avaliacoes?: number | null
          updated_at?: string | null
          whatsapp?: string | null
        }
        Update: {
          agencia?: string | null
          bairro?: string | null
          banco?: string | null
          cep?: string | null
          cidade?: string
          cnpj?: string
          complemento?: string | null
          conta?: string | null
          created_at?: string | null
          email?: string | null
          especialidades?: string[] | null
          estado?: string
          id?: string
          inscricao_estadual?: string | null
          is_base_pratic?: boolean | null
          latitude?: number | null
          logradouro?: string | null
          longitude?: number | null
          marcas_atendidas?: string[] | null
          nome_fantasia?: string | null
          nota_media?: number | null
          numero?: string | null
          pix_chave?: string | null
          pix_tipo?: Database["public"]["Enums"]["tipo_pix"] | null
          razao_social?: string
          status?: Database["public"]["Enums"]["status_oficina"] | null
          telefone?: string | null
          total_avaliacoes?: number | null
          updated_at?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      oficinas_pagamentos: {
        Row: {
          comprovante_url: string | null
          created_at: string | null
          data_pagamento: string | null
          forma_pagamento:
            | Database["public"]["Enums"]["forma_pagamento_oficina"]
            | null
          id: string
          observacao: string | null
          oficina_id: string
          ordem_servico_id: string | null
          pago_por: string | null
          status: Database["public"]["Enums"]["status_pagamento_oficina"] | null
          valor: number
        }
        Insert: {
          comprovante_url?: string | null
          created_at?: string | null
          data_pagamento?: string | null
          forma_pagamento?:
            | Database["public"]["Enums"]["forma_pagamento_oficina"]
            | null
          id?: string
          observacao?: string | null
          oficina_id: string
          ordem_servico_id?: string | null
          pago_por?: string | null
          status?:
            | Database["public"]["Enums"]["status_pagamento_oficina"]
            | null
          valor: number
        }
        Update: {
          comprovante_url?: string | null
          created_at?: string | null
          data_pagamento?: string | null
          forma_pagamento?:
            | Database["public"]["Enums"]["forma_pagamento_oficina"]
            | null
          id?: string
          observacao?: string | null
          oficina_id?: string
          ordem_servico_id?: string | null
          pago_por?: string | null
          status?:
            | Database["public"]["Enums"]["status_pagamento_oficina"]
            | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "oficinas_pagamentos_oficina_id_fkey"
            columns: ["oficina_id"]
            isOneToOne: false
            referencedRelation: "oficinas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oficinas_pagamentos_ordem_servico_id_fkey"
            columns: ["ordem_servico_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oficinas_pagamentos_pago_por_fkey"
            columns: ["pago_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oficinas_pagamentos_pago_por_fkey"
            columns: ["pago_por"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "oficinas_pagamentos_pago_por_fkey"
            columns: ["pago_por"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
        ]
      }
      operacao_config_snapshot: {
        Row: {
          associado_id: string | null
          config_data: Json
          contrato_id: string | null
          created_at: string
          id: string
          tipo_operacao: string
        }
        Insert: {
          associado_id?: string | null
          config_data?: Json
          contrato_id?: string | null
          created_at?: string
          id?: string
          tipo_operacao: string
        }
        Update: {
          associado_id?: string | null
          config_data?: Json
          contrato_id?: string | null
          created_at?: string
          id?: string
          tipo_operacao?: string
        }
        Relationships: [
          {
            foreignKeyName: "operacao_config_snapshot_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "associados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operacao_config_snapshot_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "operacao_config_snapshot_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "operacao_config_snapshot_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associado_financeiro"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "operacao_config_snapshot_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associados_publico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operacao_config_snapshot_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_inadimplentes"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "operacao_config_snapshot_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "operacao_config_snapshot_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operacao_config_snapshot_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["contrato_id"]
          },
        ]
      }
      orcamento_reparo: {
        Row: {
          confirmado_analista: boolean | null
          confirmado_analista_em: string | null
          confirmado_analista_por: string | null
          consolidado_em: string | null
          consolidado_por: string | null
          created_at: string
          descricao_pacote: string | null
          detalhamento_pacote: Json | null
          forma_pagamento: string | null
          id: string
          observacao_final: string | null
          observacao_negociacao: string | null
          oficina_id: string | null
          prazo_estimado_dias: number | null
          sinistro_id: string
          status: string
          tipo_orcamento: string | null
          updated_at: string
          valor_inicial_total: number | null
          valor_mao_obra: number | null
          valor_pacote: number | null
          valor_pecas: number | null
          valor_total: number | null
        }
        Insert: {
          confirmado_analista?: boolean | null
          confirmado_analista_em?: string | null
          confirmado_analista_por?: string | null
          consolidado_em?: string | null
          consolidado_por?: string | null
          created_at?: string
          descricao_pacote?: string | null
          detalhamento_pacote?: Json | null
          forma_pagamento?: string | null
          id?: string
          observacao_final?: string | null
          observacao_negociacao?: string | null
          oficina_id?: string | null
          prazo_estimado_dias?: number | null
          sinistro_id: string
          status?: string
          tipo_orcamento?: string | null
          updated_at?: string
          valor_inicial_total?: number | null
          valor_mao_obra?: number | null
          valor_pacote?: number | null
          valor_pecas?: number | null
          valor_total?: number | null
        }
        Update: {
          confirmado_analista?: boolean | null
          confirmado_analista_em?: string | null
          confirmado_analista_por?: string | null
          consolidado_em?: string | null
          consolidado_por?: string | null
          created_at?: string
          descricao_pacote?: string | null
          detalhamento_pacote?: Json | null
          forma_pagamento?: string | null
          id?: string
          observacao_final?: string | null
          observacao_negociacao?: string | null
          oficina_id?: string | null
          prazo_estimado_dias?: number | null
          sinistro_id?: string
          status?: string
          tipo_orcamento?: string | null
          updated_at?: string
          valor_inicial_total?: number | null
          valor_mao_obra?: number | null
          valor_pacote?: number | null
          valor_pecas?: number | null
          valor_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "orcamento_reparo_confirmado_analista_por_fkey"
            columns: ["confirmado_analista_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamento_reparo_confirmado_analista_por_fkey"
            columns: ["confirmado_analista_por"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "orcamento_reparo_confirmado_analista_por_fkey"
            columns: ["confirmado_analista_por"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "orcamento_reparo_oficina_id_fkey"
            columns: ["oficina_id"]
            isOneToOne: false
            referencedRelation: "oficinas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamento_reparo_sinistro_id_fkey"
            columns: ["sinistro_id"]
            isOneToOne: true
            referencedRelation: "sinistros"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamento_reparo_cotacoes: {
        Row: {
          created_at: string | null
          fornecedor: string
          id: string
          item_id: string
          observacao: string | null
          prazo_entrega: string | null
          selecionada: boolean | null
          tipo_peca: string | null
          valor: number | null
        }
        Insert: {
          created_at?: string | null
          fornecedor: string
          id?: string
          item_id: string
          observacao?: string | null
          prazo_entrega?: string | null
          selecionada?: boolean | null
          tipo_peca?: string | null
          valor?: number | null
        }
        Update: {
          created_at?: string | null
          fornecedor?: string
          id?: string
          item_id?: string
          observacao?: string | null
          prazo_entrega?: string | null
          selecionada?: boolean | null
          tipo_peca?: string | null
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "orcamento_reparo_cotacoes_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "orcamento_reparo_itens"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamento_reparo_historico: {
        Row: {
          acao: string
          created_at: string
          dados_anteriores: Json | null
          dados_novos: Json | null
          descricao: string | null
          id: string
          item_id: string | null
          motivo: string | null
          orcamento_id: string
          usuario_id: string | null
        }
        Insert: {
          acao: string
          created_at?: string
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          descricao?: string | null
          id?: string
          item_id?: string | null
          motivo?: string | null
          orcamento_id: string
          usuario_id?: string | null
        }
        Update: {
          acao?: string
          created_at?: string
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          descricao?: string | null
          id?: string
          item_id?: string | null
          motivo?: string | null
          orcamento_id?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orcamento_reparo_historico_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "orcamento_reparo_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamento_reparo_historico_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamento_reparo"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamento_reparo_itens: {
        Row: {
          auto_center_id: string | null
          confirmado_em: string | null
          confirmado_por: string | null
          created_at: string
          created_by: string | null
          descricao: string
          id: string
          motivo_cancelamento: string | null
          motivo_inclusao: string | null
          observacao: string | null
          orcamento_id: string
          origem: string | null
          quantidade: number
          status: string
          tipo: string
          updated_at: string
          valor_confirmado: number | null
          valor_total: number
          valor_unitario: number
        }
        Insert: {
          auto_center_id?: string | null
          confirmado_em?: string | null
          confirmado_por?: string | null
          created_at?: string
          created_by?: string | null
          descricao: string
          id?: string
          motivo_cancelamento?: string | null
          motivo_inclusao?: string | null
          observacao?: string | null
          orcamento_id: string
          origem?: string | null
          quantidade?: number
          status?: string
          tipo: string
          updated_at?: string
          valor_confirmado?: number | null
          valor_total?: number
          valor_unitario?: number
        }
        Update: {
          auto_center_id?: string | null
          confirmado_em?: string | null
          confirmado_por?: string | null
          created_at?: string
          created_by?: string | null
          descricao?: string
          id?: string
          motivo_cancelamento?: string | null
          motivo_inclusao?: string | null
          observacao?: string | null
          orcamento_id?: string
          origem?: string | null
          quantidade?: number
          status?: string
          tipo?: string
          updated_at?: string
          valor_confirmado?: number | null
          valor_total?: number
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "orcamento_reparo_itens_auto_center_id_fkey"
            columns: ["auto_center_id"]
            isOneToOne: false
            referencedRelation: "auto_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamento_reparo_itens_confirmado_por_fkey"
            columns: ["confirmado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamento_reparo_itens_confirmado_por_fkey"
            columns: ["confirmado_por"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "orcamento_reparo_itens_confirmado_por_fkey"
            columns: ["confirmado_por"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "orcamento_reparo_itens_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamento_reparo"
            referencedColumns: ["id"]
          },
        ]
      }
      ordens_servico: {
        Row: {
          aprovado_por: string | null
          assinatura_retirada_url: string | null
          associado_id: string
          autentique_documento_id: string | null
          autentique_url: string | null
          auto_center_id: string | null
          cotacao_aprovada_id: string | null
          created_at: string | null
          criado_por: string | null
          data_conclusao: string | null
          data_conclusao_real: string | null
          data_entrada: string | null
          data_previsao: string | null
          data_retirada: string | null
          etapas_reparo: Json | null
          garantia_ate: string | null
          id: string
          numero: string
          observacoes: string | null
          observacoes_internas: string | null
          oficina_id: string
          retorno_garantia_os_id: string | null
          sinistro_id: string | null
          status: Database["public"]["Enums"]["status_ordem_servico"] | null
          tempo_total_dias: number | null
          termo_saida_assinado: boolean | null
          termo_saida_assinado_em: string | null
          termo_saida_url: string | null
          token_retirada: string | null
          token_retirada_expira: string | null
          updated_at: string | null
          valor_aprovado: number | null
          valor_orcamento: number | null
          valor_pago: number | null
          veiculo_id: string
        }
        Insert: {
          aprovado_por?: string | null
          assinatura_retirada_url?: string | null
          associado_id: string
          autentique_documento_id?: string | null
          autentique_url?: string | null
          auto_center_id?: string | null
          cotacao_aprovada_id?: string | null
          created_at?: string | null
          criado_por?: string | null
          data_conclusao?: string | null
          data_conclusao_real?: string | null
          data_entrada?: string | null
          data_previsao?: string | null
          data_retirada?: string | null
          etapas_reparo?: Json | null
          garantia_ate?: string | null
          id?: string
          numero: string
          observacoes?: string | null
          observacoes_internas?: string | null
          oficina_id: string
          retorno_garantia_os_id?: string | null
          sinistro_id?: string | null
          status?: Database["public"]["Enums"]["status_ordem_servico"] | null
          tempo_total_dias?: number | null
          termo_saida_assinado?: boolean | null
          termo_saida_assinado_em?: string | null
          termo_saida_url?: string | null
          token_retirada?: string | null
          token_retirada_expira?: string | null
          updated_at?: string | null
          valor_aprovado?: number | null
          valor_orcamento?: number | null
          valor_pago?: number | null
          veiculo_id: string
        }
        Update: {
          aprovado_por?: string | null
          assinatura_retirada_url?: string | null
          associado_id?: string
          autentique_documento_id?: string | null
          autentique_url?: string | null
          auto_center_id?: string | null
          cotacao_aprovada_id?: string | null
          created_at?: string | null
          criado_por?: string | null
          data_conclusao?: string | null
          data_conclusao_real?: string | null
          data_entrada?: string | null
          data_previsao?: string | null
          data_retirada?: string | null
          etapas_reparo?: Json | null
          garantia_ate?: string | null
          id?: string
          numero?: string
          observacoes?: string | null
          observacoes_internas?: string | null
          oficina_id?: string
          retorno_garantia_os_id?: string | null
          sinistro_id?: string | null
          status?: Database["public"]["Enums"]["status_ordem_servico"] | null
          tempo_total_dias?: number | null
          termo_saida_assinado?: boolean | null
          termo_saida_assinado_em?: string | null
          termo_saida_url?: string | null
          token_retirada?: string | null
          token_retirada_expira?: string | null
          updated_at?: string | null
          valor_aprovado?: number | null
          valor_orcamento?: number | null
          valor_pago?: number | null
          veiculo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ordens_servico_aprovado_por_fkey"
            columns: ["aprovado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_servico_aprovado_por_fkey"
            columns: ["aprovado_por"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "ordens_servico_aprovado_por_fkey"
            columns: ["aprovado_por"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "ordens_servico_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "associados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_servico_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "ordens_servico_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "ordens_servico_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associado_financeiro"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "ordens_servico_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associados_publico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_servico_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_inadimplentes"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "ordens_servico_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "ordens_servico_auto_center_id_fkey"
            columns: ["auto_center_id"]
            isOneToOne: false
            referencedRelation: "auto_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_servico_cotacao_aprovada_id_fkey"
            columns: ["cotacao_aprovada_id"]
            isOneToOne: false
            referencedRelation: "evento_cotacoes_pecas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_servico_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_servico_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "ordens_servico_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "ordens_servico_oficina_id_fkey"
            columns: ["oficina_id"]
            isOneToOne: false
            referencedRelation: "oficinas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_servico_retorno_garantia_os_id_fkey"
            columns: ["retorno_garantia_os_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_servico_sinistro_id_fkey"
            columns: ["sinistro_id"]
            isOneToOne: false
            referencedRelation: "sinistros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_servico_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_servico_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["veiculo_id"]
          },
          {
            foreignKeyName: "ordens_servico_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["veiculo_id"]
          },
          {
            foreignKeyName: "ordens_servico_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["veiculo_id"]
          },
          {
            foreignKeyName: "ordens_servico_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "vw_veiculos_com_cotas"
            referencedColumns: ["id"]
          },
        ]
      }
      ordens_servico_fotos: {
        Row: {
          arquivo_url: string
          created_at: string | null
          descricao: string | null
          id: string
          ordem_servico_id: string
          tipo: Database["public"]["Enums"]["tipo_foto_os"]
        }
        Insert: {
          arquivo_url: string
          created_at?: string | null
          descricao?: string | null
          id?: string
          ordem_servico_id: string
          tipo: Database["public"]["Enums"]["tipo_foto_os"]
        }
        Update: {
          arquivo_url?: string
          created_at?: string | null
          descricao?: string | null
          id?: string
          ordem_servico_id?: string
          tipo?: Database["public"]["Enums"]["tipo_foto_os"]
        }
        Relationships: [
          {
            foreignKeyName: "ordens_servico_fotos_ordem_servico_id_fkey"
            columns: ["ordem_servico_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
        ]
      }
      ordens_servico_historico: {
        Row: {
          created_at: string | null
          id: string
          observacao: string | null
          ordem_servico_id: string
          status_anterior: string | null
          status_novo: string
          usuario_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          observacao?: string | null
          ordem_servico_id: string
          status_anterior?: string | null
          status_novo: string
          usuario_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          observacao?: string | null
          ordem_servico_id?: string
          status_anterior?: string | null
          status_novo?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ordens_servico_historico_ordem_servico_id_fkey"
            columns: ["ordem_servico_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_servico_historico_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_servico_historico_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "ordens_servico_historico_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
        ]
      }
      ordens_servico_itens: {
        Row: {
          aprovado: boolean | null
          created_at: string | null
          descricao: string
          id: string
          marca: string | null
          numero_peca: string | null
          ordem_servico_id: string
          quantidade: number | null
          tipo: Database["public"]["Enums"]["tipo_item_os"]
          valor_total: number
          valor_unitario: number
        }
        Insert: {
          aprovado?: boolean | null
          created_at?: string | null
          descricao: string
          id?: string
          marca?: string | null
          numero_peca?: string | null
          ordem_servico_id: string
          quantidade?: number | null
          tipo: Database["public"]["Enums"]["tipo_item_os"]
          valor_total: number
          valor_unitario: number
        }
        Update: {
          aprovado?: boolean | null
          created_at?: string | null
          descricao?: string
          id?: string
          marca?: string | null
          numero_peca?: string | null
          ordem_servico_id?: string
          quantidade?: number | null
          tipo?: Database["public"]["Enums"]["tipo_item_os"]
          valor_total?: number
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "ordens_servico_itens_ordem_servico_id_fkey"
            columns: ["ordem_servico_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
        ]
      }
      os_atualizacoes_diarias: {
        Row: {
          created_at: string | null
          descricao: string
          descricao_problema: string | null
          etapa_concluida: string | null
          etapa_iniciada: string | null
          fotos_urls: Json
          id: string
          ordem_servico_id: string
          regulador_id: string
          tem_problema: boolean | null
          tipo_problema: string | null
          video_url: string | null
        }
        Insert: {
          created_at?: string | null
          descricao: string
          descricao_problema?: string | null
          etapa_concluida?: string | null
          etapa_iniciada?: string | null
          fotos_urls?: Json
          id?: string
          ordem_servico_id: string
          regulador_id: string
          tem_problema?: boolean | null
          tipo_problema?: string | null
          video_url?: string | null
        }
        Update: {
          created_at?: string | null
          descricao?: string
          descricao_problema?: string | null
          etapa_concluida?: string | null
          etapa_iniciada?: string | null
          fotos_urls?: Json
          id?: string
          ordem_servico_id?: string
          regulador_id?: string
          tem_problema?: boolean | null
          tipo_problema?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "os_atualizacoes_diarias_ordem_servico_id_fkey"
            columns: ["ordem_servico_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "os_atualizacoes_diarias_regulador_id_fkey"
            columns: ["regulador_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "os_atualizacoes_diarias_regulador_id_fkey"
            columns: ["regulador_id"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "os_atualizacoes_diarias_regulador_id_fkey"
            columns: ["regulador_id"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
        ]
      }
      os_vistorias_presenciais: {
        Row: {
          created_at: string | null
          id: string
          latitude: number | null
          longitude: number | null
          observacoes: string | null
          ordem_servico_id: string
          regulador_id: string
          video_url: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          observacoes?: string | null
          ordem_servico_id: string
          regulador_id: string
          video_url?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          observacoes?: string | null
          ordem_servico_id?: string
          regulador_id?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "os_vistorias_presenciais_ordem_servico_id_fkey"
            columns: ["ordem_servico_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "os_vistorias_presenciais_regulador_id_fkey"
            columns: ["regulador_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "os_vistorias_presenciais_regulador_id_fkey"
            columns: ["regulador_id"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "os_vistorias_presenciais_regulador_id_fkey"
            columns: ["regulador_id"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
        ]
      }
      ouvidoria_anexos: {
        Row: {
          created_at: string | null
          id: string
          manifestacao_id: string
          nome_arquivo: string
          tamanho_bytes: number | null
          tipo_arquivo: string | null
          url: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          manifestacao_id: string
          nome_arquivo: string
          tamanho_bytes?: number | null
          tipo_arquivo?: string | null
          url: string
        }
        Update: {
          created_at?: string | null
          id?: string
          manifestacao_id?: string
          nome_arquivo?: string
          tamanho_bytes?: number | null
          tipo_arquivo?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "ouvidoria_anexos_manifestacao_id_fkey"
            columns: ["manifestacao_id"]
            isOneToOne: false
            referencedRelation: "ouvidoria_manifestacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      ouvidoria_config: {
        Row: {
          chave: string
          descricao: string | null
          id: string
          updated_at: string | null
          valor: string
        }
        Insert: {
          chave: string
          descricao?: string | null
          id?: string
          updated_at?: string | null
          valor: string
        }
        Update: {
          chave?: string
          descricao?: string | null
          id?: string
          updated_at?: string | null
          valor?: string
        }
        Relationships: []
      }
      ouvidoria_ia_logs: {
        Row: {
          confianca: number | null
          created_at: string | null
          departamento_sugerido: string | null
          entrada: string | null
          id: string
          manifestacao_id: string
          palavras_chave_detectadas: string[] | null
          prioridade_sugerida: string | null
          saida: string | null
          sentimento: string | null
          tempo_resposta_ms: number | null
          tipo_acao: string
          tokens_entrada: number | null
          tokens_saida: number | null
        }
        Insert: {
          confianca?: number | null
          created_at?: string | null
          departamento_sugerido?: string | null
          entrada?: string | null
          id?: string
          manifestacao_id: string
          palavras_chave_detectadas?: string[] | null
          prioridade_sugerida?: string | null
          saida?: string | null
          sentimento?: string | null
          tempo_resposta_ms?: number | null
          tipo_acao: string
          tokens_entrada?: number | null
          tokens_saida?: number | null
        }
        Update: {
          confianca?: number | null
          created_at?: string | null
          departamento_sugerido?: string | null
          entrada?: string | null
          id?: string
          manifestacao_id?: string
          palavras_chave_detectadas?: string[] | null
          prioridade_sugerida?: string | null
          saida?: string | null
          sentimento?: string | null
          tempo_resposta_ms?: number | null
          tipo_acao?: string
          tokens_entrada?: number | null
          tokens_saida?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ouvidoria_ia_logs_manifestacao_id_fkey"
            columns: ["manifestacao_id"]
            isOneToOne: false
            referencedRelation: "ouvidoria_manifestacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      ouvidoria_interacoes: {
        Row: {
          anexo_url: string | null
          created_at: string | null
          id: string
          manifestacao_id: string
          mensagem: string
          tipo: string
          usuario_id: string | null
          visivel_associado: boolean | null
        }
        Insert: {
          anexo_url?: string | null
          created_at?: string | null
          id?: string
          manifestacao_id: string
          mensagem: string
          tipo: string
          usuario_id?: string | null
          visivel_associado?: boolean | null
        }
        Update: {
          anexo_url?: string | null
          created_at?: string | null
          id?: string
          manifestacao_id?: string
          mensagem?: string
          tipo?: string
          usuario_id?: string | null
          visivel_associado?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "ouvidoria_interacoes_manifestacao_id_fkey"
            columns: ["manifestacao_id"]
            isOneToOne: false
            referencedRelation: "ouvidoria_manifestacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ouvidoria_interacoes_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ouvidoria_interacoes_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "ouvidoria_interacoes_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
        ]
      }
      ouvidoria_manifestacoes: {
        Row: {
          anonimo: boolean | null
          associado_id: string | null
          assunto: string
          avaliacao_comentario: string | null
          avaliacao_nota: number | null
          canal: string
          categoria: string | null
          colaborador_elogiado: string | null
          created_at: string | null
          data_atendimento: string | null
          data_contato: string | null
          data_encerramento: string | null
          data_limite: string | null
          data_primeira_resposta: string | null
          departamento: string | null
          descricao: string
          id: string
          observacao_interna: string | null
          prioridade: string | null
          protocolo: string
          registrado_por_id: string | null
          registrado_por_nome: string | null
          responsavel_id: string | null
          setor_elogio: string | null
          status: string | null
          tipo: string
          updated_at: string | null
          vinculo_juridico_id: string | null
        }
        Insert: {
          anonimo?: boolean | null
          associado_id?: string | null
          assunto: string
          avaliacao_comentario?: string | null
          avaliacao_nota?: number | null
          canal: string
          categoria?: string | null
          colaborador_elogiado?: string | null
          created_at?: string | null
          data_atendimento?: string | null
          data_contato?: string | null
          data_encerramento?: string | null
          data_limite?: string | null
          data_primeira_resposta?: string | null
          departamento?: string | null
          descricao: string
          id?: string
          observacao_interna?: string | null
          prioridade?: string | null
          protocolo: string
          registrado_por_id?: string | null
          registrado_por_nome?: string | null
          responsavel_id?: string | null
          setor_elogio?: string | null
          status?: string | null
          tipo: string
          updated_at?: string | null
          vinculo_juridico_id?: string | null
        }
        Update: {
          anonimo?: boolean | null
          associado_id?: string | null
          assunto?: string
          avaliacao_comentario?: string | null
          avaliacao_nota?: number | null
          canal?: string
          categoria?: string | null
          colaborador_elogiado?: string | null
          created_at?: string | null
          data_atendimento?: string | null
          data_contato?: string | null
          data_encerramento?: string | null
          data_limite?: string | null
          data_primeira_resposta?: string | null
          departamento?: string | null
          descricao?: string
          id?: string
          observacao_interna?: string | null
          prioridade?: string | null
          protocolo?: string
          registrado_por_id?: string | null
          registrado_por_nome?: string | null
          responsavel_id?: string | null
          setor_elogio?: string | null
          status?: string | null
          tipo?: string
          updated_at?: string | null
          vinculo_juridico_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ouvidoria_manifestacoes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "associados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ouvidoria_manifestacoes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "ouvidoria_manifestacoes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "ouvidoria_manifestacoes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associado_financeiro"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "ouvidoria_manifestacoes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associados_publico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ouvidoria_manifestacoes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_inadimplentes"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "ouvidoria_manifestacoes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "ouvidoria_manifestacoes_registrado_por_id_fkey"
            columns: ["registrado_por_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ouvidoria_manifestacoes_registrado_por_id_fkey"
            columns: ["registrado_por_id"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "ouvidoria_manifestacoes_registrado_por_id_fkey"
            columns: ["registrado_por_id"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "ouvidoria_manifestacoes_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ouvidoria_manifestacoes_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "ouvidoria_manifestacoes_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "ouvidoria_manifestacoes_vinculo_juridico_id_fkey"
            columns: ["vinculo_juridico_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
        ]
      }
      parecer_tecnico_fotos: {
        Row: {
          arquivo_url: string
          created_at: string
          descricao: string | null
          id: string
          parecer_id: string
        }
        Insert: {
          arquivo_url: string
          created_at?: string
          descricao?: string | null
          id?: string
          parecer_id: string
        }
        Update: {
          arquivo_url?: string
          created_at?: string
          descricao?: string | null
          id?: string
          parecer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "parecer_tecnico_fotos_parecer_id_fkey"
            columns: ["parecer_id"]
            isOneToOne: false
            referencedRelation: "parecer_tecnico_regulador"
            referencedColumns: ["id"]
          },
        ]
      }
      parecer_tecnico_itens: {
        Row: {
          created_at: string
          descricao: string
          id: string
          observacao: string | null
          origem_sugerida: string | null
          parecer_id: string
          prioridade: string | null
          quantidade: number | null
          tipo: string
          valor_estimado: number | null
        }
        Insert: {
          created_at?: string
          descricao: string
          id?: string
          observacao?: string | null
          origem_sugerida?: string | null
          parecer_id: string
          prioridade?: string | null
          quantidade?: number | null
          tipo: string
          valor_estimado?: number | null
        }
        Update: {
          created_at?: string
          descricao?: string
          id?: string
          observacao?: string | null
          origem_sugerida?: string | null
          parecer_id?: string
          prioridade?: string | null
          quantidade?: number | null
          tipo?: string
          valor_estimado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "parecer_tecnico_itens_parecer_id_fkey"
            columns: ["parecer_id"]
            isOneToOne: false
            referencedRelation: "parecer_tecnico_regulador"
            referencedColumns: ["id"]
          },
        ]
      }
      parecer_tecnico_regulador: {
        Row: {
          created_at: string
          descricao_tecnica: string
          estimativa_total: number | null
          gravidade: string
          id: string
          observacoes_gerais: string | null
          prazo_estimado: string | null
          prazo_observacao: string | null
          recomendacao: string | null
          regulador_id: string
          sinistro_id: string
          vistoria_id: string | null
        }
        Insert: {
          created_at?: string
          descricao_tecnica: string
          estimativa_total?: number | null
          gravidade: string
          id?: string
          observacoes_gerais?: string | null
          prazo_estimado?: string | null
          prazo_observacao?: string | null
          recomendacao?: string | null
          regulador_id: string
          sinistro_id: string
          vistoria_id?: string | null
        }
        Update: {
          created_at?: string
          descricao_tecnica?: string
          estimativa_total?: number | null
          gravidade?: string
          id?: string
          observacoes_gerais?: string | null
          prazo_estimado?: string | null
          prazo_observacao?: string | null
          recomendacao?: string | null
          regulador_id?: string
          sinistro_id?: string
          vistoria_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parecer_tecnico_regulador_sinistro_id_fkey"
            columns: ["sinistro_id"]
            isOneToOne: true
            referencedRelation: "sinistros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parecer_tecnico_regulador_vistoria_id_fkey"
            columns: ["vistoria_id"]
            isOneToOne: false
            referencedRelation: "vistorias_evento"
            referencedColumns: ["id"]
          },
        ]
      }
      pesquisas_antecedentes: {
        Row: {
          associado_id: string | null
          cpf_cnpj: string
          created_at: string | null
          id: string
          nome: string
          pesquisado_por: string | null
          processo_id: string | null
          resultado: Json
          score_risco: string | null
        }
        Insert: {
          associado_id?: string | null
          cpf_cnpj: string
          created_at?: string | null
          id?: string
          nome: string
          pesquisado_por?: string | null
          processo_id?: string | null
          resultado?: Json
          score_risco?: string | null
        }
        Update: {
          associado_id?: string | null
          cpf_cnpj?: string
          created_at?: string | null
          id?: string
          nome?: string
          pesquisado_por?: string | null
          processo_id?: string | null
          resultado?: Json
          score_risco?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pesquisas_antecedentes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "associados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pesquisas_antecedentes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "pesquisas_antecedentes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "pesquisas_antecedentes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associado_financeiro"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "pesquisas_antecedentes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associados_publico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pesquisas_antecedentes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_inadimplentes"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "pesquisas_antecedentes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "pesquisas_antecedentes_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_benefits: {
        Row: {
          additional_info: string | null
          benefit_id: string
          created_at: string | null
          custom_text: string | null
          custom_value: string | null
          display_order: number | null
          id: string
          is_highlighted: boolean | null
          plan_id: string
        }
        Insert: {
          additional_info?: string | null
          benefit_id: string
          created_at?: string | null
          custom_text?: string | null
          custom_value?: string | null
          display_order?: number | null
          id?: string
          is_highlighted?: boolean | null
          plan_id: string
        }
        Update: {
          additional_info?: string | null
          benefit_id?: string
          created_at?: string | null
          custom_text?: string | null
          custom_value?: string | null
          display_order?: number | null
          id?: string
          is_highlighted?: boolean | null
          plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_benefits_benefit_id_fkey"
            columns: ["benefit_id"]
            isOneToOne: false
            referencedRelation: "benefits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_benefits_benefit_id_fkey"
            columns: ["benefit_id"]
            isOneToOne: false
            referencedRelation: "vw_custo_real_benefits"
            referencedColumns: ["beneficio_id"]
          },
          {
            foreignKeyName: "plan_benefits_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plano_contas: {
        Row: {
          aceita_lancamento: boolean | null
          ativa: boolean | null
          codigo: string
          conta_padrao_para: string | null
          conta_pai_id: string | null
          created_at: string | null
          descricao: string
          id: string
          natureza: string
          nivel: number
          ordem: number | null
          sintetica: boolean | null
          tipo: string
          updated_at: string | null
        }
        Insert: {
          aceita_lancamento?: boolean | null
          ativa?: boolean | null
          codigo: string
          conta_padrao_para?: string | null
          conta_pai_id?: string | null
          created_at?: string | null
          descricao: string
          id?: string
          natureza: string
          nivel: number
          ordem?: number | null
          sintetica?: boolean | null
          tipo: string
          updated_at?: string | null
        }
        Update: {
          aceita_lancamento?: boolean | null
          ativa?: boolean | null
          codigo?: string
          conta_padrao_para?: string | null
          conta_pai_id?: string | null
          created_at?: string | null
          descricao?: string
          id?: string
          natureza?: string
          nivel?: number
          ordem?: number | null
          sintetica?: boolean | null
          tipo?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plano_contas_conta_pai_id_fkey"
            columns: ["conta_pai_id"]
            isOneToOne: false
            referencedRelation: "plano_contas"
            referencedColumns: ["id"]
          },
        ]
      }
      plano_elegibilidade_modelos: {
        Row: {
          ano_max: number | null
          ano_min: number
          cobertura_fipe: number | null
          combustivel: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          linha_slug: string
          marca: string
          modelo: string
          observacao: string | null
          plano_id: string
          status: string
          updated_at: string | null
        }
        Insert: {
          ano_max?: number | null
          ano_min?: number
          cobertura_fipe?: number | null
          combustivel?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          linha_slug: string
          marca: string
          modelo: string
          observacao?: string | null
          plano_id: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          ano_max?: number | null
          ano_min?: number
          cobertura_fipe?: number | null
          combustivel?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          linha_slug?: string
          marca?: string
          modelo?: string
          observacao?: string | null
          plano_id?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plano_elegibilidade_modelos_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "planos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plano_elegibilidade_modelos_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "vw_plans_compat"
            referencedColumns: ["id"]
          },
        ]
      }
      plano_preco_map: {
        Row: {
          created_at: string | null
          id: string
          linha_slug: string
          plano_id: string
          tipo_uso: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          linha_slug: string
          plano_id: string
          tipo_uso: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          linha_slug?: string
          plano_id?: string
          tipo_uso?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plano_preco_map_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "planos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plano_preco_map_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "vw_plans_compat"
            referencedColumns: ["id"]
          },
        ]
      }
      planos: {
        Row: {
          adicional_mensal: number | null
          agente_descricao: string | null
          ano_fabricacao_maximo: number | null
          ano_fabricacao_minimo: number | null
          ano_minimo: number | null
          ano_minimo_veiculo: number | null
          ativo: boolean
          badge_color: string | null
          badge_text: string | null
          categoria: string | null
          cobertura_fipe: number | null
          coberturas: string[] | null
          codigo: string
          cota_app_min: number | null
          cota_app_percent: number | null
          cota_desagio: number | null
          cota_minima: number | null
          cota_minima_desagio: number | null
          cota_participacao: number | null
          cota_terceiros: number | null
          cota_terceiros_isento: boolean
          coverage_type: string | null
          created_at: string
          desconto_percentual: number | null
          descricao: string | null
          descricao_landing: string | null
          destaque: boolean | null
          disponivel_agente: boolean | null
          fipe_maxima: number | null
          fipe_minima: number | null
          footer_note: string | null
          id: string
          imagem_landing_url: string | null
          limite_terceiros: number | null
          linha: string | null
          nivel: string | null
          nome: string
          ordem: number | null
          ordem_exibicao: number | null
          product_line_id: string | null
          restriction_alert: string | null
          slug: string | null
          tipo_uso: string
          tipo_veiculo: string | null
          updated_at: string
          uso: string | null
          valor_adesao: number
          visivel_gestao: boolean
          visivel_landing: boolean | null
        }
        Insert: {
          adicional_mensal?: number | null
          agente_descricao?: string | null
          ano_fabricacao_maximo?: number | null
          ano_fabricacao_minimo?: number | null
          ano_minimo?: number | null
          ano_minimo_veiculo?: number | null
          ativo?: boolean
          badge_color?: string | null
          badge_text?: string | null
          categoria?: string | null
          cobertura_fipe?: number | null
          coberturas?: string[] | null
          codigo: string
          cota_app_min?: number | null
          cota_app_percent?: number | null
          cota_desagio?: number | null
          cota_minima?: number | null
          cota_minima_desagio?: number | null
          cota_participacao?: number | null
          cota_terceiros?: number | null
          cota_terceiros_isento?: boolean
          coverage_type?: string | null
          created_at?: string
          desconto_percentual?: number | null
          descricao?: string | null
          descricao_landing?: string | null
          destaque?: boolean | null
          disponivel_agente?: boolean | null
          fipe_maxima?: number | null
          fipe_minima?: number | null
          footer_note?: string | null
          id?: string
          imagem_landing_url?: string | null
          limite_terceiros?: number | null
          linha?: string | null
          nivel?: string | null
          nome: string
          ordem?: number | null
          ordem_exibicao?: number | null
          product_line_id?: string | null
          restriction_alert?: string | null
          slug?: string | null
          tipo_uso?: string
          tipo_veiculo?: string | null
          updated_at?: string
          uso?: string | null
          valor_adesao: number
          visivel_gestao?: boolean
          visivel_landing?: boolean | null
        }
        Update: {
          adicional_mensal?: number | null
          agente_descricao?: string | null
          ano_fabricacao_maximo?: number | null
          ano_fabricacao_minimo?: number | null
          ano_minimo?: number | null
          ano_minimo_veiculo?: number | null
          ativo?: boolean
          badge_color?: string | null
          badge_text?: string | null
          categoria?: string | null
          cobertura_fipe?: number | null
          coberturas?: string[] | null
          codigo?: string
          cota_app_min?: number | null
          cota_app_percent?: number | null
          cota_desagio?: number | null
          cota_minima?: number | null
          cota_minima_desagio?: number | null
          cota_participacao?: number | null
          cota_terceiros?: number | null
          cota_terceiros_isento?: boolean
          coverage_type?: string | null
          created_at?: string
          desconto_percentual?: number | null
          descricao?: string | null
          descricao_landing?: string | null
          destaque?: boolean | null
          disponivel_agente?: boolean | null
          fipe_maxima?: number | null
          fipe_minima?: number | null
          footer_note?: string | null
          id?: string
          imagem_landing_url?: string | null
          limite_terceiros?: number | null
          linha?: string | null
          nivel?: string | null
          nome?: string
          ordem?: number | null
          ordem_exibicao?: number | null
          product_line_id?: string | null
          restriction_alert?: string | null
          slug?: string | null
          tipo_uso?: string
          tipo_veiculo?: string | null
          updated_at?: string
          uso?: string | null
          valor_adesao?: number
          visivel_gestao?: boolean
          visivel_landing?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "planos_product_line_id_fkey"
            columns: ["product_line_id"]
            isOneToOne: false
            referencedRelation: "product_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      planos_beneficios: {
        Row: {
          additional_info: string | null
          beneficio: string
          benefit_id: string | null
          created_at: string | null
          custom_text: string | null
          custom_value: string | null
          descricao: string | null
          display_order: number | null
          id: string
          incluso: boolean | null
          is_highlighted: boolean | null
          observacao: string | null
          ordem: number | null
          plano_id: string
        }
        Insert: {
          additional_info?: string | null
          beneficio: string
          benefit_id?: string | null
          created_at?: string | null
          custom_text?: string | null
          custom_value?: string | null
          descricao?: string | null
          display_order?: number | null
          id?: string
          incluso?: boolean | null
          is_highlighted?: boolean | null
          observacao?: string | null
          ordem?: number | null
          plano_id: string
        }
        Update: {
          additional_info?: string | null
          beneficio?: string
          benefit_id?: string | null
          created_at?: string | null
          custom_text?: string | null
          custom_value?: string | null
          descricao?: string | null
          display_order?: number | null
          id?: string
          incluso?: boolean | null
          is_highlighted?: boolean | null
          observacao?: string | null
          ordem?: number | null
          plano_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "planos_beneficios_benefit_id_fkey"
            columns: ["benefit_id"]
            isOneToOne: false
            referencedRelation: "benefits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planos_beneficios_benefit_id_fkey"
            columns: ["benefit_id"]
            isOneToOne: false
            referencedRelation: "vw_custo_real_benefits"
            referencedColumns: ["beneficio_id"]
          },
          {
            foreignKeyName: "planos_beneficios_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "planos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planos_beneficios_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "vw_plans_compat"
            referencedColumns: ["id"]
          },
        ]
      }
      planos_coberturas: {
        Row: {
          carencia_dias: number | null
          cobertura_id: string
          created_at: string | null
          franquia_percentual: number | null
          franquia_valor: number | null
          id: string
          obrigatoria: boolean | null
          percentual_cobertura: number | null
          plano_id: string
          valor_limite: number | null
        }
        Insert: {
          carencia_dias?: number | null
          cobertura_id: string
          created_at?: string | null
          franquia_percentual?: number | null
          franquia_valor?: number | null
          id?: string
          obrigatoria?: boolean | null
          percentual_cobertura?: number | null
          plano_id: string
          valor_limite?: number | null
        }
        Update: {
          carencia_dias?: number | null
          cobertura_id?: string
          created_at?: string | null
          franquia_percentual?: number | null
          franquia_valor?: number | null
          id?: string
          obrigatoria?: boolean | null
          percentual_cobertura?: number | null
          plano_id?: string
          valor_limite?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "planos_coberturas_cobertura_id_fkey"
            columns: ["cobertura_id"]
            isOneToOne: false
            referencedRelation: "coberturas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planos_coberturas_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "planos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planos_coberturas_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "vw_plans_compat"
            referencedColumns: ["id"]
          },
        ]
      }
      planos_cotas_categoria: {
        Row: {
          categoria_veiculo: string
          cota_minima_valor: number | null
          cota_percentual: number | null
          created_at: string | null
          id: string
          plano_id: string
          updated_at: string | null
        }
        Insert: {
          categoria_veiculo: string
          cota_minima_valor?: number | null
          cota_percentual?: number | null
          created_at?: string | null
          id?: string
          plano_id: string
          updated_at?: string | null
        }
        Update: {
          categoria_veiculo?: string
          cota_minima_valor?: number | null
          cota_percentual?: number | null
          created_at?: string | null
          id?: string
          plano_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "planos_cotas_categoria_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "planos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planos_cotas_categoria_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "vw_plans_compat"
            referencedColumns: ["id"]
          },
        ]
      }
      planos_regioes: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          id: string
          plano_id: string
          regiao_id: string
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          id?: string
          plano_id: string
          regiao_id: string
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          id?: string
          plano_id?: string
          regiao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "planos_regioes_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "planos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planos_regioes_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "vw_plans_compat"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planos_regioes_regiao_id_fkey"
            columns: ["regiao_id"]
            isOneToOne: false
            referencedRelation: "regioes"
            referencedColumns: ["id"]
          },
        ]
      }
      planos_restricoes: {
        Row: {
          categoria_veiculo: string
          cobertura_removida: string | null
          created_at: string | null
          id: string
          mensagem_alerta: string | null
          plano_id: string
          tipo_restricao: string
        }
        Insert: {
          categoria_veiculo: string
          cobertura_removida?: string | null
          created_at?: string | null
          id?: string
          mensagem_alerta?: string | null
          plano_id: string
          tipo_restricao: string
        }
        Update: {
          categoria_veiculo?: string
          cobertura_removida?: string | null
          created_at?: string | null
          id?: string
          mensagem_alerta?: string | null
          plano_id?: string
          tipo_restricao?: string
        }
        Relationships: [
          {
            foreignKeyName: "planos_restricoes_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "planos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planos_restricoes_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "vw_plans_compat"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          additional_price: number | null
          badge_color: string | null
          badge_text: string | null
          cota_app_min: number | null
          cota_app_percent: number | null
          cota_desagio_min: number | null
          cota_desagio_percent: number | null
          cota_passeio_min: number | null
          cota_passeio_percent: number | null
          coverage_type: string | null
          created_at: string | null
          display_order: number | null
          footer_note: string | null
          id: string
          is_active: boolean | null
          min_vehicle_year: string | null
          name: string
          product_line_id: string
          restriction_alert: string | null
          slug: string
          tipo_uso: string
          updated_at: string | null
        }
        Insert: {
          additional_price?: number | null
          badge_color?: string | null
          badge_text?: string | null
          cota_app_min?: number | null
          cota_app_percent?: number | null
          cota_desagio_min?: number | null
          cota_desagio_percent?: number | null
          cota_passeio_min?: number | null
          cota_passeio_percent?: number | null
          coverage_type?: string | null
          created_at?: string | null
          display_order?: number | null
          footer_note?: string | null
          id?: string
          is_active?: boolean | null
          min_vehicle_year?: string | null
          name: string
          product_line_id: string
          restriction_alert?: string | null
          slug: string
          tipo_uso?: string
          updated_at?: string | null
        }
        Update: {
          additional_price?: number | null
          badge_color?: string | null
          badge_text?: string | null
          cota_app_min?: number | null
          cota_app_percent?: number | null
          cota_desagio_min?: number | null
          cota_desagio_percent?: number | null
          cota_passeio_min?: number | null
          cota_passeio_percent?: number | null
          coverage_type?: string | null
          created_at?: string | null
          display_order?: number | null
          footer_note?: string | null
          id?: string
          is_active?: boolean | null
          min_vehicle_year?: string | null
          name?: string
          product_line_id?: string
          restriction_alert?: string | null
          slug?: string
          tipo_uso?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plans_product_line_id_fkey"
            columns: ["product_line_id"]
            isOneToOne: false
            referencedRelation: "product_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      ponto_registros: {
        Row: {
          aprovado_em: string | null
          aprovado_por: string | null
          created_at: string | null
          data: string
          documento_url: string | null
          entrada_1: string | null
          entrada_2: string | null
          entrada_3: string | null
          funcionario_id: string
          horas_extras: string | null
          horas_faltantes: string | null
          horas_trabalhadas: string | null
          id: string
          justificativa: string | null
          saida_1: string | null
          saida_2: string | null
          saida_3: string | null
          status: string | null
          tipo_dia: string | null
          updated_at: string | null
        }
        Insert: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          created_at?: string | null
          data: string
          documento_url?: string | null
          entrada_1?: string | null
          entrada_2?: string | null
          entrada_3?: string | null
          funcionario_id: string
          horas_extras?: string | null
          horas_faltantes?: string | null
          horas_trabalhadas?: string | null
          id?: string
          justificativa?: string | null
          saida_1?: string | null
          saida_2?: string | null
          saida_3?: string | null
          status?: string | null
          tipo_dia?: string | null
          updated_at?: string | null
        }
        Update: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          created_at?: string | null
          data?: string
          documento_url?: string | null
          entrada_1?: string | null
          entrada_2?: string | null
          entrada_3?: string | null
          funcionario_id?: string
          horas_extras?: string | null
          horas_faltantes?: string | null
          horas_trabalhadas?: string | null
          id?: string
          justificativa?: string | null
          saida_1?: string | null
          saida_2?: string | null
          saida_3?: string | null
          status?: string | null
          tipo_dia?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ponto_registros_aprovado_por_fkey"
            columns: ["aprovado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ponto_registros_aprovado_por_fkey"
            columns: ["aprovado_por"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "ponto_registros_aprovado_por_fkey"
            columns: ["aprovado_por"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "ponto_registros_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ponto_registros_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "view_aniversariantes_mes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ponto_registros_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "view_funcionarios_ativos"
            referencedColumns: ["id"]
          },
        ]
      }
      pontuacao_eventos: {
        Row: {
          conta_ranking: boolean
          contrato_id: string | null
          created_at: string
          estornado: boolean
          estorno_id: string | null
          id: string
          mes_referencia: string
          pontos: number
          referencia_id: string | null
          referencia_tipo: string | null
          tipo_operacao: string
          vendedor_id: string
        }
        Insert: {
          conta_ranking?: boolean
          contrato_id?: string | null
          created_at?: string
          estornado?: boolean
          estorno_id?: string | null
          id?: string
          mes_referencia?: string
          pontos: number
          referencia_id?: string | null
          referencia_tipo?: string | null
          tipo_operacao: string
          vendedor_id: string
        }
        Update: {
          conta_ranking?: boolean
          contrato_id?: string | null
          created_at?: string
          estornado?: boolean
          estorno_id?: string | null
          id?: string
          mes_referencia?: string
          pontos?: number
          referencia_id?: string | null
          referencia_tipo?: string | null
          tipo_operacao?: string
          vendedor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pontuacao_eventos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pontuacao_eventos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "pontuacao_eventos_estorno_id_fkey"
            columns: ["estorno_id"]
            isOneToOne: false
            referencedRelation: "pontuacao_eventos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pontuacao_eventos_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pontuacao_eventos_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "pontuacao_eventos_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
        ]
      }
      prestadores_assistencia: {
        Row: {
          agencia: string | null
          bairro: string | null
          banco: string | null
          cep: string | null
          cidade: string
          cidades_atendidas: string[] | null
          cnpj: string | null
          conta: string | null
          cpf: string | null
          created_at: string | null
          disponivel: boolean | null
          email: string | null
          estado: string
          id: string
          logradouro: string | null
          nome_fantasia: string | null
          nota_media: number | null
          numero: string | null
          pix_chave: string | null
          pix_tipo: string | null
          raio_atendimento_km: number | null
          razao_social: string
          status: string | null
          telefone: string
          telefone_extra: string | null
          tipo_pessoa: string | null
          tipos_reboque: string[] | null
          tipos_servico: string[] | null
          total_atendimentos: number | null
          total_avaliacoes: number | null
          updated_at: string | null
          whatsapp: string | null
        }
        Insert: {
          agencia?: string | null
          bairro?: string | null
          banco?: string | null
          cep?: string | null
          cidade: string
          cidades_atendidas?: string[] | null
          cnpj?: string | null
          conta?: string | null
          cpf?: string | null
          created_at?: string | null
          disponivel?: boolean | null
          email?: string | null
          estado: string
          id?: string
          logradouro?: string | null
          nome_fantasia?: string | null
          nota_media?: number | null
          numero?: string | null
          pix_chave?: string | null
          pix_tipo?: string | null
          raio_atendimento_km?: number | null
          razao_social: string
          status?: string | null
          telefone: string
          telefone_extra?: string | null
          tipo_pessoa?: string | null
          tipos_reboque?: string[] | null
          tipos_servico?: string[] | null
          total_atendimentos?: number | null
          total_avaliacoes?: number | null
          updated_at?: string | null
          whatsapp?: string | null
        }
        Update: {
          agencia?: string | null
          bairro?: string | null
          banco?: string | null
          cep?: string | null
          cidade?: string
          cidades_atendidas?: string[] | null
          cnpj?: string | null
          conta?: string | null
          cpf?: string | null
          created_at?: string | null
          disponivel?: boolean | null
          email?: string | null
          estado?: string
          id?: string
          logradouro?: string | null
          nome_fantasia?: string | null
          nota_media?: number | null
          numero?: string | null
          pix_chave?: string | null
          pix_tipo?: string | null
          raio_atendimento_km?: number | null
          razao_social?: string
          status?: string | null
          telefone?: string
          telefone_extra?: string | null
          tipo_pessoa?: string | null
          tipos_reboque?: string[] | null
          tipos_servico?: string[] | null
          total_atendimentos?: number | null
          total_avaliacoes?: number | null
          updated_at?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      prestadores_assistencia_valores: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          diaria_base: number | null
          hr_parada: number | null
          hr_trabalhada: number | null
          id: string
          km_franquia: number | null
          observacoes: string | null
          prestador_id: string
          tipo_reboque: string | null
          tipo_servico: string
          updated_at: string | null
          valor_fixo: number | null
          valor_km: number | null
          valor_saida: number | null
          valor_sugerido: number | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          diaria_base?: number | null
          hr_parada?: number | null
          hr_trabalhada?: number | null
          id?: string
          km_franquia?: number | null
          observacoes?: string | null
          prestador_id: string
          tipo_reboque?: string | null
          tipo_servico: string
          updated_at?: string | null
          valor_fixo?: number | null
          valor_km?: number | null
          valor_saida?: number | null
          valor_sugerido?: number | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          diaria_base?: number | null
          hr_parada?: number | null
          hr_trabalhada?: number | null
          id?: string
          km_franquia?: number | null
          observacoes?: string | null
          prestador_id?: string
          tipo_reboque?: string | null
          tipo_servico?: string
          updated_at?: string | null
          valor_fixo?: number | null
          valor_km?: number | null
          valor_saida?: number | null
          valor_sugerido?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "prestadores_assistencia_valores_prestador_id_fkey"
            columns: ["prestador_id"]
            isOneToOne: false
            referencedRelation: "prestadores_assistencia"
            referencedColumns: ["id"]
          },
        ]
      }
      prestadores_evento: {
        Row: {
          agencia: string | null
          bairro: string | null
          banco: string | null
          cep: string | null
          cidade: string | null
          cnpj: string | null
          complemento: string | null
          conta: string | null
          created_at: string
          email: string | null
          especialidades: string[] | null
          estado: string | null
          id: string
          inscricao_estadual: string | null
          logradouro: string | null
          marcas_atendidas: string[] | null
          nome_fantasia: string | null
          numero: string | null
          observacoes: string | null
          pix_chave: string | null
          pix_tipo: string | null
          razao_social: string
          status: string | null
          telefone: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          agencia?: string | null
          bairro?: string | null
          banco?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          complemento?: string | null
          conta?: string | null
          created_at?: string
          email?: string | null
          especialidades?: string[] | null
          estado?: string | null
          id?: string
          inscricao_estadual?: string | null
          logradouro?: string | null
          marcas_atendidas?: string[] | null
          nome_fantasia?: string | null
          numero?: string | null
          observacoes?: string | null
          pix_chave?: string | null
          pix_tipo?: string | null
          razao_social: string
          status?: string | null
          telefone?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          agencia?: string | null
          bairro?: string | null
          banco?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          complemento?: string | null
          conta?: string | null
          created_at?: string
          email?: string | null
          especialidades?: string[] | null
          estado?: string | null
          id?: string
          inscricao_estadual?: string | null
          logradouro?: string | null
          marcas_atendidas?: string[] | null
          nome_fantasia?: string | null
          numero?: string | null
          observacoes?: string | null
          pix_chave?: string | null
          pix_tipo?: string | null
          razao_social?: string
          status?: string | null
          telefone?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      processos: {
        Row: {
          advogado_id: string | null
          associado_id: string | null
          comarca: string | null
          created_at: string | null
          criado_por: string | null
          data_audiencia: string | null
          data_citacao: string | null
          data_distribuicao: string | null
          data_encerramento: string | null
          data_sentenca: string | null
          data_transito_julgado: string | null
          decisao: string | null
          decisao_observacoes: string | null
          decisao_parcelas: number | null
          decisao_prazo_recurso: string | null
          decisao_registrada_em: string | null
          decisao_registrada_por: string | null
          decisao_valor: number | null
          fase: string | null
          id: string
          instancia: string | null
          natureza: string
          numero: string | null
          numero_processo: string | null
          objeto: string
          observacoes: string | null
          origem: string | null
          parte_contraria_advogado: string | null
          parte_contraria_cpf_cnpj: string | null
          parte_contraria_nome: string
          parte_contraria_oab: string | null
          parte_contraria_telefone: string | null
          parte_contraria_tipo: string | null
          prioridade: string | null
          responsavel_id: string | null
          rito: string | null
          sinistro_id: string | null
          status: string | null
          tipo: string
          tribunal: string | null
          updated_at: string | null
          valor_acordo: number | null
          valor_causa: number | null
          valor_condenacao: number | null
          vara: string | null
        }
        Insert: {
          advogado_id?: string | null
          associado_id?: string | null
          comarca?: string | null
          created_at?: string | null
          criado_por?: string | null
          data_audiencia?: string | null
          data_citacao?: string | null
          data_distribuicao?: string | null
          data_encerramento?: string | null
          data_sentenca?: string | null
          data_transito_julgado?: string | null
          decisao?: string | null
          decisao_observacoes?: string | null
          decisao_parcelas?: number | null
          decisao_prazo_recurso?: string | null
          decisao_registrada_em?: string | null
          decisao_registrada_por?: string | null
          decisao_valor?: number | null
          fase?: string | null
          id?: string
          instancia?: string | null
          natureza: string
          numero?: string | null
          numero_processo?: string | null
          objeto: string
          observacoes?: string | null
          origem?: string | null
          parte_contraria_advogado?: string | null
          parte_contraria_cpf_cnpj?: string | null
          parte_contraria_nome: string
          parte_contraria_oab?: string | null
          parte_contraria_telefone?: string | null
          parte_contraria_tipo?: string | null
          prioridade?: string | null
          responsavel_id?: string | null
          rito?: string | null
          sinistro_id?: string | null
          status?: string | null
          tipo: string
          tribunal?: string | null
          updated_at?: string | null
          valor_acordo?: number | null
          valor_causa?: number | null
          valor_condenacao?: number | null
          vara?: string | null
        }
        Update: {
          advogado_id?: string | null
          associado_id?: string | null
          comarca?: string | null
          created_at?: string | null
          criado_por?: string | null
          data_audiencia?: string | null
          data_citacao?: string | null
          data_distribuicao?: string | null
          data_encerramento?: string | null
          data_sentenca?: string | null
          data_transito_julgado?: string | null
          decisao?: string | null
          decisao_observacoes?: string | null
          decisao_parcelas?: number | null
          decisao_prazo_recurso?: string | null
          decisao_registrada_em?: string | null
          decisao_registrada_por?: string | null
          decisao_valor?: number | null
          fase?: string | null
          id?: string
          instancia?: string | null
          natureza?: string
          numero?: string | null
          numero_processo?: string | null
          objeto?: string
          observacoes?: string | null
          origem?: string | null
          parte_contraria_advogado?: string | null
          parte_contraria_cpf_cnpj?: string | null
          parte_contraria_nome?: string
          parte_contraria_oab?: string | null
          parte_contraria_telefone?: string | null
          parte_contraria_tipo?: string | null
          prioridade?: string | null
          responsavel_id?: string | null
          rito?: string | null
          sinistro_id?: string | null
          status?: string | null
          tipo?: string
          tribunal?: string | null
          updated_at?: string | null
          valor_acordo?: number | null
          valor_causa?: number | null
          valor_condenacao?: number | null
          vara?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "processos_advogado_id_fkey"
            columns: ["advogado_id"]
            isOneToOne: false
            referencedRelation: "advogados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "associados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "processos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "processos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associado_financeiro"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "processos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associados_publico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_inadimplentes"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "processos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "processos_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processos_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "processos_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "processos_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processos_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "processos_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "processos_sinistro_id_fkey"
            columns: ["sinistro_id"]
            isOneToOne: false
            referencedRelation: "sinistros"
            referencedColumns: ["id"]
          },
        ]
      }
      processos_andamentos: {
        Row: {
          created_at: string | null
          data: string
          descricao: string
          gera_prazo: boolean | null
          id: string
          prazo_cumprido: boolean | null
          prazo_cumprido_em: string | null
          prazo_data: string | null
          prazo_descricao: string | null
          prazo_dias: number | null
          processo_id: string
          registrado_por: string | null
          tipo: string | null
        }
        Insert: {
          created_at?: string | null
          data: string
          descricao: string
          gera_prazo?: boolean | null
          id?: string
          prazo_cumprido?: boolean | null
          prazo_cumprido_em?: string | null
          prazo_data?: string | null
          prazo_descricao?: string | null
          prazo_dias?: number | null
          processo_id: string
          registrado_por?: string | null
          tipo?: string | null
        }
        Update: {
          created_at?: string | null
          data?: string
          descricao?: string
          gera_prazo?: boolean | null
          id?: string
          prazo_cumprido?: boolean | null
          prazo_cumprido_em?: string | null
          prazo_data?: string | null
          prazo_descricao?: string | null
          prazo_dias?: number | null
          processo_id?: string
          registrado_por?: string | null
          tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "processos_andamentos_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processos_andamentos_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processos_andamentos_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "processos_andamentos_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
        ]
      }
      processos_audiencias: {
        Row: {
          advogado_id: string | null
          advogado_presente: boolean | null
          created_at: string | null
          data_hora: string
          documentos_necessarios: Json | null
          endereco_completo: string | null
          forum: string | null
          id: string
          juiz_orgao: string | null
          link_videoconferencia: string | null
          local: string | null
          modalidade: string | null
          observacoes: string | null
          parte_presente: boolean | null
          pauta: string | null
          prazo_automatico_criado: boolean | null
          processo_id: string
          registrado_em: string | null
          registrado_por: string | null
          resultado: string | null
          resultado_condicoes: string | null
          resultado_motivo_adiamento: string | null
          resultado_nova_data: string | null
          resultado_prazo_pagamento: string | null
          resultado_prazo_recurso: string | null
          resultado_resumo: string | null
          resultado_tipo: string | null
          resultado_valor: number | null
          sala: string | null
          status: string | null
          testemunhas: string | null
          testemunhas_lista: Json | null
          tipo: string
          updated_at: string | null
          vara: string | null
        }
        Insert: {
          advogado_id?: string | null
          advogado_presente?: boolean | null
          created_at?: string | null
          data_hora: string
          documentos_necessarios?: Json | null
          endereco_completo?: string | null
          forum?: string | null
          id?: string
          juiz_orgao?: string | null
          link_videoconferencia?: string | null
          local?: string | null
          modalidade?: string | null
          observacoes?: string | null
          parte_presente?: boolean | null
          pauta?: string | null
          prazo_automatico_criado?: boolean | null
          processo_id: string
          registrado_em?: string | null
          registrado_por?: string | null
          resultado?: string | null
          resultado_condicoes?: string | null
          resultado_motivo_adiamento?: string | null
          resultado_nova_data?: string | null
          resultado_prazo_pagamento?: string | null
          resultado_prazo_recurso?: string | null
          resultado_resumo?: string | null
          resultado_tipo?: string | null
          resultado_valor?: number | null
          sala?: string | null
          status?: string | null
          testemunhas?: string | null
          testemunhas_lista?: Json | null
          tipo: string
          updated_at?: string | null
          vara?: string | null
        }
        Update: {
          advogado_id?: string | null
          advogado_presente?: boolean | null
          created_at?: string | null
          data_hora?: string
          documentos_necessarios?: Json | null
          endereco_completo?: string | null
          forum?: string | null
          id?: string
          juiz_orgao?: string | null
          link_videoconferencia?: string | null
          local?: string | null
          modalidade?: string | null
          observacoes?: string | null
          parte_presente?: boolean | null
          pauta?: string | null
          prazo_automatico_criado?: boolean | null
          processo_id?: string
          registrado_em?: string | null
          registrado_por?: string | null
          resultado?: string | null
          resultado_condicoes?: string | null
          resultado_motivo_adiamento?: string | null
          resultado_nova_data?: string | null
          resultado_prazo_pagamento?: string | null
          resultado_prazo_recurso?: string | null
          resultado_resumo?: string | null
          resultado_tipo?: string | null
          resultado_valor?: number | null
          sala?: string | null
          status?: string | null
          testemunhas?: string | null
          testemunhas_lista?: Json | null
          tipo?: string
          updated_at?: string | null
          vara?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "processos_audiencias_advogado_id_fkey"
            columns: ["advogado_id"]
            isOneToOne: false
            referencedRelation: "advogados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processos_audiencias_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
        ]
      }
      processos_custas: {
        Row: {
          comprovante_url: string | null
          created_at: string | null
          data_pagamento: string | null
          data_vencimento: string | null
          descricao: string
          id: string
          pago_por: string | null
          processo_id: string
          status: string | null
          tipo: string
          valor: number
        }
        Insert: {
          comprovante_url?: string | null
          created_at?: string | null
          data_pagamento?: string | null
          data_vencimento?: string | null
          descricao: string
          id?: string
          pago_por?: string | null
          processo_id: string
          status?: string | null
          tipo: string
          valor: number
        }
        Update: {
          comprovante_url?: string | null
          created_at?: string | null
          data_pagamento?: string | null
          data_vencimento?: string | null
          descricao?: string
          id?: string
          pago_por?: string | null
          processo_id?: string
          status?: string | null
          tipo?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "processos_custas_pago_por_fkey"
            columns: ["pago_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processos_custas_pago_por_fkey"
            columns: ["pago_por"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "processos_custas_pago_por_fkey"
            columns: ["pago_por"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "processos_custas_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
        ]
      }
      processos_documentos: {
        Row: {
          andamento_id: string | null
          arquivo_tamanho: number | null
          arquivo_url: string | null
          created_at: string | null
          descricao: string | null
          enviado_por: string | null
          id: string
          nome: string
          processo_id: string
          tipo: string
        }
        Insert: {
          andamento_id?: string | null
          arquivo_tamanho?: number | null
          arquivo_url?: string | null
          created_at?: string | null
          descricao?: string | null
          enviado_por?: string | null
          id?: string
          nome: string
          processo_id: string
          tipo: string
        }
        Update: {
          andamento_id?: string | null
          arquivo_tamanho?: number | null
          arquivo_url?: string | null
          created_at?: string | null
          descricao?: string | null
          enviado_por?: string | null
          id?: string
          nome?: string
          processo_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "processos_documentos_andamento_id_fkey"
            columns: ["andamento_id"]
            isOneToOne: false
            referencedRelation: "processos_andamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processos_documentos_enviado_por_fkey"
            columns: ["enviado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processos_documentos_enviado_por_fkey"
            columns: ["enviado_por"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "processos_documentos_enviado_por_fkey"
            columns: ["enviado_por"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "processos_documentos_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
        ]
      }
      processos_prazos: {
        Row: {
          alerta_enviado_1d: boolean | null
          alerta_enviado_3d: boolean | null
          alerta_enviado_7d: boolean | null
          alerta_enviado_hoje: boolean | null
          andamento_id: string | null
          cancelamento_motivo: string | null
          created_at: string | null
          cumprido_em: string | null
          cumprido_por: string | null
          data_fim: string
          data_inicio: string
          descricao: string
          dias_uteis: boolean | null
          evento_id: string | null
          hora_vencimento: string | null
          id: string
          lembrete_ativo: boolean | null
          lembrete_dias: number[] | null
          observacao_cumprimento: string | null
          prioridade: string | null
          processo_id: string
          prorrogacao_motivo: string | null
          prorrogado_de: string | null
          responsavel_id: string | null
          status: string | null
          tipo: string | null
          updated_at: string | null
        }
        Insert: {
          alerta_enviado_1d?: boolean | null
          alerta_enviado_3d?: boolean | null
          alerta_enviado_7d?: boolean | null
          alerta_enviado_hoje?: boolean | null
          andamento_id?: string | null
          cancelamento_motivo?: string | null
          created_at?: string | null
          cumprido_em?: string | null
          cumprido_por?: string | null
          data_fim: string
          data_inicio: string
          descricao: string
          dias_uteis?: boolean | null
          evento_id?: string | null
          hora_vencimento?: string | null
          id?: string
          lembrete_ativo?: boolean | null
          lembrete_dias?: number[] | null
          observacao_cumprimento?: string | null
          prioridade?: string | null
          processo_id: string
          prorrogacao_motivo?: string | null
          prorrogado_de?: string | null
          responsavel_id?: string | null
          status?: string | null
          tipo?: string | null
          updated_at?: string | null
        }
        Update: {
          alerta_enviado_1d?: boolean | null
          alerta_enviado_3d?: boolean | null
          alerta_enviado_7d?: boolean | null
          alerta_enviado_hoje?: boolean | null
          andamento_id?: string | null
          cancelamento_motivo?: string | null
          created_at?: string | null
          cumprido_em?: string | null
          cumprido_por?: string | null
          data_fim?: string
          data_inicio?: string
          descricao?: string
          dias_uteis?: boolean | null
          evento_id?: string | null
          hora_vencimento?: string | null
          id?: string
          lembrete_ativo?: boolean | null
          lembrete_dias?: number[] | null
          observacao_cumprimento?: string | null
          prioridade?: string | null
          processo_id?: string
          prorrogacao_motivo?: string | null
          prorrogado_de?: string | null
          responsavel_id?: string | null
          status?: string | null
          tipo?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "processos_prazos_andamento_id_fkey"
            columns: ["andamento_id"]
            isOneToOne: false
            referencedRelation: "processos_andamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processos_prazos_cumprido_por_fkey"
            columns: ["cumprido_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processos_prazos_cumprido_por_fkey"
            columns: ["cumprido_por"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "processos_prazos_cumprido_por_fkey"
            columns: ["cumprido_por"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "processos_prazos_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "sinistros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processos_prazos_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processos_prazos_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processos_prazos_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "processos_prazos_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
        ]
      }
      product_lines: {
        Row: {
          blocked_categories: string[] | null
          color: string | null
          created_at: string | null
          display_order: number | null
          gradient_class: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          requires_recent_year: boolean
          slug: string
          sort_priority: number
          supports_app: boolean
          updated_at: string | null
          vehicle_type: string | null
        }
        Insert: {
          blocked_categories?: string[] | null
          color?: string | null
          created_at?: string | null
          display_order?: number | null
          gradient_class?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          requires_recent_year?: boolean
          slug: string
          sort_priority?: number
          supports_app?: boolean
          updated_at?: string | null
          vehicle_type?: string | null
        }
        Update: {
          blocked_categories?: string[] | null
          color?: string | null
          created_at?: string | null
          display_order?: number | null
          gradient_class?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          requires_recent_year?: boolean
          slug?: string
          sort_priority?: number
          supports_app?: boolean
          updated_at?: string | null
          vehicle_type?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          ativo: boolean
          avatar_url: string | null
          bloqueado: boolean | null
          capacidade_diaria: number | null
          categoria_profissional: string | null
          codigo_sga_voluntario: string | null
          cpf: string | null
          created_at: string
          created_by: string | null
          data_ultimo_acesso: string | null
          email: string
          full_name: string | null
          id: string
          motivo_bloqueio: string | null
          nome: string
          notif_documentos_pendentes: boolean | null
          notif_novos_leads: boolean | null
          notif_resumo_diario: boolean | null
          primeiro_acesso: boolean
          regioes_atendimento: string[] | null
          telefone: string | null
          tipo: Database["public"]["Enums"]["tipo_usuario"]
          updated_at: string
          updated_by: string | null
          user_id: string
          whatsapp: string | null
        }
        Insert: {
          ativo?: boolean
          avatar_url?: string | null
          bloqueado?: boolean | null
          capacidade_diaria?: number | null
          categoria_profissional?: string | null
          codigo_sga_voluntario?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          data_ultimo_acesso?: string | null
          email: string
          full_name?: string | null
          id?: string
          motivo_bloqueio?: string | null
          nome: string
          notif_documentos_pendentes?: boolean | null
          notif_novos_leads?: boolean | null
          notif_resumo_diario?: boolean | null
          primeiro_acesso?: boolean
          regioes_atendimento?: string[] | null
          telefone?: string | null
          tipo?: Database["public"]["Enums"]["tipo_usuario"]
          updated_at?: string
          updated_by?: string | null
          user_id: string
          whatsapp?: string | null
        }
        Update: {
          ativo?: boolean
          avatar_url?: string | null
          bloqueado?: boolean | null
          capacidade_diaria?: number | null
          categoria_profissional?: string | null
          codigo_sga_voluntario?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          data_ultimo_acesso?: string | null
          email?: string
          full_name?: string | null
          id?: string
          motivo_bloqueio?: string | null
          nome?: string
          notif_documentos_pendentes?: boolean | null
          notif_novos_leads?: boolean | null
          notif_resumo_diario?: boolean | null
          primeiro_acesso?: boolean
          regioes_atendimento?: string[] | null
          telefone?: string | null
          tipo?: Database["public"]["Enums"]["tipo_usuario"]
          updated_at?: string
          updated_by?: string | null
          user_id?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "profiles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "profiles_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "profiles_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
        ]
      }
      programa_indicacao: {
        Row: {
          ativo: boolean | null
          condicao_pagamento: string | null
          created_at: string | null
          data_fim: string | null
          data_inicio: string | null
          descricao: string | null
          id: string
          limite_indicacoes_mes: number | null
          nome: string
          prazo_validade_dias: number | null
          tipo_recompensa: string | null
          updated_at: string | null
          valor_indicado: number | null
          valor_indicador: number
        }
        Insert: {
          ativo?: boolean | null
          condicao_pagamento?: string | null
          created_at?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          descricao?: string | null
          id?: string
          limite_indicacoes_mes?: number | null
          nome: string
          prazo_validade_dias?: number | null
          tipo_recompensa?: string | null
          updated_at?: string | null
          valor_indicado?: number | null
          valor_indicador: number
        }
        Update: {
          ativo?: boolean | null
          condicao_pagamento?: string | null
          created_at?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          descricao?: string | null
          id?: string
          limite_indicacoes_mes?: number | null
          nome?: string
          prazo_validade_dias?: number | null
          tipo_recompensa?: string | null
          updated_at?: string | null
          valor_indicado?: number | null
          valor_indicador?: number
        }
        Relationships: []
      }
      push_subscriptions_profissionais: {
        Row: {
          auth: string
          created_at: string | null
          device_type: string | null
          endpoint: string
          id: string
          is_active: boolean | null
          p256dh: string
          profissional_id: string
          updated_at: string | null
          user_agent: string | null
        }
        Insert: {
          auth: string
          created_at?: string | null
          device_type?: string | null
          endpoint: string
          id?: string
          is_active?: boolean | null
          p256dh: string
          profissional_id: string
          updated_at?: string | null
          user_agent?: string | null
        }
        Update: {
          auth?: string
          created_at?: string | null
          device_type?: string | null
          endpoint?: string
          id?: string
          is_active?: boolean | null
          p256dh?: string
          profissional_id?: string
          updated_at?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_profissionais_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_subscriptions_profissionais_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "push_subscriptions_profissionais_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
        ]
      }
      rastreador_alertas: {
        Row: {
          created_at: string | null
          dados: Json | null
          dados_extras: Json | null
          id: string
          mensagem: string
          observacao_tratamento: string | null
          rastreador_id: string | null
          severidade: string
          status: string | null
          tipo: string
          titulo: string | null
          tratado_em: string | null
          tratado_por: string | null
          updated_at: string | null
          veiculo_id: string | null
        }
        Insert: {
          created_at?: string | null
          dados?: Json | null
          dados_extras?: Json | null
          id?: string
          mensagem: string
          observacao_tratamento?: string | null
          rastreador_id?: string | null
          severidade: string
          status?: string | null
          tipo: string
          titulo?: string | null
          tratado_em?: string | null
          tratado_por?: string | null
          updated_at?: string | null
          veiculo_id?: string | null
        }
        Update: {
          created_at?: string | null
          dados?: Json | null
          dados_extras?: Json | null
          id?: string
          mensagem?: string
          observacao_tratamento?: string | null
          rastreador_id?: string | null
          severidade?: string
          status?: string | null
          tipo?: string
          titulo?: string | null
          tratado_em?: string | null
          tratado_por?: string | null
          updated_at?: string | null
          veiculo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rastreador_alertas_rastreador_id_fkey"
            columns: ["rastreador_id"]
            isOneToOne: false
            referencedRelation: "rastreadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rastreador_alertas_rastreador_id_fkey"
            columns: ["rastreador_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["rastreador_id"]
          },
          {
            foreignKeyName: "rastreador_alertas_tratado_por_fkey"
            columns: ["tratado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rastreador_alertas_tratado_por_fkey"
            columns: ["tratado_por"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "rastreador_alertas_tratado_por_fkey"
            columns: ["tratado_por"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "rastreador_alertas_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rastreador_alertas_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["veiculo_id"]
          },
          {
            foreignKeyName: "rastreador_alertas_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["veiculo_id"]
          },
          {
            foreignKeyName: "rastreador_alertas_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["veiculo_id"]
          },
          {
            foreignKeyName: "rastreador_alertas_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "vw_veiculos_com_cotas"
            referencedColumns: ["id"]
          },
        ]
      }
      rastreador_manutencao_interna: {
        Row: {
          acao_tomada: string | null
          created_at: string
          created_by: string | null
          data_encaminhamento: string | null
          data_retorno: string | null
          defeito_identificado: string | null
          diagnostico_inicial: string | null
          encaminhado_para: string | null
          etapa: string
          id: string
          laudo_externo: string | null
          numero_protocolo_externo: string | null
          rastreador_id: string
          recuperavel: boolean | null
          resolvido_em: string | null
          resolvido_por: string | null
          servico_origem_id: string | null
          updated_at: string
        }
        Insert: {
          acao_tomada?: string | null
          created_at?: string
          created_by?: string | null
          data_encaminhamento?: string | null
          data_retorno?: string | null
          defeito_identificado?: string | null
          diagnostico_inicial?: string | null
          encaminhado_para?: string | null
          etapa?: string
          id?: string
          laudo_externo?: string | null
          numero_protocolo_externo?: string | null
          rastreador_id: string
          recuperavel?: boolean | null
          resolvido_em?: string | null
          resolvido_por?: string | null
          servico_origem_id?: string | null
          updated_at?: string
        }
        Update: {
          acao_tomada?: string | null
          created_at?: string
          created_by?: string | null
          data_encaminhamento?: string | null
          data_retorno?: string | null
          defeito_identificado?: string | null
          diagnostico_inicial?: string | null
          encaminhado_para?: string | null
          etapa?: string
          id?: string
          laudo_externo?: string | null
          numero_protocolo_externo?: string | null
          rastreador_id?: string
          recuperavel?: boolean | null
          resolvido_em?: string | null
          resolvido_por?: string | null
          servico_origem_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rastreador_manutencao_interna_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rastreador_manutencao_interna_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "rastreador_manutencao_interna_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "rastreador_manutencao_interna_rastreador_id_fkey"
            columns: ["rastreador_id"]
            isOneToOne: false
            referencedRelation: "rastreadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rastreador_manutencao_interna_rastreador_id_fkey"
            columns: ["rastreador_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["rastreador_id"]
          },
          {
            foreignKeyName: "rastreador_manutencao_interna_resolvido_por_fkey"
            columns: ["resolvido_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rastreador_manutencao_interna_resolvido_por_fkey"
            columns: ["resolvido_por"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "rastreador_manutencao_interna_resolvido_por_fkey"
            columns: ["resolvido_por"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "rastreador_manutencao_interna_servico_origem_id_fkey"
            columns: ["servico_origem_id"]
            isOneToOne: false
            referencedRelation: "servicos"
            referencedColumns: ["id"]
          },
        ]
      }
      rastreador_posicoes: {
        Row: {
          altitude: number | null
          bateria_nivel: number | null
          created_at: string | null
          data_posicao: string
          direcao: number | null
          endereco: string | null
          id: string
          ignicao: boolean | null
          latitude: number
          longitude: number
          odometro: number | null
          rastreador_id: string
          sinal_gsm: number | null
          velocidade: number | null
        }
        Insert: {
          altitude?: number | null
          bateria_nivel?: number | null
          created_at?: string | null
          data_posicao: string
          direcao?: number | null
          endereco?: string | null
          id?: string
          ignicao?: boolean | null
          latitude: number
          longitude: number
          odometro?: number | null
          rastreador_id: string
          sinal_gsm?: number | null
          velocidade?: number | null
        }
        Update: {
          altitude?: number | null
          bateria_nivel?: number | null
          created_at?: string | null
          data_posicao?: string
          direcao?: number | null
          endereco?: string | null
          id?: string
          ignicao?: boolean | null
          latitude?: number
          longitude?: number
          odometro?: number | null
          rastreador_id?: string
          sinal_gsm?: number | null
          velocidade?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rastreador_posicoes_rastreador_id_fkey"
            columns: ["rastreador_id"]
            isOneToOne: false
            referencedRelation: "rastreadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rastreador_posicoes_rastreador_id_fkey"
            columns: ["rastreador_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["rastreador_id"]
          },
        ]
      }
      rastreador_preferencias: {
        Row: {
          alerta_cerca_ativo: boolean | null
          alerta_ignicao_ativo: boolean | null
          alerta_velocidade_ativo: boolean | null
          associado_id: string
          compartilhar_localizacao: boolean | null
          created_at: string | null
          dados_anonimos: boolean | null
          horario_alerta: string | null
          horario_fim: string | null
          horario_inicio: string | null
          id: string
          novidades_promocoes: boolean | null
          updated_at: string | null
          velocidade_limite: number | null
        }
        Insert: {
          alerta_cerca_ativo?: boolean | null
          alerta_ignicao_ativo?: boolean | null
          alerta_velocidade_ativo?: boolean | null
          associado_id: string
          compartilhar_localizacao?: boolean | null
          created_at?: string | null
          dados_anonimos?: boolean | null
          horario_alerta?: string | null
          horario_fim?: string | null
          horario_inicio?: string | null
          id?: string
          novidades_promocoes?: boolean | null
          updated_at?: string | null
          velocidade_limite?: number | null
        }
        Update: {
          alerta_cerca_ativo?: boolean | null
          alerta_ignicao_ativo?: boolean | null
          alerta_velocidade_ativo?: boolean | null
          associado_id?: string
          compartilhar_localizacao?: boolean | null
          created_at?: string | null
          dados_anonimos?: boolean | null
          horario_alerta?: string | null
          horario_fim?: string | null
          horario_inicio?: string | null
          id?: string
          novidades_promocoes?: boolean | null
          updated_at?: string | null
          velocidade_limite?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rastreador_preferencias_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: true
            referencedRelation: "associados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rastreador_preferencias_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: true
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "rastreador_preferencias_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: true
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "rastreador_preferencias_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: true
            referencedRelation: "view_associado_financeiro"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "rastreador_preferencias_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: true
            referencedRelation: "view_associados_publico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rastreador_preferencias_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: true
            referencedRelation: "view_inadimplentes"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "rastreador_preferencias_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: true
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["associado_id"]
          },
        ]
      }
      rastreadores: {
        Row: {
          acionamento_ativo_id: string | null
          associado_email: string | null
          associado_id: string | null
          bloqueado: boolean | null
          chip_iccid: string | null
          chip_number: string | null
          codigo: string
          config_plataforma: Json | null
          created_at: string
          dados_extras: Json | null
          descricao_instalacao: string | null
          foto_local_instalacao_url: string | null
          id: string
          id_plataforma: string | null
          imei: string | null
          local_instalacao: string | null
          modo_ativado_em: string | null
          modo_ativado_por: string | null
          modo_rastreamento: string | null
          numero_serie: string | null
          plataforma: string
          plataforma_device_id: string | null
          plataforma_user_id: string | null
          plataforma_veiculo_id: string | null
          portador_id: string | null
          softruck_chip_id: string | null
          softruck_integration_status: string | null
          softruck_last_attempt_at: string | null
          softruck_payload_sent: Json | null
          softruck_response_raw: Json | null
          status: Database["public"]["Enums"]["status_rastreador"]
          ultima_comunicacao: string | null
          ultima_ignicao: boolean | null
          ultima_posicao_lat: number | null
          ultima_posicao_lng: number | null
          ultima_velocidade: number | null
          updated_at: string
          veiculo_id: string | null
        }
        Insert: {
          acionamento_ativo_id?: string | null
          associado_email?: string | null
          associado_id?: string | null
          bloqueado?: boolean | null
          chip_iccid?: string | null
          chip_number?: string | null
          codigo: string
          config_plataforma?: Json | null
          created_at?: string
          dados_extras?: Json | null
          descricao_instalacao?: string | null
          foto_local_instalacao_url?: string | null
          id?: string
          id_plataforma?: string | null
          imei?: string | null
          local_instalacao?: string | null
          modo_ativado_em?: string | null
          modo_ativado_por?: string | null
          modo_rastreamento?: string | null
          numero_serie?: string | null
          plataforma?: string
          plataforma_device_id?: string | null
          plataforma_user_id?: string | null
          plataforma_veiculo_id?: string | null
          portador_id?: string | null
          softruck_chip_id?: string | null
          softruck_integration_status?: string | null
          softruck_last_attempt_at?: string | null
          softruck_payload_sent?: Json | null
          softruck_response_raw?: Json | null
          status?: Database["public"]["Enums"]["status_rastreador"]
          ultima_comunicacao?: string | null
          ultima_ignicao?: boolean | null
          ultima_posicao_lat?: number | null
          ultima_posicao_lng?: number | null
          ultima_velocidade?: number | null
          updated_at?: string
          veiculo_id?: string | null
        }
        Update: {
          acionamento_ativo_id?: string | null
          associado_email?: string | null
          associado_id?: string | null
          bloqueado?: boolean | null
          chip_iccid?: string | null
          chip_number?: string | null
          codigo?: string
          config_plataforma?: Json | null
          created_at?: string
          dados_extras?: Json | null
          descricao_instalacao?: string | null
          foto_local_instalacao_url?: string | null
          id?: string
          id_plataforma?: string | null
          imei?: string | null
          local_instalacao?: string | null
          modo_ativado_em?: string | null
          modo_ativado_por?: string | null
          modo_rastreamento?: string | null
          numero_serie?: string | null
          plataforma?: string
          plataforma_device_id?: string | null
          plataforma_user_id?: string | null
          plataforma_veiculo_id?: string | null
          portador_id?: string | null
          softruck_chip_id?: string | null
          softruck_integration_status?: string | null
          softruck_last_attempt_at?: string | null
          softruck_payload_sent?: Json | null
          softruck_response_raw?: Json | null
          status?: Database["public"]["Enums"]["status_rastreador"]
          ultima_comunicacao?: string | null
          ultima_ignicao?: boolean | null
          ultima_posicao_lat?: number | null
          ultima_posicao_lng?: number | null
          ultima_velocidade?: number | null
          updated_at?: string
          veiculo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rastreadores_acionamento_ativo_id_fkey"
            columns: ["acionamento_ativo_id"]
            isOneToOne: false
            referencedRelation: "acionamentos_roubo_furto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rastreadores_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "associados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rastreadores_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "rastreadores_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "rastreadores_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associado_financeiro"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "rastreadores_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associados_publico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rastreadores_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_inadimplentes"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "rastreadores_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "rastreadores_modo_ativado_por_fkey"
            columns: ["modo_ativado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rastreadores_modo_ativado_por_fkey"
            columns: ["modo_ativado_por"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "rastreadores_modo_ativado_por_fkey"
            columns: ["modo_ativado_por"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "rastreadores_portador_id_fkey"
            columns: ["portador_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rastreadores_portador_id_fkey"
            columns: ["portador_id"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "rastreadores_portador_id_fkey"
            columns: ["portador_id"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "rastreadores_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rastreadores_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["veiculo_id"]
          },
          {
            foreignKeyName: "rastreadores_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["veiculo_id"]
          },
          {
            foreignKeyName: "rastreadores_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["veiculo_id"]
          },
          {
            foreignKeyName: "rastreadores_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "vw_veiculos_com_cotas"
            referencedColumns: ["id"]
          },
        ]
      }
      rastreadores_comandos: {
        Row: {
          api_request: Json | null
          api_response: Json | null
          autorizado_em: string | null
          autorizado_por: string | null
          autorizado_por_nome: string | null
          comando_enviado: string | null
          confirmado_em: string | null
          created_at: string | null
          erro_mensagem: string | null
          id: string
          metodo_envio: string | null
          motivo: string
          observacoes: string | null
          origem: string
          origem_id: string | null
          plataforma: string
          rastreador_id: string | null
          solicitado_em: string | null
          solicitado_por: string | null
          solicitado_por_nome: string | null
          status: string
          telefone_destino: string | null
          tipo_comando: string
          updated_at: string | null
          veiculo_id: string | null
        }
        Insert: {
          api_request?: Json | null
          api_response?: Json | null
          autorizado_em?: string | null
          autorizado_por?: string | null
          autorizado_por_nome?: string | null
          comando_enviado?: string | null
          confirmado_em?: string | null
          created_at?: string | null
          erro_mensagem?: string | null
          id?: string
          metodo_envio?: string | null
          motivo: string
          observacoes?: string | null
          origem?: string
          origem_id?: string | null
          plataforma: string
          rastreador_id?: string | null
          solicitado_em?: string | null
          solicitado_por?: string | null
          solicitado_por_nome?: string | null
          status?: string
          telefone_destino?: string | null
          tipo_comando: string
          updated_at?: string | null
          veiculo_id?: string | null
        }
        Update: {
          api_request?: Json | null
          api_response?: Json | null
          autorizado_em?: string | null
          autorizado_por?: string | null
          autorizado_por_nome?: string | null
          comando_enviado?: string | null
          confirmado_em?: string | null
          created_at?: string | null
          erro_mensagem?: string | null
          id?: string
          metodo_envio?: string | null
          motivo?: string
          observacoes?: string | null
          origem?: string
          origem_id?: string | null
          plataforma?: string
          rastreador_id?: string | null
          solicitado_em?: string | null
          solicitado_por?: string | null
          solicitado_por_nome?: string | null
          status?: string
          telefone_destino?: string | null
          tipo_comando?: string
          updated_at?: string | null
          veiculo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rastreadores_comandos_autorizado_por_fkey"
            columns: ["autorizado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rastreadores_comandos_autorizado_por_fkey"
            columns: ["autorizado_por"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "rastreadores_comandos_autorizado_por_fkey"
            columns: ["autorizado_por"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "rastreadores_comandos_rastreador_id_fkey"
            columns: ["rastreador_id"]
            isOneToOne: false
            referencedRelation: "rastreadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rastreadores_comandos_rastreador_id_fkey"
            columns: ["rastreador_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["rastreador_id"]
          },
          {
            foreignKeyName: "rastreadores_comandos_solicitado_por_fkey"
            columns: ["solicitado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rastreadores_comandos_solicitado_por_fkey"
            columns: ["solicitado_por"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "rastreadores_comandos_solicitado_por_fkey"
            columns: ["solicitado_por"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "rastreadores_comandos_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rastreadores_comandos_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["veiculo_id"]
          },
          {
            foreignKeyName: "rastreadores_comandos_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["veiculo_id"]
          },
          {
            foreignKeyName: "rastreadores_comandos_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["veiculo_id"]
          },
          {
            foreignKeyName: "rastreadores_comandos_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "vw_veiculos_com_cotas"
            referencedColumns: ["id"]
          },
        ]
      }
      rastreadores_config_plataformas: {
        Row: {
          ambiente_atual: string | null
          api_url_producao: string
          api_url_sandbox: string
          ativa: boolean | null
          auth_type: string
          config: Json | null
          created_at: string | null
          descricao: string | null
          icone: string | null
          id: string
          nome_exibicao: string
          ordem: number | null
          plataforma: string
          suporta_acionamento_roubo: boolean | null
          suporta_bloqueio: boolean | null
          suporta_historico_trajeto: boolean | null
          suporta_posicao_tempo_real: boolean | null
          suporta_redefinir_senha: boolean | null
          suporta_webhooks: boolean | null
          updated_at: string | null
        }
        Insert: {
          ambiente_atual?: string | null
          api_url_producao: string
          api_url_sandbox: string
          ativa?: boolean | null
          auth_type: string
          config?: Json | null
          created_at?: string | null
          descricao?: string | null
          icone?: string | null
          id?: string
          nome_exibicao: string
          ordem?: number | null
          plataforma: string
          suporta_acionamento_roubo?: boolean | null
          suporta_bloqueio?: boolean | null
          suporta_historico_trajeto?: boolean | null
          suporta_posicao_tempo_real?: boolean | null
          suporta_redefinir_senha?: boolean | null
          suporta_webhooks?: boolean | null
          updated_at?: string | null
        }
        Update: {
          ambiente_atual?: string | null
          api_url_producao?: string
          api_url_sandbox?: string
          ativa?: boolean | null
          auth_type?: string
          config?: Json | null
          created_at?: string | null
          descricao?: string | null
          icone?: string | null
          id?: string
          nome_exibicao?: string
          ordem?: number | null
          plataforma?: string
          suporta_acionamento_roubo?: boolean | null
          suporta_bloqueio?: boolean | null
          suporta_historico_trajeto?: boolean | null
          suporta_posicao_tempo_real?: boolean | null
          suporta_redefinir_senha?: boolean | null
          suporta_webhooks?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      rastreadores_credenciais: {
        Row: {
          bearer_token: string | null
          configurado: boolean | null
          created_at: string | null
          id: string
          password_hash: string | null
          plataforma_id: string
          public_key: string | null
          testado_em: string | null
          teste_mensagem: string | null
          teste_sucesso: boolean | null
          updated_at: string | null
          username: string | null
        }
        Insert: {
          bearer_token?: string | null
          configurado?: boolean | null
          created_at?: string | null
          id?: string
          password_hash?: string | null
          plataforma_id: string
          public_key?: string | null
          testado_em?: string | null
          teste_mensagem?: string | null
          teste_sucesso?: boolean | null
          updated_at?: string | null
          username?: string | null
        }
        Update: {
          bearer_token?: string | null
          configurado?: boolean | null
          created_at?: string | null
          id?: string
          password_hash?: string | null
          plataforma_id?: string
          public_key?: string | null
          testado_em?: string | null
          teste_mensagem?: string | null
          teste_sucesso?: boolean | null
          updated_at?: string | null
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rastreadores_credenciais_plataforma_id_fkey"
            columns: ["plataforma_id"]
            isOneToOne: true
            referencedRelation: "rastreadores_config_plataformas"
            referencedColumns: ["id"]
          },
        ]
      }
      rastreadores_logs: {
        Row: {
          created_at: string | null
          erro_mensagem: string | null
          id: string
          operacao: string
          plataforma: string
          rastreador_id: string | null
          request: Json | null
          response: Json | null
          status: string | null
          tempo_resposta_ms: number | null
        }
        Insert: {
          created_at?: string | null
          erro_mensagem?: string | null
          id?: string
          operacao: string
          plataforma: string
          rastreador_id?: string | null
          request?: Json | null
          response?: Json | null
          status?: string | null
          tempo_resposta_ms?: number | null
        }
        Update: {
          created_at?: string | null
          erro_mensagem?: string | null
          id?: string
          operacao?: string
          plataforma?: string
          rastreador_id?: string | null
          request?: Json | null
          response?: Json | null
          status?: string | null
          tempo_resposta_ms?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rastreadores_logs_rastreador_id_fkey"
            columns: ["rastreador_id"]
            isOneToOne: false
            referencedRelation: "rastreadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rastreadores_logs_rastreador_id_fkey"
            columns: ["rastreador_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["rastreador_id"]
          },
        ]
      }
      rastreadores_tokens_cache: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          plataforma: string
          refresh_token: string | null
          token: string
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          id?: string
          plataforma: string
          refresh_token?: string | null
          token: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          plataforma?: string
          refresh_token?: string | null
          token?: string
        }
        Relationships: []
      }
      rateios: {
        Row: {
          ano: number
          aplicado_em: string | null
          aprovado_em: string | null
          aprovado_por: string | null
          codigo: string | null
          created_at: string | null
          formula_utilizada: string | null
          id: string
          mes: number
          observacoes: string | null
          percentual_fundo_reserva: number | null
          status: string | null
          total_associados: number | null
          total_cotas: number | null
          total_sinistros: number | null
          updated_at: string | null
          valor_fundo_reserva: number | null
          valor_rateio_por_associado: number | null
          valor_rateio_por_cota: number | null
          valor_total_sinistros: number | null
        }
        Insert: {
          ano: number
          aplicado_em?: string | null
          aprovado_em?: string | null
          aprovado_por?: string | null
          codigo?: string | null
          created_at?: string | null
          formula_utilizada?: string | null
          id?: string
          mes: number
          observacoes?: string | null
          percentual_fundo_reserva?: number | null
          status?: string | null
          total_associados?: number | null
          total_cotas?: number | null
          total_sinistros?: number | null
          updated_at?: string | null
          valor_fundo_reserva?: number | null
          valor_rateio_por_associado?: number | null
          valor_rateio_por_cota?: number | null
          valor_total_sinistros?: number | null
        }
        Update: {
          ano?: number
          aplicado_em?: string | null
          aprovado_em?: string | null
          aprovado_por?: string | null
          codigo?: string | null
          created_at?: string | null
          formula_utilizada?: string | null
          id?: string
          mes?: number
          observacoes?: string | null
          percentual_fundo_reserva?: number | null
          status?: string | null
          total_associados?: number | null
          total_cotas?: number | null
          total_sinistros?: number | null
          updated_at?: string | null
          valor_fundo_reserva?: number | null
          valor_rateio_por_associado?: number | null
          valor_rateio_por_cota?: number | null
          valor_total_sinistros?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rateios_aprovado_por_fkey"
            columns: ["aprovado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rateios_aprovado_por_fkey"
            columns: ["aprovado_por"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "rateios_aprovado_por_fkey"
            columns: ["aprovado_por"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
        ]
      }
      rateios_detalhes: {
        Row: {
          created_at: string | null
          id: string
          plano_id: string
          rateio_id: string
          total_associados: number | null
          total_sinistros: number | null
          valor_rateio: number | null
          valor_sinistros: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          plano_id: string
          rateio_id: string
          total_associados?: number | null
          total_sinistros?: number | null
          valor_rateio?: number | null
          valor_sinistros?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          plano_id?: string
          rateio_id?: string
          total_associados?: number | null
          total_sinistros?: number | null
          valor_rateio?: number | null
          valor_sinistros?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rateios_detalhes_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "planos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rateios_detalhes_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "vw_plans_compat"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rateios_detalhes_rateio_id_fkey"
            columns: ["rateio_id"]
            isOneToOne: false
            referencedRelation: "rateios"
            referencedColumns: ["id"]
          },
        ]
      }
      rateios_detalhes_faixas: {
        Row: {
          ajuste_percentual: number | null
          contratos_na_faixa: number | null
          created_at: string | null
          faixa_id: string
          fipe_ate: number
          fipe_de: number
          id: string
          quantidade_cotas: number
          rateio_id: string
          total_cotas_faixa: number | null
          valor_base_cota: number
          valor_final_cota: number
        }
        Insert: {
          ajuste_percentual?: number | null
          contratos_na_faixa?: number | null
          created_at?: string | null
          faixa_id: string
          fipe_ate: number
          fipe_de: number
          id?: string
          quantidade_cotas: number
          rateio_id: string
          total_cotas_faixa?: number | null
          valor_base_cota: number
          valor_final_cota: number
        }
        Update: {
          ajuste_percentual?: number | null
          contratos_na_faixa?: number | null
          created_at?: string | null
          faixa_id?: string
          fipe_ate?: number
          fipe_de?: number
          id?: string
          quantidade_cotas?: number
          rateio_id?: string
          total_cotas_faixa?: number | null
          valor_base_cota?: number
          valor_final_cota?: number
        }
        Relationships: [
          {
            foreignKeyName: "rateios_detalhes_faixas_faixa_id_fkey"
            columns: ["faixa_id"]
            isOneToOne: false
            referencedRelation: "faixas_cotas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rateios_detalhes_faixas_rateio_id_fkey"
            columns: ["rateio_id"]
            isOneToOne: false
            referencedRelation: "rateios"
            referencedColumns: ["id"]
          },
        ]
      }
      redes_sociais_contas: {
        Row: {
          access_token: string | null
          created_at: string | null
          id: string
          nome_conta: string | null
          pagina_id: string | null
          plataforma: string
          refresh_token: string | null
          seguidores: number | null
          status: string | null
          token_expira_em: string | null
          ultima_sincronizacao: string | null
          updated_at: string | null
          username: string | null
        }
        Insert: {
          access_token?: string | null
          created_at?: string | null
          id?: string
          nome_conta?: string | null
          pagina_id?: string | null
          plataforma: string
          refresh_token?: string | null
          seguidores?: number | null
          status?: string | null
          token_expira_em?: string | null
          ultima_sincronizacao?: string | null
          updated_at?: string | null
          username?: string | null
        }
        Update: {
          access_token?: string | null
          created_at?: string | null
          id?: string
          nome_conta?: string | null
          pagina_id?: string | null
          plataforma?: string
          refresh_token?: string | null
          seguidores?: number | null
          status?: string | null
          token_expira_em?: string | null
          ultima_sincronizacao?: string | null
          updated_at?: string | null
          username?: string | null
        }
        Relationships: []
      }
      redes_sociais_metricas: {
        Row: {
          alcance: number | null
          comentarios: number | null
          compartilhamentos: number | null
          conta_id: string | null
          created_at: string | null
          curtidas: number | null
          engajamento: number | null
          id: string
          impressoes: number | null
          novos_seguidores: number | null
          periodo: string
          publicacoes: number | null
        }
        Insert: {
          alcance?: number | null
          comentarios?: number | null
          compartilhamentos?: number | null
          conta_id?: string | null
          created_at?: string | null
          curtidas?: number | null
          engajamento?: number | null
          id?: string
          impressoes?: number | null
          novos_seguidores?: number | null
          periodo: string
          publicacoes?: number | null
        }
        Update: {
          alcance?: number | null
          comentarios?: number | null
          compartilhamentos?: number | null
          conta_id?: string | null
          created_at?: string | null
          curtidas?: number | null
          engajamento?: number | null
          id?: string
          impressoes?: number | null
          novos_seguidores?: number | null
          periodo?: string
          publicacoes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "redes_sociais_metricas_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "redes_sociais_contas"
            referencedColumns: ["id"]
          },
        ]
      }
      regioes: {
        Row: {
          ativa: boolean | null
          cidades: string[] | null
          codigo: string
          created_at: string | null
          descricao: string | null
          exigir_titularidade_comprovante: boolean
          id: string
          multiplicador_preco: number | null
          nome: string
          ordem: number | null
          updated_at: string | null
        }
        Insert: {
          ativa?: boolean | null
          cidades?: string[] | null
          codigo: string
          created_at?: string | null
          descricao?: string | null
          exigir_titularidade_comprovante?: boolean
          id?: string
          multiplicador_preco?: number | null
          nome: string
          ordem?: number | null
          updated_at?: string | null
        }
        Update: {
          ativa?: boolean | null
          cidades?: string[] | null
          codigo?: string
          created_at?: string | null
          descricao?: string | null
          exigir_titularidade_comprovante?: boolean
          id?: string
          multiplicador_preco?: number | null
          nome?: string
          ordem?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      regras_categorizacao: {
        Row: {
          ativo: boolean | null
          categoria: string
          created_at: string | null
          id: string
          origem_pagamento: string | null
          padrao_texto: string
          prioridade: number | null
          subcategoria: string | null
          tipo_match: string | null
        }
        Insert: {
          ativo?: boolean | null
          categoria: string
          created_at?: string | null
          id?: string
          origem_pagamento?: string | null
          padrao_texto: string
          prioridade?: number | null
          subcategoria?: string | null
          tipo_match?: string | null
        }
        Update: {
          ativo?: boolean | null
          categoria?: string
          created_at?: string | null
          id?: string
          origem_pagamento?: string | null
          padrao_texto?: string
          prioridade?: number | null
          subcategoria?: string | null
          tipo_match?: string | null
        }
        Relationships: []
      }
      regua_execucoes: {
        Row: {
          acao: string
          associado_id: string
          cobranca_id: string
          created_at: string | null
          erro: string | null
          etapa_dias: number
          executado_em: string | null
          id: string
          regua_id: string
          resultado: string | null
          status: string | null
          template: string | null
        }
        Insert: {
          acao: string
          associado_id: string
          cobranca_id: string
          created_at?: string | null
          erro?: string | null
          etapa_dias: number
          executado_em?: string | null
          id?: string
          regua_id: string
          resultado?: string | null
          status?: string | null
          template?: string | null
        }
        Update: {
          acao?: string
          associado_id?: string
          cobranca_id?: string
          created_at?: string | null
          erro?: string | null
          etapa_dias?: number
          executado_em?: string | null
          id?: string
          regua_id?: string
          resultado?: string | null
          status?: string | null
          template?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "regua_execucoes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "associados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "regua_execucoes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "regua_execucoes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "regua_execucoes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associado_financeiro"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "regua_execucoes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associados_publico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "regua_execucoes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_inadimplentes"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "regua_execucoes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "regua_execucoes_cobranca_id_fkey"
            columns: ["cobranca_id"]
            isOneToOne: false
            referencedRelation: "cobrancas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "regua_execucoes_regua_id_fkey"
            columns: ["regua_id"]
            isOneToOne: false
            referencedRelation: "reguas_cobranca"
            referencedColumns: ["id"]
          },
        ]
      }
      reguas_cobranca: {
        Row: {
          ativa: boolean | null
          created_at: string | null
          descricao: string | null
          etapas: Json
          id: string
          nome: string
          updated_at: string | null
        }
        Insert: {
          ativa?: boolean | null
          created_at?: string | null
          descricao?: string | null
          etapas?: Json
          id?: string
          nome: string
          updated_at?: string | null
        }
        Update: {
          ativa?: boolean | null
          created_at?: string | null
          descricao?: string | null
          etapas?: Json
          id?: string
          nome?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      role_module_item_visibility: {
        Row: {
          created_at: string | null
          id: string
          item_id: string
          module_id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string | null
          visible: boolean | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          item_id: string
          module_id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
          visible?: boolean | null
        }
        Update: {
          created_at?: string | null
          id?: string
          item_id?: string
          module_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
          visible?: boolean | null
        }
        Relationships: []
      }
      role_module_visibility: {
        Row: {
          can_edit: boolean | null
          created_at: string | null
          id: string
          module_id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string | null
          visible: boolean
        }
        Insert: {
          can_edit?: boolean | null
          created_at?: string | null
          id?: string
          module_id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
          visible?: boolean
        }
        Update: {
          can_edit?: boolean | null
          created_at?: string | null
          id?: string
          module_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
          visible?: boolean
        }
        Relationships: []
      }
      rota_instaladores: {
        Row: {
          created_at: string | null
          id: string
          instalador_id: string
          rota_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          instalador_id: string
          rota_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          instalador_id?: string
          rota_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rota_instaladores_instalador_id_fkey"
            columns: ["instalador_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rota_instaladores_instalador_id_fkey"
            columns: ["instalador_id"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "rota_instaladores_instalador_id_fkey"
            columns: ["instalador_id"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "rota_instaladores_rota_id_fkey"
            columns: ["rota_id"]
            isOneToOne: false
            referencedRelation: "rotas"
            referencedColumns: ["id"]
          },
        ]
      }
      rotas: {
        Row: {
          cidade: string | null
          codigo: string
          coordenador_id: string | null
          cor: string | null
          created_at: string
          data_rota: string
          id: string
          instalador_id: string | null
          regiao: string | null
          status: Database["public"]["Enums"]["status_rota"]
          tipo: string | null
          total_concluidos: number
          total_servicos: number
          updated_at: string
        }
        Insert: {
          cidade?: string | null
          codigo: string
          coordenador_id?: string | null
          cor?: string | null
          created_at?: string
          data_rota: string
          id?: string
          instalador_id?: string | null
          regiao?: string | null
          status?: Database["public"]["Enums"]["status_rota"]
          tipo?: string | null
          total_concluidos?: number
          total_servicos?: number
          updated_at?: string
        }
        Update: {
          cidade?: string | null
          codigo?: string
          coordenador_id?: string | null
          cor?: string | null
          created_at?: string
          data_rota?: string
          id?: string
          instalador_id?: string | null
          regiao?: string | null
          status?: Database["public"]["Enums"]["status_rota"]
          tipo?: string | null
          total_concluidos?: number
          total_servicos?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rotas_coordenador_id_fkey"
            columns: ["coordenador_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rotas_coordenador_id_fkey"
            columns: ["coordenador_id"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "rotas_coordenador_id_fkey"
            columns: ["coordenador_id"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "rotas_instalador_id_fkey"
            columns: ["instalador_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rotas_instalador_id_fkey"
            columns: ["instalador_id"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "rotas_instalador_id_fkey"
            columns: ["instalador_id"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
        ]
      }
      saldos_contas: {
        Row: {
          ano: number
          conta_id: string
          created_at: string | null
          id: string
          mes: number
          saldo_anterior: number | null
          saldo_atual: number | null
          total_creditos: number | null
          total_debitos: number | null
          updated_at: string | null
        }
        Insert: {
          ano: number
          conta_id: string
          created_at?: string | null
          id?: string
          mes: number
          saldo_anterior?: number | null
          saldo_atual?: number | null
          total_creditos?: number | null
          total_debitos?: number | null
          updated_at?: string | null
        }
        Update: {
          ano?: number
          conta_id?: string
          created_at?: string | null
          id?: string
          mes?: number
          saldo_anterior?: number | null
          saldo_atual?: number | null
          total_creditos?: number | null
          total_debitos?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "saldos_contas_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "plano_contas"
            referencedColumns: ["id"]
          },
        ]
      }
      servico_fotos: {
        Row: {
          arquivo_url: string
          created_at: string
          id: string
          servico_id: string
          tipo: string
        }
        Insert: {
          arquivo_url: string
          created_at?: string
          id?: string
          servico_id: string
          tipo: string
        }
        Update: {
          arquivo_url?: string
          created_at?: string
          id?: string
          servico_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "servico_fotos_servico_id_fkey"
            columns: ["servico_id"]
            isOneToOne: false
            referencedRelation: "servicos"
            referencedColumns: ["id"]
          },
        ]
      }
      servicos: {
        Row: {
          acabamento_recolocado: boolean | null
          analisado_em: string | null
          analisado_por: string | null
          assinatura_autentique_id: string | null
          assinatura_cliente_url: string | null
          assinatura_concluida_em: string | null
          assinatura_devolucao_url: string | null
          assinatura_documento_url: string | null
          assinatura_enviada_em: string | null
          assinatura_status: string | null
          associado_id: string | null
          avarias: string | null
          bairro: string | null
          cancelamento_bloqueado_ate_devolucao: boolean | null
          cep: string | null
          checklist_data: Json | null
          checklist_manutencao: Json | null
          checklist_retirada: Json | null
          chip_cancelado: boolean | null
          chip_presente: boolean | null
          cidade: string | null
          complemento: string | null
          concluida_em: string | null
          confirmacao_whatsapp: string | null
          confirmado_via_whatsapp_em: string | null
          contato_realizado_em: string | null
          contato_tipo: string | null
          contrato_id: string | null
          cotacao_id: string | null
          created_at: string
          data_agendada: string
          data_agendada_original: string | null
          data_suspensao: string | null
          debitos_conferidos_em: string | null
          debitos_conferidos_por: string | null
          decisao_instalador: string | null
          em_rota_em: string | null
          encaixe_executado: boolean | null
          etapa_atual: number | null
          fios_isolados: boolean | null
          followup_recusa_enviado_em: string | null
          fotos_manutencao: Json | null
          fotos_recusa: string[] | null
          fotos_ressalva: string[] | null
          hora_agendada: string | null
          id: string
          imei_rastreador: string | null
          imprevisto_duplo_check: boolean | null
          imprevisto_duplo_check_em: string | null
          imprevisto_motivo: string | null
          imprevisto_origem: string | null
          imprevisto_registrado_em: string | null
          iniciada_em: string | null
          instalacao_origem_id: string | null
          integridade_aparelho: string | null
          km_atual: number | null
          latitude: number | null
          lead_id: string | null
          local_tipo_manutencao: string | null
          local_vistoria: string | null
          localizacao_rastreador: Json | null
          logradouro: string | null
          longitude: number | null
          modalidade: string | null
          motivo_detalhe: string | null
          motivo_manutencao: string | null
          motivo_reprovacao: string | null
          motivo_retirada: string | null
          multa_aplicada: boolean | null
          multa_asaas_id: string | null
          multa_cobrada_em: string | null
          multa_forma_cobranca: string | null
          multa_motivo: string | null
          multa_valor: number | null
          novo_veiculo_id: string | null
          numero: string | null
          observacoes: string | null
          observacoes_analise: string | null
          origem: string | null
          periodo: Database["public"]["Enums"]["periodo_servico"]
          permite_encaixe: boolean | null
          plataforma_desativada: boolean | null
          profissional_id: string | null
          protecao_suspensa: boolean | null
          protocolo: string | null
          quilometragem: number | null
          rastreador_destino_pos_substituicao: string | null
          rastreador_id: string | null
          rastreador_substituto_id: string | null
          reagendamento_enviado_em: string | null
          reagendamento_token: string | null
          ressalvas: string | null
          ressalvas_instalador: string | null
          resultado_manutencao: string | null
          retirada_video_360_url: string | null
          rota_id: string | null
          sinistro_id: string | null
          solicitacao_id: string | null
          solicitado_por_modulo: string | null
          status: Database["public"]["Enums"]["status_servico"]
          sub_tipo_retirada: string | null
          tem_debitos_pendentes: boolean | null
          tipo: Database["public"]["Enums"]["tipo_servico"]
          uf: string | null
          updated_at: string
          veiculo_id: string | null
          video_360_url: string | null
          vistoria_origem_id: string | null
          whatsapp_notificado: boolean | null
          whatsapp_notificado_em: string | null
        }
        Insert: {
          acabamento_recolocado?: boolean | null
          analisado_em?: string | null
          analisado_por?: string | null
          assinatura_autentique_id?: string | null
          assinatura_cliente_url?: string | null
          assinatura_concluida_em?: string | null
          assinatura_devolucao_url?: string | null
          assinatura_documento_url?: string | null
          assinatura_enviada_em?: string | null
          assinatura_status?: string | null
          associado_id?: string | null
          avarias?: string | null
          bairro?: string | null
          cancelamento_bloqueado_ate_devolucao?: boolean | null
          cep?: string | null
          checklist_data?: Json | null
          checklist_manutencao?: Json | null
          checklist_retirada?: Json | null
          chip_cancelado?: boolean | null
          chip_presente?: boolean | null
          cidade?: string | null
          complemento?: string | null
          concluida_em?: string | null
          confirmacao_whatsapp?: string | null
          confirmado_via_whatsapp_em?: string | null
          contato_realizado_em?: string | null
          contato_tipo?: string | null
          contrato_id?: string | null
          cotacao_id?: string | null
          created_at?: string
          data_agendada: string
          data_agendada_original?: string | null
          data_suspensao?: string | null
          debitos_conferidos_em?: string | null
          debitos_conferidos_por?: string | null
          decisao_instalador?: string | null
          em_rota_em?: string | null
          encaixe_executado?: boolean | null
          etapa_atual?: number | null
          fios_isolados?: boolean | null
          followup_recusa_enviado_em?: string | null
          fotos_manutencao?: Json | null
          fotos_recusa?: string[] | null
          fotos_ressalva?: string[] | null
          hora_agendada?: string | null
          id?: string
          imei_rastreador?: string | null
          imprevisto_duplo_check?: boolean | null
          imprevisto_duplo_check_em?: string | null
          imprevisto_motivo?: string | null
          imprevisto_origem?: string | null
          imprevisto_registrado_em?: string | null
          iniciada_em?: string | null
          instalacao_origem_id?: string | null
          integridade_aparelho?: string | null
          km_atual?: number | null
          latitude?: number | null
          lead_id?: string | null
          local_tipo_manutencao?: string | null
          local_vistoria?: string | null
          localizacao_rastreador?: Json | null
          logradouro?: string | null
          longitude?: number | null
          modalidade?: string | null
          motivo_detalhe?: string | null
          motivo_manutencao?: string | null
          motivo_reprovacao?: string | null
          motivo_retirada?: string | null
          multa_aplicada?: boolean | null
          multa_asaas_id?: string | null
          multa_cobrada_em?: string | null
          multa_forma_cobranca?: string | null
          multa_motivo?: string | null
          multa_valor?: number | null
          novo_veiculo_id?: string | null
          numero?: string | null
          observacoes?: string | null
          observacoes_analise?: string | null
          origem?: string | null
          periodo?: Database["public"]["Enums"]["periodo_servico"]
          permite_encaixe?: boolean | null
          plataforma_desativada?: boolean | null
          profissional_id?: string | null
          protecao_suspensa?: boolean | null
          protocolo?: string | null
          quilometragem?: number | null
          rastreador_destino_pos_substituicao?: string | null
          rastreador_id?: string | null
          rastreador_substituto_id?: string | null
          reagendamento_enviado_em?: string | null
          reagendamento_token?: string | null
          ressalvas?: string | null
          ressalvas_instalador?: string | null
          resultado_manutencao?: string | null
          retirada_video_360_url?: string | null
          rota_id?: string | null
          sinistro_id?: string | null
          solicitacao_id?: string | null
          solicitado_por_modulo?: string | null
          status?: Database["public"]["Enums"]["status_servico"]
          sub_tipo_retirada?: string | null
          tem_debitos_pendentes?: boolean | null
          tipo: Database["public"]["Enums"]["tipo_servico"]
          uf?: string | null
          updated_at?: string
          veiculo_id?: string | null
          video_360_url?: string | null
          vistoria_origem_id?: string | null
          whatsapp_notificado?: boolean | null
          whatsapp_notificado_em?: string | null
        }
        Update: {
          acabamento_recolocado?: boolean | null
          analisado_em?: string | null
          analisado_por?: string | null
          assinatura_autentique_id?: string | null
          assinatura_cliente_url?: string | null
          assinatura_concluida_em?: string | null
          assinatura_devolucao_url?: string | null
          assinatura_documento_url?: string | null
          assinatura_enviada_em?: string | null
          assinatura_status?: string | null
          associado_id?: string | null
          avarias?: string | null
          bairro?: string | null
          cancelamento_bloqueado_ate_devolucao?: boolean | null
          cep?: string | null
          checklist_data?: Json | null
          checklist_manutencao?: Json | null
          checklist_retirada?: Json | null
          chip_cancelado?: boolean | null
          chip_presente?: boolean | null
          cidade?: string | null
          complemento?: string | null
          concluida_em?: string | null
          confirmacao_whatsapp?: string | null
          confirmado_via_whatsapp_em?: string | null
          contato_realizado_em?: string | null
          contato_tipo?: string | null
          contrato_id?: string | null
          cotacao_id?: string | null
          created_at?: string
          data_agendada?: string
          data_agendada_original?: string | null
          data_suspensao?: string | null
          debitos_conferidos_em?: string | null
          debitos_conferidos_por?: string | null
          decisao_instalador?: string | null
          em_rota_em?: string | null
          encaixe_executado?: boolean | null
          etapa_atual?: number | null
          fios_isolados?: boolean | null
          followup_recusa_enviado_em?: string | null
          fotos_manutencao?: Json | null
          fotos_recusa?: string[] | null
          fotos_ressalva?: string[] | null
          hora_agendada?: string | null
          id?: string
          imei_rastreador?: string | null
          imprevisto_duplo_check?: boolean | null
          imprevisto_duplo_check_em?: string | null
          imprevisto_motivo?: string | null
          imprevisto_origem?: string | null
          imprevisto_registrado_em?: string | null
          iniciada_em?: string | null
          instalacao_origem_id?: string | null
          integridade_aparelho?: string | null
          km_atual?: number | null
          latitude?: number | null
          lead_id?: string | null
          local_tipo_manutencao?: string | null
          local_vistoria?: string | null
          localizacao_rastreador?: Json | null
          logradouro?: string | null
          longitude?: number | null
          modalidade?: string | null
          motivo_detalhe?: string | null
          motivo_manutencao?: string | null
          motivo_reprovacao?: string | null
          motivo_retirada?: string | null
          multa_aplicada?: boolean | null
          multa_asaas_id?: string | null
          multa_cobrada_em?: string | null
          multa_forma_cobranca?: string | null
          multa_motivo?: string | null
          multa_valor?: number | null
          novo_veiculo_id?: string | null
          numero?: string | null
          observacoes?: string | null
          observacoes_analise?: string | null
          origem?: string | null
          periodo?: Database["public"]["Enums"]["periodo_servico"]
          permite_encaixe?: boolean | null
          plataforma_desativada?: boolean | null
          profissional_id?: string | null
          protecao_suspensa?: boolean | null
          protocolo?: string | null
          quilometragem?: number | null
          rastreador_destino_pos_substituicao?: string | null
          rastreador_id?: string | null
          rastreador_substituto_id?: string | null
          reagendamento_enviado_em?: string | null
          reagendamento_token?: string | null
          ressalvas?: string | null
          ressalvas_instalador?: string | null
          resultado_manutencao?: string | null
          retirada_video_360_url?: string | null
          rota_id?: string | null
          sinistro_id?: string | null
          solicitacao_id?: string | null
          solicitado_por_modulo?: string | null
          status?: Database["public"]["Enums"]["status_servico"]
          sub_tipo_retirada?: string | null
          tem_debitos_pendentes?: boolean | null
          tipo?: Database["public"]["Enums"]["tipo_servico"]
          uf?: string | null
          updated_at?: string
          veiculo_id?: string | null
          video_360_url?: string | null
          vistoria_origem_id?: string | null
          whatsapp_notificado?: boolean | null
          whatsapp_notificado_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "servicos_analisado_por_fkey"
            columns: ["analisado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servicos_analisado_por_fkey"
            columns: ["analisado_por"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "servicos_analisado_por_fkey"
            columns: ["analisado_por"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "servicos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "associados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servicos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "servicos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "servicos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associado_financeiro"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "servicos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associados_publico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servicos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_inadimplentes"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "servicos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "servicos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servicos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "servicos_cotacao_id_fkey"
            columns: ["cotacao_id"]
            isOneToOne: false
            referencedRelation: "cotacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servicos_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servicos_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "servicos_novo_veiculo_id_fkey"
            columns: ["novo_veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servicos_novo_veiculo_id_fkey"
            columns: ["novo_veiculo_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["veiculo_id"]
          },
          {
            foreignKeyName: "servicos_novo_veiculo_id_fkey"
            columns: ["novo_veiculo_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["veiculo_id"]
          },
          {
            foreignKeyName: "servicos_novo_veiculo_id_fkey"
            columns: ["novo_veiculo_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["veiculo_id"]
          },
          {
            foreignKeyName: "servicos_novo_veiculo_id_fkey"
            columns: ["novo_veiculo_id"]
            isOneToOne: false
            referencedRelation: "vw_veiculos_com_cotas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servicos_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servicos_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "servicos_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "servicos_rastreador_id_fkey"
            columns: ["rastreador_id"]
            isOneToOne: false
            referencedRelation: "rastreadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servicos_rastreador_id_fkey"
            columns: ["rastreador_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["rastreador_id"]
          },
          {
            foreignKeyName: "servicos_rastreador_substituto_id_fkey"
            columns: ["rastreador_substituto_id"]
            isOneToOne: false
            referencedRelation: "rastreadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servicos_rastreador_substituto_id_fkey"
            columns: ["rastreador_substituto_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["rastreador_id"]
          },
          {
            foreignKeyName: "servicos_rota_id_fkey"
            columns: ["rota_id"]
            isOneToOne: false
            referencedRelation: "rotas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servicos_sinistro_id_fkey"
            columns: ["sinistro_id"]
            isOneToOne: false
            referencedRelation: "sinistros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servicos_solicitacao_id_fkey"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "chat_solicitacoes_ia"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servicos_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servicos_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["veiculo_id"]
          },
          {
            foreignKeyName: "servicos_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["veiculo_id"]
          },
          {
            foreignKeyName: "servicos_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["veiculo_id"]
          },
          {
            foreignKeyName: "servicos_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "vw_veiculos_com_cotas"
            referencedColumns: ["id"]
          },
        ]
      }
      sga_health_checks: {
        Row: {
          conexao_ok: boolean
          created_at: string | null
          erro_mensagem: string | null
          fila_falhas: number | null
          fila_pendentes: number | null
          id: string
          tempo_resposta_ms: number | null
          veiculos_nao_sincronizados: number | null
        }
        Insert: {
          conexao_ok: boolean
          created_at?: string | null
          erro_mensagem?: string | null
          fila_falhas?: number | null
          fila_pendentes?: number | null
          id?: string
          tempo_resposta_ms?: number | null
          veiculos_nao_sincronizados?: number | null
        }
        Update: {
          conexao_ok?: boolean
          created_at?: string | null
          erro_mensagem?: string | null
          fila_falhas?: number | null
          fila_pendentes?: number | null
          id?: string
          tempo_resposta_ms?: number | null
          veiculos_nao_sincronizados?: number | null
        }
        Relationships: []
      }
      sga_sync_logs: {
        Row: {
          action: string
          associado_id: string | null
          created_at: string | null
          duracao_ms: number | null
          error_message: string | null
          id: string
          request_payload: Json | null
          response_payload: Json | null
          status: string
          usuario_id: string | null
          veiculo_id: string | null
        }
        Insert: {
          action: string
          associado_id?: string | null
          created_at?: string | null
          duracao_ms?: number | null
          error_message?: string | null
          id?: string
          request_payload?: Json | null
          response_payload?: Json | null
          status: string
          usuario_id?: string | null
          veiculo_id?: string | null
        }
        Update: {
          action?: string
          associado_id?: string | null
          created_at?: string | null
          duracao_ms?: number | null
          error_message?: string | null
          id?: string
          request_payload?: Json | null
          response_payload?: Json | null
          status?: string
          usuario_id?: string | null
          veiculo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sga_sync_logs_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "associados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sga_sync_logs_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "sga_sync_logs_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "sga_sync_logs_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associado_financeiro"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "sga_sync_logs_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associados_publico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sga_sync_logs_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_inadimplentes"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "sga_sync_logs_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "sga_sync_logs_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sga_sync_logs_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["veiculo_id"]
          },
          {
            foreignKeyName: "sga_sync_logs_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["veiculo_id"]
          },
          {
            foreignKeyName: "sga_sync_logs_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["veiculo_id"]
          },
          {
            foreignKeyName: "sga_sync_logs_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "vw_veiculos_com_cotas"
            referencedColumns: ["id"]
          },
        ]
      }
      sga_sync_queue: {
        Row: {
          associado_id: string
          codigo_associado_hinova: number | null
          codigo_veiculo_hinova: number | null
          created_at: string | null
          erro_ultimo: string | null
          etapa_parou: string | null
          id: string
          origem: string | null
          proximo_reenvio_em: string | null
          status: string | null
          tentativas: number | null
          ultima_tentativa_em: string | null
          veiculo_id: string
        }
        Insert: {
          associado_id: string
          codigo_associado_hinova?: number | null
          codigo_veiculo_hinova?: number | null
          created_at?: string | null
          erro_ultimo?: string | null
          etapa_parou?: string | null
          id?: string
          origem?: string | null
          proximo_reenvio_em?: string | null
          status?: string | null
          tentativas?: number | null
          ultima_tentativa_em?: string | null
          veiculo_id: string
        }
        Update: {
          associado_id?: string
          codigo_associado_hinova?: number | null
          codigo_veiculo_hinova?: number | null
          created_at?: string | null
          erro_ultimo?: string | null
          etapa_parou?: string | null
          id?: string
          origem?: string | null
          proximo_reenvio_em?: string | null
          status?: string | null
          tentativas?: number | null
          ultima_tentativa_em?: string | null
          veiculo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sga_sync_queue_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "associados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sga_sync_queue_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "sga_sync_queue_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "sga_sync_queue_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associado_financeiro"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "sga_sync_queue_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associados_publico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sga_sync_queue_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_inadimplentes"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "sga_sync_queue_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "sga_sync_queue_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sga_sync_queue_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["veiculo_id"]
          },
          {
            foreignKeyName: "sga_sync_queue_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["veiculo_id"]
          },
          {
            foreignKeyName: "sga_sync_queue_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["veiculo_id"]
          },
          {
            foreignKeyName: "sga_sync_queue_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "vw_veiculos_com_cotas"
            referencedColumns: ["id"]
          },
        ]
      }
      sindicancia_diligencias: {
        Row: {
          created_at: string | null
          data_diligencia: string
          descricao: string
          id: string
          local: string | null
          registrado_por: string
          resultado: string | null
          sindicancia_id: string
          tipo: string
        }
        Insert: {
          created_at?: string | null
          data_diligencia?: string
          descricao: string
          id?: string
          local?: string | null
          registrado_por: string
          resultado?: string | null
          sindicancia_id: string
          tipo: string
        }
        Update: {
          created_at?: string | null
          data_diligencia?: string
          descricao?: string
          id?: string
          local?: string | null
          registrado_por?: string
          resultado?: string | null
          sindicancia_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "sindicancia_diligencias_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sindicancia_diligencias_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "sindicancia_diligencias_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "sindicancia_diligencias_sindicancia_id_fkey"
            columns: ["sindicancia_id"]
            isOneToOne: false
            referencedRelation: "sindicancias"
            referencedColumns: ["id"]
          },
        ]
      }
      sindicancia_evidencias: {
        Row: {
          arquivo_nome: string | null
          arquivo_url: string | null
          created_at: string
          descricao: string | null
          diligencia_id: string | null
          id: string
          registrado_por: string | null
          sindicancia_id: string | null
          sinistro_id: string
          tipo: string
          titulo: string
        }
        Insert: {
          arquivo_nome?: string | null
          arquivo_url?: string | null
          created_at?: string
          descricao?: string | null
          diligencia_id?: string | null
          id?: string
          registrado_por?: string | null
          sindicancia_id?: string | null
          sinistro_id: string
          tipo?: string
          titulo: string
        }
        Update: {
          arquivo_nome?: string | null
          arquivo_url?: string | null
          created_at?: string
          descricao?: string | null
          diligencia_id?: string | null
          id?: string
          registrado_por?: string | null
          sindicancia_id?: string | null
          sinistro_id?: string
          tipo?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "sindicancia_evidencias_diligencia_id_fkey"
            columns: ["diligencia_id"]
            isOneToOne: false
            referencedRelation: "sindicancia_diligencias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sindicancia_evidencias_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sindicancia_evidencias_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "sindicancia_evidencias_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "sindicancia_evidencias_sindicancia_id_fkey"
            columns: ["sindicancia_id"]
            isOneToOne: false
            referencedRelation: "sindicancias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sindicancia_evidencias_sinistro_id_fkey"
            columns: ["sinistro_id"]
            isOneToOne: false
            referencedRelation: "sinistros"
            referencedColumns: ["id"]
          },
        ]
      }
      sindicancia_solicitacoes: {
        Row: {
          descricao: string
          id: string
          respondido_em: string | null
          respondido_por: string | null
          resposta: string | null
          resposta_anexo_url: string | null
          sindicancia_id: string
          solicitado_em: string | null
          solicitado_por: string | null
          status: string | null
          tipo: string
        }
        Insert: {
          descricao: string
          id?: string
          respondido_em?: string | null
          respondido_por?: string | null
          resposta?: string | null
          resposta_anexo_url?: string | null
          sindicancia_id: string
          solicitado_em?: string | null
          solicitado_por?: string | null
          status?: string | null
          tipo: string
        }
        Update: {
          descricao?: string
          id?: string
          respondido_em?: string | null
          respondido_por?: string | null
          resposta?: string | null
          resposta_anexo_url?: string | null
          sindicancia_id?: string
          solicitado_em?: string | null
          solicitado_por?: string | null
          status?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "sindicancia_solicitacoes_respondido_por_fkey"
            columns: ["respondido_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sindicancia_solicitacoes_respondido_por_fkey"
            columns: ["respondido_por"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "sindicancia_solicitacoes_respondido_por_fkey"
            columns: ["respondido_por"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "sindicancia_solicitacoes_sindicancia_id_fkey"
            columns: ["sindicancia_id"]
            isOneToOne: false
            referencedRelation: "sindicancias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sindicancia_solicitacoes_solicitado_por_fkey"
            columns: ["solicitado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sindicancia_solicitacoes_solicitado_por_fkey"
            columns: ["solicitado_por"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "sindicancia_solicitacoes_solicitado_por_fkey"
            columns: ["solicitado_por"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
        ]
      }
      sindicancias: {
        Row: {
          aberto_por: string | null
          created_at: string | null
          data_abertura: string | null
          data_atribuicao: string | null
          data_encerramento: string | null
          data_laudo: string | null
          data_limite: string | null
          decisao_analista: string | null
          decisao_em: string | null
          decisao_observacao: string | null
          decisao_por: string | null
          descricao: string | null
          empresa_sindicancia_id: string | null
          id: string
          laudo_arquivo_url: string | null
          laudo_conclusao: string | null
          laudo_irregularidades: string | null
          laudo_recomendacao: string | null
          laudo_resumo: string | null
          motivo: string
          motivos_padronizados: string[] | null
          numero: string | null
          sindicante_profile_id: string | null
          sinistro_id: string
          status: string
          updated_at: string | null
        }
        Insert: {
          aberto_por?: string | null
          created_at?: string | null
          data_abertura?: string | null
          data_atribuicao?: string | null
          data_encerramento?: string | null
          data_laudo?: string | null
          data_limite?: string | null
          decisao_analista?: string | null
          decisao_em?: string | null
          decisao_observacao?: string | null
          decisao_por?: string | null
          descricao?: string | null
          empresa_sindicancia_id?: string | null
          id?: string
          laudo_arquivo_url?: string | null
          laudo_conclusao?: string | null
          laudo_irregularidades?: string | null
          laudo_recomendacao?: string | null
          laudo_resumo?: string | null
          motivo: string
          motivos_padronizados?: string[] | null
          numero?: string | null
          sindicante_profile_id?: string | null
          sinistro_id: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          aberto_por?: string | null
          created_at?: string | null
          data_abertura?: string | null
          data_atribuicao?: string | null
          data_encerramento?: string | null
          data_laudo?: string | null
          data_limite?: string | null
          decisao_analista?: string | null
          decisao_em?: string | null
          decisao_observacao?: string | null
          decisao_por?: string | null
          descricao?: string | null
          empresa_sindicancia_id?: string | null
          id?: string
          laudo_arquivo_url?: string | null
          laudo_conclusao?: string | null
          laudo_irregularidades?: string | null
          laudo_recomendacao?: string | null
          laudo_resumo?: string | null
          motivo?: string
          motivos_padronizados?: string[] | null
          numero?: string | null
          sindicante_profile_id?: string | null
          sinistro_id?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sindicancias_aberto_por_fkey"
            columns: ["aberto_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sindicancias_aberto_por_fkey"
            columns: ["aberto_por"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "sindicancias_aberto_por_fkey"
            columns: ["aberto_por"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "sindicancias_decisao_por_fkey"
            columns: ["decisao_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sindicancias_decisao_por_fkey"
            columns: ["decisao_por"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "sindicancias_decisao_por_fkey"
            columns: ["decisao_por"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "sindicancias_empresa_sindicancia_id_fkey"
            columns: ["empresa_sindicancia_id"]
            isOneToOne: false
            referencedRelation: "empresas_sindicancia"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sindicancias_sindicante_profile_id_fkey"
            columns: ["sindicante_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sindicancias_sindicante_profile_id_fkey"
            columns: ["sindicante_profile_id"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "sindicancias_sindicante_profile_id_fkey"
            columns: ["sindicante_profile_id"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "sindicancias_sinistro_id_fkey"
            columns: ["sinistro_id"]
            isOneToOne: false
            referencedRelation: "sinistros"
            referencedColumns: ["id"]
          },
        ]
      }
      sinistro_analises_ia: {
        Row: {
          created_at: string | null
          dados_extras: Json | null
          fatores: Json
          id: string
          nivel: string
          pontuacao_risco: number
          recomendacao: string
          resumo: string
          sinistro_id: string
          tipo: string
        }
        Insert: {
          created_at?: string | null
          dados_extras?: Json | null
          fatores?: Json
          id?: string
          nivel: string
          pontuacao_risco: number
          recomendacao: string
          resumo: string
          sinistro_id: string
          tipo?: string
        }
        Update: {
          created_at?: string | null
          dados_extras?: Json | null
          fatores?: Json
          id?: string
          nivel?: string
          pontuacao_risco?: number
          recomendacao?: string
          resumo?: string
          sinistro_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "sinistro_analises_ia_sinistro_id_fkey"
            columns: ["sinistro_id"]
            isOneToOne: false
            referencedRelation: "sinistros"
            referencedColumns: ["id"]
          },
        ]
      }
      sinistro_contatos_agendados: {
        Row: {
          agendado_para: string
          created_at: string
          enviado_em: string | null
          erro_detalhes: string | null
          id: string
          link_id: string | null
          mensagem_enviada: string | null
          sinistro_id: string
          status: string
          tipo_contato: string
        }
        Insert: {
          agendado_para: string
          created_at?: string
          enviado_em?: string | null
          erro_detalhes?: string | null
          id?: string
          link_id?: string | null
          mensagem_enviada?: string | null
          sinistro_id: string
          status?: string
          tipo_contato?: string
        }
        Update: {
          agendado_para?: string
          created_at?: string
          enviado_em?: string | null
          erro_detalhes?: string | null
          id?: string
          link_id?: string | null
          mensagem_enviada?: string | null
          sinistro_id?: string
          status?: string
          tipo_contato?: string
        }
        Relationships: [
          {
            foreignKeyName: "sinistro_contatos_agendados_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "sinistro_evento_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sinistro_contatos_agendados_sinistro_id_fkey"
            columns: ["sinistro_id"]
            isOneToOne: false
            referencedRelation: "sinistros"
            referencedColumns: ["id"]
          },
        ]
      }
      sinistro_documentos: {
        Row: {
          arquivo_url: string
          created_at: string | null
          enviado_em: string | null
          id: string
          motivo_reprovacao: string | null
          nome_arquivo: string | null
          sinistro_id: string
          status: string | null
          tipo: string
        }
        Insert: {
          arquivo_url: string
          created_at?: string | null
          enviado_em?: string | null
          id?: string
          motivo_reprovacao?: string | null
          nome_arquivo?: string | null
          sinistro_id: string
          status?: string | null
          tipo: string
        }
        Update: {
          arquivo_url?: string
          created_at?: string | null
          enviado_em?: string | null
          id?: string
          motivo_reprovacao?: string | null
          nome_arquivo?: string | null
          sinistro_id?: string
          status?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "sinistro_documentos_sinistro_id_fkey"
            columns: ["sinistro_id"]
            isOneToOne: false
            referencedRelation: "sinistros"
            referencedColumns: ["id"]
          },
        ]
      }
      sinistro_evento_links: {
        Row: {
          assinatura_em: string | null
          assinatura_ip: string | null
          assinatura_url: string | null
          created_at: string
          created_by: string | null
          dados_etapa1: Json | null
          dados_etapa2: Json | null
          dados_etapa3: Json | null
          etapa_atual: number
          etapa1_completada_em: string | null
          etapa2_completada_em: string | null
          etapa3_completada_em: string | null
          etapa4_completada_em: string | null
          expira_em: string
          id: string
          pagamento_confirmado_em: string | null
          sinistro_id: string
          status: string
          tipo: string
          token: string
        }
        Insert: {
          assinatura_em?: string | null
          assinatura_ip?: string | null
          assinatura_url?: string | null
          created_at?: string
          created_by?: string | null
          dados_etapa1?: Json | null
          dados_etapa2?: Json | null
          dados_etapa3?: Json | null
          etapa_atual?: number
          etapa1_completada_em?: string | null
          etapa2_completada_em?: string | null
          etapa3_completada_em?: string | null
          etapa4_completada_em?: string | null
          expira_em: string
          id?: string
          pagamento_confirmado_em?: string | null
          sinistro_id: string
          status?: string
          tipo?: string
          token?: string
        }
        Update: {
          assinatura_em?: string | null
          assinatura_ip?: string | null
          assinatura_url?: string | null
          created_at?: string
          created_by?: string | null
          dados_etapa1?: Json | null
          dados_etapa2?: Json | null
          dados_etapa3?: Json | null
          etapa_atual?: number
          etapa1_completada_em?: string | null
          etapa2_completada_em?: string | null
          etapa3_completada_em?: string | null
          etapa4_completada_em?: string | null
          expira_em?: string
          id?: string
          pagamento_confirmado_em?: string | null
          sinistro_id?: string
          status?: string
          tipo?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "sinistro_evento_links_sinistro_id_fkey"
            columns: ["sinistro_id"]
            isOneToOne: false
            referencedRelation: "sinistros"
            referencedColumns: ["id"]
          },
        ]
      }
      sinistro_fotos: {
        Row: {
          created_at: string | null
          enviado_por: string | null
          id: string
          nome_arquivo: string | null
          sinistro_id: string
          status: string | null
          storage_path: string
          tamanho_bytes: number | null
          tipo: string
        }
        Insert: {
          created_at?: string | null
          enviado_por?: string | null
          id?: string
          nome_arquivo?: string | null
          sinistro_id: string
          status?: string | null
          storage_path: string
          tamanho_bytes?: number | null
          tipo?: string
        }
        Update: {
          created_at?: string | null
          enviado_por?: string | null
          id?: string
          nome_arquivo?: string | null
          sinistro_id?: string
          status?: string | null
          storage_path?: string
          tamanho_bytes?: number | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "sinistro_fotos_enviado_por_fkey"
            columns: ["enviado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sinistro_fotos_enviado_por_fkey"
            columns: ["enviado_por"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "sinistro_fotos_enviado_por_fkey"
            columns: ["enviado_por"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "sinistro_fotos_sinistro_id_fkey"
            columns: ["sinistro_id"]
            isOneToOne: false
            referencedRelation: "sinistros"
            referencedColumns: ["id"]
          },
        ]
      }
      sinistro_historico: {
        Row: {
          created_at: string | null
          id: string
          observacao: string | null
          sinistro_id: string
          status_anterior: string | null
          status_novo: string
          usuario_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          observacao?: string | null
          sinistro_id: string
          status_anterior?: string | null
          status_novo: string
          usuario_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          observacao?: string | null
          sinistro_id?: string
          status_anterior?: string | null
          status_novo?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sinistro_historico_sinistro_id_fkey"
            columns: ["sinistro_id"]
            isOneToOne: false
            referencedRelation: "sinistros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sinistro_historico_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      sinistro_mensagens: {
        Row: {
          anexo_nome: string | null
          anexo_tipo: string | null
          anexo_url: string | null
          created_at: string | null
          id: string
          lida: boolean | null
          mensagem: string
          remetente_id: string | null
          remetente_tipo: string
          sinistro_id: string
        }
        Insert: {
          anexo_nome?: string | null
          anexo_tipo?: string | null
          anexo_url?: string | null
          created_at?: string | null
          id?: string
          lida?: boolean | null
          mensagem: string
          remetente_id?: string | null
          remetente_tipo: string
          sinistro_id: string
        }
        Update: {
          anexo_nome?: string | null
          anexo_tipo?: string | null
          anexo_url?: string | null
          created_at?: string | null
          id?: string
          lida?: boolean | null
          mensagem?: string
          remetente_id?: string | null
          remetente_tipo?: string
          sinistro_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sinistro_mensagens_remetente_id_fkey"
            columns: ["remetente_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sinistro_mensagens_remetente_id_fkey"
            columns: ["remetente_id"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "sinistro_mensagens_remetente_id_fkey"
            columns: ["remetente_id"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "sinistro_mensagens_sinistro_id_fkey"
            columns: ["sinistro_id"]
            isOneToOne: false
            referencedRelation: "sinistros"
            referencedColumns: ["id"]
          },
        ]
      }
      sinistro_prestadores: {
        Row: {
          created_at: string | null
          id: string
          observacoes: string | null
          prestador_id: string
          sinistro_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          observacoes?: string | null
          prestador_id: string
          sinistro_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          observacoes?: string | null
          prestador_id?: string
          sinistro_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sinistro_prestadores_prestador_id_fkey"
            columns: ["prestador_id"]
            isOneToOne: false
            referencedRelation: "prestadores_evento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sinistro_prestadores_sinistro_id_fkey"
            columns: ["sinistro_id"]
            isOneToOne: false
            referencedRelation: "sinistros"
            referencedColumns: ["id"]
          },
        ]
      }
      sinistro_suspensoes_prazo: {
        Row: {
          created_at: string | null
          dias_uteis_suspensos: number | null
          fim: string | null
          id: string
          inicio: string
          motivo: string
          sinistro_id: string
        }
        Insert: {
          created_at?: string | null
          dias_uteis_suspensos?: number | null
          fim?: string | null
          id?: string
          inicio?: string
          motivo: string
          sinistro_id: string
        }
        Update: {
          created_at?: string | null
          dias_uteis_suspensos?: number | null
          fim?: string | null
          id?: string
          inicio?: string
          motivo?: string
          sinistro_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sinistro_suspensoes_prazo_sinistro_id_fkey"
            columns: ["sinistro_id"]
            isOneToOne: false
            referencedRelation: "sinistros"
            referencedColumns: ["id"]
          },
        ]
      }
      sinistro_terceiro_documentos: {
        Row: {
          aprovado_em: string | null
          aprovado_por: string | null
          created_at: string
          id: string
          motivo_rejeicao: string | null
          nome: string
          status: string
          terceiro_id: string
          tipo: string
          url: string
        }
        Insert: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          created_at?: string
          id?: string
          motivo_rejeicao?: string | null
          nome: string
          status?: string
          terceiro_id: string
          tipo: string
          url: string
        }
        Update: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          created_at?: string
          id?: string
          motivo_rejeicao?: string | null
          nome?: string
          status?: string
          terceiro_id?: string
          tipo?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "sinistro_terceiro_documentos_terceiro_id_fkey"
            columns: ["terceiro_id"]
            isOneToOne: false
            referencedRelation: "sinistro_terceiros"
            referencedColumns: ["id"]
          },
        ]
      }
      sinistro_terceiros: {
        Row: {
          acordo_justificativa: string | null
          acordo_respondido_em: string | null
          acordo_status: string | null
          acordo_valor: number | null
          cpf: string
          created_at: string
          created_by: string | null
          culpa: string
          documentos_aprovados_em: string | null
          email: string | null
          entrega_em: string | null
          id: string
          nome: string
          numero_sequencial: number
          observacoes: string | null
          oficina_endereco: string | null
          oficina_nome: string | null
          oficina_telefone: string | null
          oficina_tipo: string | null
          orcamento_valor: number | null
          parentesco: boolean
          parentesco_descricao: string | null
          reparo_concluido_em: string | null
          sinistro_id: string
          status: string
          telefone: string
          termo_assinado_em: string | null
          termo_assinatura_ip: string | null
          termo_assinatura_nome: string | null
          tipo_dano: string
          token: string
          updated_at: string
          veiculo_ano: string
          veiculo_cor: string
          veiculo_fipe: number | null
          veiculo_marca: string
          veiculo_modelo: string
          veiculo_placa: string
          whatsapp: string
        }
        Insert: {
          acordo_justificativa?: string | null
          acordo_respondido_em?: string | null
          acordo_status?: string | null
          acordo_valor?: number | null
          cpf: string
          created_at?: string
          created_by?: string | null
          culpa?: string
          documentos_aprovados_em?: string | null
          email?: string | null
          entrega_em?: string | null
          id?: string
          nome: string
          numero_sequencial?: number
          observacoes?: string | null
          oficina_endereco?: string | null
          oficina_nome?: string | null
          oficina_telefone?: string | null
          oficina_tipo?: string | null
          orcamento_valor?: number | null
          parentesco?: boolean
          parentesco_descricao?: string | null
          reparo_concluido_em?: string | null
          sinistro_id: string
          status?: string
          telefone: string
          termo_assinado_em?: string | null
          termo_assinatura_ip?: string | null
          termo_assinatura_nome?: string | null
          tipo_dano?: string
          token?: string
          updated_at?: string
          veiculo_ano: string
          veiculo_cor: string
          veiculo_fipe?: number | null
          veiculo_marca: string
          veiculo_modelo: string
          veiculo_placa: string
          whatsapp: string
        }
        Update: {
          acordo_justificativa?: string | null
          acordo_respondido_em?: string | null
          acordo_status?: string | null
          acordo_valor?: number | null
          cpf?: string
          created_at?: string
          created_by?: string | null
          culpa?: string
          documentos_aprovados_em?: string | null
          email?: string | null
          entrega_em?: string | null
          id?: string
          nome?: string
          numero_sequencial?: number
          observacoes?: string | null
          oficina_endereco?: string | null
          oficina_nome?: string | null
          oficina_telefone?: string | null
          oficina_tipo?: string | null
          orcamento_valor?: number | null
          parentesco?: boolean
          parentesco_descricao?: string | null
          reparo_concluido_em?: string | null
          sinistro_id?: string
          status?: string
          telefone?: string
          termo_assinado_em?: string | null
          termo_assinatura_ip?: string | null
          termo_assinatura_nome?: string | null
          tipo_dano?: string
          token?: string
          updated_at?: string
          veiculo_ano?: string
          veiculo_cor?: string
          veiculo_fipe?: number | null
          veiculo_marca?: string
          veiculo_modelo?: string
          veiculo_placa?: string
          whatsapp?: string
        }
        Relationships: [
          {
            foreignKeyName: "sinistro_terceiros_sinistro_id_fkey"
            columns: ["sinistro_id"]
            isOneToOne: false
            referencedRelation: "sinistros"
            referencedColumns: ["id"]
          },
        ]
      }
      sinistro_vidros_historico: {
        Row: {
          associado_id: string
          created_at: string
          data_utilizacao: string
          id: string
          peca: string
          sinistro_id: string
          veiculo_id: string
        }
        Insert: {
          associado_id: string
          created_at?: string
          data_utilizacao?: string
          id?: string
          peca: string
          sinistro_id: string
          veiculo_id: string
        }
        Update: {
          associado_id?: string
          created_at?: string
          data_utilizacao?: string
          id?: string
          peca?: string
          sinistro_id?: string
          veiculo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sinistro_vidros_historico_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "associados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sinistro_vidros_historico_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "sinistro_vidros_historico_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "sinistro_vidros_historico_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associado_financeiro"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "sinistro_vidros_historico_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associados_publico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sinistro_vidros_historico_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_inadimplentes"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "sinistro_vidros_historico_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "sinistro_vidros_historico_sinistro_id_fkey"
            columns: ["sinistro_id"]
            isOneToOne: false
            referencedRelation: "sinistros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sinistro_vidros_historico_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sinistro_vidros_historico_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["veiculo_id"]
          },
          {
            foreignKeyName: "sinistro_vidros_historico_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["veiculo_id"]
          },
          {
            foreignKeyName: "sinistro_vidros_historico_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["veiculo_id"]
          },
          {
            foreignKeyName: "sinistro_vidros_historico_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "vw_veiculos_com_cotas"
            referencedColumns: ["id"]
          },
        ]
      }
      sinistros: {
        Row: {
          agendamento_entrada_oficina_data: string | null
          agendamento_entrada_oficina_obs: string | null
          agendamento_regulagem_data: string | null
          agendamento_regulagem_local: string | null
          agendamento_regulagem_obs: string | null
          agendamento_regulagem_periodo: string | null
          alerta_inadimplente: boolean | null
          alerta_recem_ativado: boolean | null
          analise_interna: boolean | null
          analise_interna_motivos: string[] | null
          analista_id: string | null
          assistencia_acionada_em: string | null
          associado_id: string
          autentique_documento_id: string | null
          autentique_url: string | null
          avaliacao_comentario: string | null
          avaliacao_data: string | null
          avaliacao_nota: number | null
          bo_arquivo_url: string | null
          bo_numero: string | null
          bombeiros_acionados: boolean | null
          canal: string
          chamado_assistencia_id: string | null
          chamado_origem_id: string | null
          cidade_ocorrencia: string | null
          cobranca_cota_id: string | null
          condutor_cnh: string | null
          condutor_cnh_vencida: boolean | null
          condutor_embriaguez: boolean | null
          condutor_nome: string | null
          condutor_relacao: string | null
          cota_paga: boolean | null
          cota_paga_em: string | null
          created_at: string
          custo_real_total: number | null
          data_garantia_fim: string | null
          data_garantia_inicio: string | null
          data_ocorrencia: string
          data_parecer: string | null
          data_prazo_cota: string | null
          data_prazo_documentos: string | null
          data_prazo_termo: string | null
          descricao: string | null
          destino_reboque_endereco: string | null
          destino_reboque_oficina_id: string | null
          destino_reboque_tipo: string | null
          estado_ocorrencia: string | null
          fluxo_simplificado: boolean | null
          garantia_observacoes: string | null
          houve_vitima: boolean | null
          id: string
          justificativa_negacao: string | null
          latitude_informada: number | null
          link_evento_id: string | null
          local_descricao: string | null
          local_ocorrencia: string | null
          longitude_informada: number | null
          motivo_analise_interna: string | null
          motivo_negacao: string | null
          motivo_suspensao: string | null
          necessita_reboque: boolean | null
          nf_reembolso_url: string | null
          oficina_id: string | null
          opcao_reparo: string | null
          orcamento_data: string | null
          orcamento_detalhamento: Json | null
          orcamento_oficina_id: string | null
          orcamento_prazo_reparo: string | null
          orcamento_status: string | null
          orcamento_valor_total: number | null
          ordem_servico_id: string | null
          parecer: string | null
          peca_danificada: string | null
          pecas_chegaram: boolean | null
          pecas_chegaram_em: string | null
          pecas_pedido_realizado: boolean | null
          pecas_status: Json | null
          percentual_fipe: number | null
          perito_id: string | null
          prazo_comunicado_dias: number | null
          prazo_dias_uteis_consumidos: number | null
          prazo_motivo_suspensao: string | null
          prazo_ressarcimento_inicio: string | null
          prazo_suspenso: boolean | null
          prazo_suspenso_em: string | null
          protocolo: string
          rastreador_lat_momento: number | null
          rastreador_lng_momento: number | null
          rastreador_posicao_capturada_em: string | null
          regulagem_concluida_em: string | null
          regulagem_parecer: string | null
          regulagem_tipo_dano: string | null
          resultado_pericia: string | null
          resultado_sindicancia: string | null
          sindicancia_prazo_fim: string | null
          sindicante_id: string | null
          snapshot_salvo_em: string | null
          snapshot_salvo_por: string | null
          snapshot_trajeto_json: Json | null
          status: Database["public"]["Enums"]["status_sinistro"]
          tem_terceiro: boolean
          termo_anuencia_assinado: boolean | null
          termo_anuencia_assinado_em: string | null
          termo_anuencia_url: string | null
          tipo: Database["public"]["Enums"]["tipo_sinistro"]
          tipo_agua: string | null
          tipo_dano: string | null
          tipo_local_evento: string | null
          tipo_servico_oficina: string | null
          updated_at: string
          upload_token: string | null
          upload_token_expires_at: string | null
          valor_cota_participacao: number | null
          valor_fipe: number | null
          valor_indenizacao: number | null
          valor_orcamento: number | null
          valor_pago: number | null
          valor_participacao: number | null
          valor_reembolso: number | null
          veiculo_id: string
          veiculo_recuperado: boolean | null
          veiculo_recuperado_em: string | null
          veiculo_recuperado_estado: string | null
          veiculo_recuperado_local: string | null
        }
        Insert: {
          agendamento_entrada_oficina_data?: string | null
          agendamento_entrada_oficina_obs?: string | null
          agendamento_regulagem_data?: string | null
          agendamento_regulagem_local?: string | null
          agendamento_regulagem_obs?: string | null
          agendamento_regulagem_periodo?: string | null
          alerta_inadimplente?: boolean | null
          alerta_recem_ativado?: boolean | null
          analise_interna?: boolean | null
          analise_interna_motivos?: string[] | null
          analista_id?: string | null
          assistencia_acionada_em?: string | null
          associado_id: string
          autentique_documento_id?: string | null
          autentique_url?: string | null
          avaliacao_comentario?: string | null
          avaliacao_data?: string | null
          avaliacao_nota?: number | null
          bo_arquivo_url?: string | null
          bo_numero?: string | null
          bombeiros_acionados?: boolean | null
          canal?: string
          chamado_assistencia_id?: string | null
          chamado_origem_id?: string | null
          cidade_ocorrencia?: string | null
          cobranca_cota_id?: string | null
          condutor_cnh?: string | null
          condutor_cnh_vencida?: boolean | null
          condutor_embriaguez?: boolean | null
          condutor_nome?: string | null
          condutor_relacao?: string | null
          cota_paga?: boolean | null
          cota_paga_em?: string | null
          created_at?: string
          custo_real_total?: number | null
          data_garantia_fim?: string | null
          data_garantia_inicio?: string | null
          data_ocorrencia: string
          data_parecer?: string | null
          data_prazo_cota?: string | null
          data_prazo_documentos?: string | null
          data_prazo_termo?: string | null
          descricao?: string | null
          destino_reboque_endereco?: string | null
          destino_reboque_oficina_id?: string | null
          destino_reboque_tipo?: string | null
          estado_ocorrencia?: string | null
          fluxo_simplificado?: boolean | null
          garantia_observacoes?: string | null
          houve_vitima?: boolean | null
          id?: string
          justificativa_negacao?: string | null
          latitude_informada?: number | null
          link_evento_id?: string | null
          local_descricao?: string | null
          local_ocorrencia?: string | null
          longitude_informada?: number | null
          motivo_analise_interna?: string | null
          motivo_negacao?: string | null
          motivo_suspensao?: string | null
          necessita_reboque?: boolean | null
          nf_reembolso_url?: string | null
          oficina_id?: string | null
          opcao_reparo?: string | null
          orcamento_data?: string | null
          orcamento_detalhamento?: Json | null
          orcamento_oficina_id?: string | null
          orcamento_prazo_reparo?: string | null
          orcamento_status?: string | null
          orcamento_valor_total?: number | null
          ordem_servico_id?: string | null
          parecer?: string | null
          peca_danificada?: string | null
          pecas_chegaram?: boolean | null
          pecas_chegaram_em?: string | null
          pecas_pedido_realizado?: boolean | null
          pecas_status?: Json | null
          percentual_fipe?: number | null
          perito_id?: string | null
          prazo_comunicado_dias?: number | null
          prazo_dias_uteis_consumidos?: number | null
          prazo_motivo_suspensao?: string | null
          prazo_ressarcimento_inicio?: string | null
          prazo_suspenso?: boolean | null
          prazo_suspenso_em?: string | null
          protocolo: string
          rastreador_lat_momento?: number | null
          rastreador_lng_momento?: number | null
          rastreador_posicao_capturada_em?: string | null
          regulagem_concluida_em?: string | null
          regulagem_parecer?: string | null
          regulagem_tipo_dano?: string | null
          resultado_pericia?: string | null
          resultado_sindicancia?: string | null
          sindicancia_prazo_fim?: string | null
          sindicante_id?: string | null
          snapshot_salvo_em?: string | null
          snapshot_salvo_por?: string | null
          snapshot_trajeto_json?: Json | null
          status?: Database["public"]["Enums"]["status_sinistro"]
          tem_terceiro?: boolean
          termo_anuencia_assinado?: boolean | null
          termo_anuencia_assinado_em?: string | null
          termo_anuencia_url?: string | null
          tipo: Database["public"]["Enums"]["tipo_sinistro"]
          tipo_agua?: string | null
          tipo_dano?: string | null
          tipo_local_evento?: string | null
          tipo_servico_oficina?: string | null
          updated_at?: string
          upload_token?: string | null
          upload_token_expires_at?: string | null
          valor_cota_participacao?: number | null
          valor_fipe?: number | null
          valor_indenizacao?: number | null
          valor_orcamento?: number | null
          valor_pago?: number | null
          valor_participacao?: number | null
          valor_reembolso?: number | null
          veiculo_id: string
          veiculo_recuperado?: boolean | null
          veiculo_recuperado_em?: string | null
          veiculo_recuperado_estado?: string | null
          veiculo_recuperado_local?: string | null
        }
        Update: {
          agendamento_entrada_oficina_data?: string | null
          agendamento_entrada_oficina_obs?: string | null
          agendamento_regulagem_data?: string | null
          agendamento_regulagem_local?: string | null
          agendamento_regulagem_obs?: string | null
          agendamento_regulagem_periodo?: string | null
          alerta_inadimplente?: boolean | null
          alerta_recem_ativado?: boolean | null
          analise_interna?: boolean | null
          analise_interna_motivos?: string[] | null
          analista_id?: string | null
          assistencia_acionada_em?: string | null
          associado_id?: string
          autentique_documento_id?: string | null
          autentique_url?: string | null
          avaliacao_comentario?: string | null
          avaliacao_data?: string | null
          avaliacao_nota?: number | null
          bo_arquivo_url?: string | null
          bo_numero?: string | null
          bombeiros_acionados?: boolean | null
          canal?: string
          chamado_assistencia_id?: string | null
          chamado_origem_id?: string | null
          cidade_ocorrencia?: string | null
          cobranca_cota_id?: string | null
          condutor_cnh?: string | null
          condutor_cnh_vencida?: boolean | null
          condutor_embriaguez?: boolean | null
          condutor_nome?: string | null
          condutor_relacao?: string | null
          cota_paga?: boolean | null
          cota_paga_em?: string | null
          created_at?: string
          custo_real_total?: number | null
          data_garantia_fim?: string | null
          data_garantia_inicio?: string | null
          data_ocorrencia?: string
          data_parecer?: string | null
          data_prazo_cota?: string | null
          data_prazo_documentos?: string | null
          data_prazo_termo?: string | null
          descricao?: string | null
          destino_reboque_endereco?: string | null
          destino_reboque_oficina_id?: string | null
          destino_reboque_tipo?: string | null
          estado_ocorrencia?: string | null
          fluxo_simplificado?: boolean | null
          garantia_observacoes?: string | null
          houve_vitima?: boolean | null
          id?: string
          justificativa_negacao?: string | null
          latitude_informada?: number | null
          link_evento_id?: string | null
          local_descricao?: string | null
          local_ocorrencia?: string | null
          longitude_informada?: number | null
          motivo_analise_interna?: string | null
          motivo_negacao?: string | null
          motivo_suspensao?: string | null
          necessita_reboque?: boolean | null
          nf_reembolso_url?: string | null
          oficina_id?: string | null
          opcao_reparo?: string | null
          orcamento_data?: string | null
          orcamento_detalhamento?: Json | null
          orcamento_oficina_id?: string | null
          orcamento_prazo_reparo?: string | null
          orcamento_status?: string | null
          orcamento_valor_total?: number | null
          ordem_servico_id?: string | null
          parecer?: string | null
          peca_danificada?: string | null
          pecas_chegaram?: boolean | null
          pecas_chegaram_em?: string | null
          pecas_pedido_realizado?: boolean | null
          pecas_status?: Json | null
          percentual_fipe?: number | null
          perito_id?: string | null
          prazo_comunicado_dias?: number | null
          prazo_dias_uteis_consumidos?: number | null
          prazo_motivo_suspensao?: string | null
          prazo_ressarcimento_inicio?: string | null
          prazo_suspenso?: boolean | null
          prazo_suspenso_em?: string | null
          protocolo?: string
          rastreador_lat_momento?: number | null
          rastreador_lng_momento?: number | null
          rastreador_posicao_capturada_em?: string | null
          regulagem_concluida_em?: string | null
          regulagem_parecer?: string | null
          regulagem_tipo_dano?: string | null
          resultado_pericia?: string | null
          resultado_sindicancia?: string | null
          sindicancia_prazo_fim?: string | null
          sindicante_id?: string | null
          snapshot_salvo_em?: string | null
          snapshot_salvo_por?: string | null
          snapshot_trajeto_json?: Json | null
          status?: Database["public"]["Enums"]["status_sinistro"]
          tem_terceiro?: boolean
          termo_anuencia_assinado?: boolean | null
          termo_anuencia_assinado_em?: string | null
          termo_anuencia_url?: string | null
          tipo?: Database["public"]["Enums"]["tipo_sinistro"]
          tipo_agua?: string | null
          tipo_dano?: string | null
          tipo_local_evento?: string | null
          tipo_servico_oficina?: string | null
          updated_at?: string
          upload_token?: string | null
          upload_token_expires_at?: string | null
          valor_cota_participacao?: number | null
          valor_fipe?: number | null
          valor_indenizacao?: number | null
          valor_orcamento?: number | null
          valor_pago?: number | null
          valor_participacao?: number | null
          valor_reembolso?: number | null
          veiculo_id?: string
          veiculo_recuperado?: boolean | null
          veiculo_recuperado_em?: string | null
          veiculo_recuperado_estado?: string | null
          veiculo_recuperado_local?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sinistros_analista_id_fkey"
            columns: ["analista_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sinistros_analista_id_fkey"
            columns: ["analista_id"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "sinistros_analista_id_fkey"
            columns: ["analista_id"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "sinistros_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "associados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sinistros_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "sinistros_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "sinistros_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associado_financeiro"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "sinistros_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associados_publico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sinistros_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_inadimplentes"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "sinistros_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "sinistros_chamado_assistencia_id_fkey"
            columns: ["chamado_assistencia_id"]
            isOneToOne: false
            referencedRelation: "chamados_assistencia"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sinistros_chamado_origem_id_fkey"
            columns: ["chamado_origem_id"]
            isOneToOne: false
            referencedRelation: "chamados_assistencia"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sinistros_destino_reboque_oficina_id_fkey"
            columns: ["destino_reboque_oficina_id"]
            isOneToOne: false
            referencedRelation: "oficinas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sinistros_link_evento_id_fkey"
            columns: ["link_evento_id"]
            isOneToOne: false
            referencedRelation: "sinistro_evento_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sinistros_orcamento_oficina_id_fkey"
            columns: ["orcamento_oficina_id"]
            isOneToOne: false
            referencedRelation: "oficinas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sinistros_perito_id_fkey"
            columns: ["perito_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sinistros_perito_id_fkey"
            columns: ["perito_id"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "sinistros_perito_id_fkey"
            columns: ["perito_id"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "sinistros_sindicante_id_fkey"
            columns: ["sindicante_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sinistros_sindicante_id_fkey"
            columns: ["sindicante_id"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "sinistros_sindicante_id_fkey"
            columns: ["sindicante_id"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "sinistros_snapshot_salvo_por_fkey"
            columns: ["snapshot_salvo_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sinistros_snapshot_salvo_por_fkey"
            columns: ["snapshot_salvo_por"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "sinistros_snapshot_salvo_por_fkey"
            columns: ["snapshot_salvo_por"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "sinistros_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sinistros_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["veiculo_id"]
          },
          {
            foreignKeyName: "sinistros_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["veiculo_id"]
          },
          {
            foreignKeyName: "sinistros_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["veiculo_id"]
          },
          {
            foreignKeyName: "sinistros_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "vw_veiculos_com_cotas"
            referencedColumns: ["id"]
          },
        ]
      }
      softruck_eventos: {
        Row: {
          alerta_gerado: boolean | null
          alerta_id: string | null
          created_at: string | null
          device_id: string | null
          erro_processamento: string | null
          evento_acao: string | null
          evento_tipo: string
          headers_recebidos: Json | null
          id: string
          imei: string | null
          ip_origem: string | null
          payload: Json
          placa: string | null
          processado: boolean | null
          processado_em: string | null
          rastreador_id: string | null
          vehicle_id: string | null
          veiculo_id: string | null
        }
        Insert: {
          alerta_gerado?: boolean | null
          alerta_id?: string | null
          created_at?: string | null
          device_id?: string | null
          erro_processamento?: string | null
          evento_acao?: string | null
          evento_tipo: string
          headers_recebidos?: Json | null
          id?: string
          imei?: string | null
          ip_origem?: string | null
          payload: Json
          placa?: string | null
          processado?: boolean | null
          processado_em?: string | null
          rastreador_id?: string | null
          vehicle_id?: string | null
          veiculo_id?: string | null
        }
        Update: {
          alerta_gerado?: boolean | null
          alerta_id?: string | null
          created_at?: string | null
          device_id?: string | null
          erro_processamento?: string | null
          evento_acao?: string | null
          evento_tipo?: string
          headers_recebidos?: Json | null
          id?: string
          imei?: string | null
          ip_origem?: string | null
          payload?: Json
          placa?: string | null
          processado?: boolean | null
          processado_em?: string | null
          rastreador_id?: string | null
          vehicle_id?: string | null
          veiculo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "softruck_eventos_rastreador_id_fkey"
            columns: ["rastreador_id"]
            isOneToOne: false
            referencedRelation: "rastreadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "softruck_eventos_rastreador_id_fkey"
            columns: ["rastreador_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["rastreador_id"]
          },
          {
            foreignKeyName: "softruck_eventos_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "softruck_eventos_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["veiculo_id"]
          },
          {
            foreignKeyName: "softruck_eventos_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["veiculo_id"]
          },
          {
            foreignKeyName: "softruck_eventos_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["veiculo_id"]
          },
          {
            foreignKeyName: "softruck_eventos_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "vw_veiculos_com_cotas"
            referencedColumns: ["id"]
          },
        ]
      }
      solicitacoes_migracao: {
        Row: {
          aprovado_em: string | null
          aprovado_por: string | null
          associacao_origem: string
          associado_cpf: string
          associado_nome: string | null
          consultor_id: string | null
          cotacao_id: string | null
          created_at: string | null
          declaracao_cancelamento_concorrente: boolean | null
          id: string
          motivo_reprovacao: string | null
          origem_entrada: string
          prazo_resposta_horas: number
          status: string
          updated_at: string | null
          veiculo_placa: string | null
        }
        Insert: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          associacao_origem: string
          associado_cpf: string
          associado_nome?: string | null
          consultor_id?: string | null
          cotacao_id?: string | null
          created_at?: string | null
          declaracao_cancelamento_concorrente?: boolean | null
          id?: string
          motivo_reprovacao?: string | null
          origem_entrada?: string
          prazo_resposta_horas?: number
          status?: string
          updated_at?: string | null
          veiculo_placa?: string | null
        }
        Update: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          associacao_origem?: string
          associado_cpf?: string
          associado_nome?: string | null
          consultor_id?: string | null
          cotacao_id?: string | null
          created_at?: string | null
          declaracao_cancelamento_concorrente?: boolean | null
          id?: string
          motivo_reprovacao?: string | null
          origem_entrada?: string
          prazo_resposta_horas?: number
          status?: string
          updated_at?: string | null
          veiculo_placa?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "solicitacoes_migracao_aprovado_por_fkey"
            columns: ["aprovado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacoes_migracao_aprovado_por_fkey"
            columns: ["aprovado_por"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "solicitacoes_migracao_aprovado_por_fkey"
            columns: ["aprovado_por"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "solicitacoes_migracao_consultor_id_fkey"
            columns: ["consultor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacoes_migracao_consultor_id_fkey"
            columns: ["consultor_id"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "solicitacoes_migracao_consultor_id_fkey"
            columns: ["consultor_id"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "solicitacoes_migracao_cotacao_id_fkey"
            columns: ["cotacao_id"]
            isOneToOne: false
            referencedRelation: "cotacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      solicitacoes_migracao_documentos: {
        Row: {
          arquivo_url: string
          cpf_detectado: string | null
          created_at: string | null
          id: string
          legivel: boolean | null
          nome_arquivo: string | null
          placa_detectada: string | null
          solicitacao_id: string
          tipo: string
          validacao_erro: string | null
          validacao_ok: boolean | null
        }
        Insert: {
          arquivo_url: string
          cpf_detectado?: string | null
          created_at?: string | null
          id?: string
          legivel?: boolean | null
          nome_arquivo?: string | null
          placa_detectada?: string | null
          solicitacao_id: string
          tipo: string
          validacao_erro?: string | null
          validacao_ok?: boolean | null
        }
        Update: {
          arquivo_url?: string
          cpf_detectado?: string | null
          created_at?: string | null
          id?: string
          legivel?: boolean | null
          nome_arquivo?: string | null
          placa_detectada?: string | null
          solicitacao_id?: string
          tipo?: string
          validacao_erro?: string | null
          validacao_ok?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "solicitacoes_migracao_documentos_solicitacao_id_fkey"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "solicitacoes_migracao"
            referencedColumns: ["id"]
          },
        ]
      }
      solicitacoes_permissao: {
        Row: {
          aprovado_em: string | null
          aprovador_id: string | null
          created_at: string | null
          dados: Json | null
          expira_em: string | null
          id: string
          motivo: string | null
          motivo_rejeicao: string | null
          perfil_alvo: string | null
          solicitante_id: string
          status: string | null
          tipo: string
          usuario_alvo_id: string | null
        }
        Insert: {
          aprovado_em?: string | null
          aprovador_id?: string | null
          created_at?: string | null
          dados?: Json | null
          expira_em?: string | null
          id?: string
          motivo?: string | null
          motivo_rejeicao?: string | null
          perfil_alvo?: string | null
          solicitante_id: string
          status?: string | null
          tipo: string
          usuario_alvo_id?: string | null
        }
        Update: {
          aprovado_em?: string | null
          aprovador_id?: string | null
          created_at?: string | null
          dados?: Json | null
          expira_em?: string | null
          id?: string
          motivo?: string | null
          motivo_rejeicao?: string | null
          perfil_alvo?: string | null
          solicitante_id?: string
          status?: string | null
          tipo?: string
          usuario_alvo_id?: string | null
        }
        Relationships: []
      }
      substituicoes_veiculo: {
        Row: {
          aprovado_em: string | null
          aprovado_por: string | null
          associado_id: string
          autentique_documento_id: string | null
          autentique_status: string | null
          beneficios_novos: Json | null
          carencia_dias: number | null
          cobranca_taxa_asaas_id: string | null
          comissao_creditada: boolean | null
          consultor_id: string | null
          contrato_novo_id: string | null
          cota_participacao_antiga: number | null
          cota_participacao_nova: number | null
          created_at: string | null
          criado_por: string | null
          data_fim_carencia: string | null
          data_inicio_carencia: string | null
          diferenca_mensalidade: number | null
          evento_bloqueante_id: string | null
          id: string
          mensalidade_antiga: number | null
          mensalidade_nova: number | null
          motivo_rejeicao: string | null
          observacoes: string | null
          pontos_consultor: number | null
          rejeitado_em: string | null
          rejeitado_por: string | null
          resolucao_evento: string | null
          servico_instalacao_id: string | null
          servico_retirada_id: string | null
          status: string
          taxa_substituicao: number | null
          termo_desistencia_evento_url: string | null
          tipo_atendimento: string | null
          tipo_evento_bloqueante: string | null
          updated_at: string | null
          valor_prorata: number | null
          valor_repasse: number | null
          veiculo_antigo_fipe: number | null
          veiculo_antigo_id: string
          veiculo_antigo_modelo: string | null
          veiculo_antigo_placa: string | null
          veiculo_novo_fipe: number | null
          veiculo_novo_id: string | null
          veiculo_novo_modelo: string | null
          veiculo_novo_placa: string | null
          verificacoes_resultado: Json | null
        }
        Insert: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          associado_id: string
          autentique_documento_id?: string | null
          autentique_status?: string | null
          beneficios_novos?: Json | null
          carencia_dias?: number | null
          cobranca_taxa_asaas_id?: string | null
          comissao_creditada?: boolean | null
          consultor_id?: string | null
          contrato_novo_id?: string | null
          cota_participacao_antiga?: number | null
          cota_participacao_nova?: number | null
          created_at?: string | null
          criado_por?: string | null
          data_fim_carencia?: string | null
          data_inicio_carencia?: string | null
          diferenca_mensalidade?: number | null
          evento_bloqueante_id?: string | null
          id?: string
          mensalidade_antiga?: number | null
          mensalidade_nova?: number | null
          motivo_rejeicao?: string | null
          observacoes?: string | null
          pontos_consultor?: number | null
          rejeitado_em?: string | null
          rejeitado_por?: string | null
          resolucao_evento?: string | null
          servico_instalacao_id?: string | null
          servico_retirada_id?: string | null
          status?: string
          taxa_substituicao?: number | null
          termo_desistencia_evento_url?: string | null
          tipo_atendimento?: string | null
          tipo_evento_bloqueante?: string | null
          updated_at?: string | null
          valor_prorata?: number | null
          valor_repasse?: number | null
          veiculo_antigo_fipe?: number | null
          veiculo_antigo_id: string
          veiculo_antigo_modelo?: string | null
          veiculo_antigo_placa?: string | null
          veiculo_novo_fipe?: number | null
          veiculo_novo_id?: string | null
          veiculo_novo_modelo?: string | null
          veiculo_novo_placa?: string | null
          verificacoes_resultado?: Json | null
        }
        Update: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          associado_id?: string
          autentique_documento_id?: string | null
          autentique_status?: string | null
          beneficios_novos?: Json | null
          carencia_dias?: number | null
          cobranca_taxa_asaas_id?: string | null
          comissao_creditada?: boolean | null
          consultor_id?: string | null
          contrato_novo_id?: string | null
          cota_participacao_antiga?: number | null
          cota_participacao_nova?: number | null
          created_at?: string | null
          criado_por?: string | null
          data_fim_carencia?: string | null
          data_inicio_carencia?: string | null
          diferenca_mensalidade?: number | null
          evento_bloqueante_id?: string | null
          id?: string
          mensalidade_antiga?: number | null
          mensalidade_nova?: number | null
          motivo_rejeicao?: string | null
          observacoes?: string | null
          pontos_consultor?: number | null
          rejeitado_em?: string | null
          rejeitado_por?: string | null
          resolucao_evento?: string | null
          servico_instalacao_id?: string | null
          servico_retirada_id?: string | null
          status?: string
          taxa_substituicao?: number | null
          termo_desistencia_evento_url?: string | null
          tipo_atendimento?: string | null
          tipo_evento_bloqueante?: string | null
          updated_at?: string | null
          valor_prorata?: number | null
          valor_repasse?: number | null
          veiculo_antigo_fipe?: number | null
          veiculo_antigo_id?: string
          veiculo_antigo_modelo?: string | null
          veiculo_antigo_placa?: string | null
          veiculo_novo_fipe?: number | null
          veiculo_novo_id?: string | null
          veiculo_novo_modelo?: string | null
          veiculo_novo_placa?: string | null
          verificacoes_resultado?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "substituicoes_veiculo_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "associados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "substituicoes_veiculo_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "substituicoes_veiculo_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "substituicoes_veiculo_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associado_financeiro"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "substituicoes_veiculo_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associados_publico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "substituicoes_veiculo_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_inadimplentes"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "substituicoes_veiculo_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "substituicoes_veiculo_contrato_novo_id_fkey"
            columns: ["contrato_novo_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "substituicoes_veiculo_contrato_novo_id_fkey"
            columns: ["contrato_novo_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "substituicoes_veiculo_servico_instalacao_id_fkey"
            columns: ["servico_instalacao_id"]
            isOneToOne: false
            referencedRelation: "servicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "substituicoes_veiculo_servico_retirada_id_fkey"
            columns: ["servico_retirada_id"]
            isOneToOne: false
            referencedRelation: "servicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "substituicoes_veiculo_veiculo_antigo_id_fkey"
            columns: ["veiculo_antigo_id"]
            isOneToOne: false
            referencedRelation: "veiculos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "substituicoes_veiculo_veiculo_antigo_id_fkey"
            columns: ["veiculo_antigo_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["veiculo_id"]
          },
          {
            foreignKeyName: "substituicoes_veiculo_veiculo_antigo_id_fkey"
            columns: ["veiculo_antigo_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["veiculo_id"]
          },
          {
            foreignKeyName: "substituicoes_veiculo_veiculo_antigo_id_fkey"
            columns: ["veiculo_antigo_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["veiculo_id"]
          },
          {
            foreignKeyName: "substituicoes_veiculo_veiculo_antigo_id_fkey"
            columns: ["veiculo_antigo_id"]
            isOneToOne: false
            referencedRelation: "vw_veiculos_com_cotas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "substituicoes_veiculo_veiculo_novo_id_fkey"
            columns: ["veiculo_novo_id"]
            isOneToOne: false
            referencedRelation: "veiculos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "substituicoes_veiculo_veiculo_novo_id_fkey"
            columns: ["veiculo_novo_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["veiculo_id"]
          },
          {
            foreignKeyName: "substituicoes_veiculo_veiculo_novo_id_fkey"
            columns: ["veiculo_novo_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["veiculo_id"]
          },
          {
            foreignKeyName: "substituicoes_veiculo_veiculo_novo_id_fkey"
            columns: ["veiculo_novo_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["veiculo_id"]
          },
          {
            foreignKeyName: "substituicoes_veiculo_veiculo_novo_id_fkey"
            columns: ["veiculo_novo_id"]
            isOneToOne: false
            referencedRelation: "vw_veiculos_com_cotas"
            referencedColumns: ["id"]
          },
        ]
      }
      tabela_precos: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          faixa_valor_max: number
          faixa_valor_min: number
          id: string
          plano_id: string
          updated_at: string | null
          valor_adesao: number | null
          valor_mensalidade: number
          vigencia_fim: string | null
          vigencia_inicio: string
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          faixa_valor_max: number
          faixa_valor_min: number
          id?: string
          plano_id: string
          updated_at?: string | null
          valor_adesao?: number | null
          valor_mensalidade: number
          vigencia_fim?: string | null
          vigencia_inicio?: string
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          faixa_valor_max?: number
          faixa_valor_min?: number
          id?: string
          plano_id?: string
          updated_at?: string | null
          valor_adesao?: number | null
          valor_mensalidade?: number
          vigencia_fim?: string | null
          vigencia_inicio?: string
        }
        Relationships: [
          {
            foreignKeyName: "tabela_precos_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "planos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tabela_precos_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "vw_plans_compat"
            referencedColumns: ["id"]
          },
        ]
      }
      tabelas_preco_mensalidade: {
        Row: {
          categoria: string | null
          combustivel_tipo: string | null
          created_at: string | null
          fipe_max: number
          fipe_min: number
          id: string
          is_active: boolean | null
          linha_slug: string | null
          regiao: string | null
          requer_autorizacao: boolean | null
          tipo_uso: string | null
          valor_desagio: number | null
          valor_mensal: number
        }
        Insert: {
          categoria?: string | null
          combustivel_tipo?: string | null
          created_at?: string | null
          fipe_max: number
          fipe_min: number
          id?: string
          is_active?: boolean | null
          linha_slug?: string | null
          regiao?: string | null
          requer_autorizacao?: boolean | null
          tipo_uso?: string | null
          valor_desagio?: number | null
          valor_mensal: number
        }
        Update: {
          categoria?: string | null
          combustivel_tipo?: string | null
          created_at?: string | null
          fipe_max?: number
          fipe_min?: number
          id?: string
          is_active?: boolean | null
          linha_slug?: string | null
          regiao?: string | null
          requer_autorizacao?: boolean | null
          tipo_uso?: string | null
          valor_desagio?: number | null
          valor_mensal?: number
        }
        Relationships: []
      }
      template_versions: {
        Row: {
          canvas_data: Json | null
          change_description: string | null
          config_layout: Json | null
          conteudo: string | null
          created_at: string | null
          created_by: string | null
          id: string
          template_id: string
          version: number
        }
        Insert: {
          canvas_data?: Json | null
          change_description?: string | null
          config_layout?: Json | null
          conteudo?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          template_id: string
          version: number
        }
        Update: {
          canvas_data?: Json | null
          change_description?: string | null
          config_layout?: Json | null
          conteudo?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          template_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "template_versions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "documento_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      termos_aditivos: {
        Row: {
          ativo: boolean
          conteudo_html: string | null
          created_at: string
          created_by: string | null
          descricao: string | null
          id: string
          nome: string
          ordem: number
          regras: Json
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          conteudo_html?: string | null
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          nome: string
          ordem?: number
          regras?: Json
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          conteudo_html?: string | null
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          ordem?: number
          regras?: Json
          updated_at?: string
        }
        Relationships: []
      }
      treinamentos: {
        Row: {
          carga_horaria: number | null
          certificado_template: string | null
          codigo: string | null
          conteudo: string | null
          created_at: string | null
          data_fim: string | null
          data_inicio: string | null
          id: string
          instrutor_id: string | null
          instrutor_nome: string | null
          instrutor_tipo: string | null
          link_online: string | null
          local_treinamento: string | null
          modalidade: string
          nome: string
          objetivo: string | null
          pre_requisitos: string | null
          publico_alvo: string | null
          status_treinamento: string | null
          tipo: string
          updated_at: string | null
          valor_investimento: number | null
        }
        Insert: {
          carga_horaria?: number | null
          certificado_template?: string | null
          codigo?: string | null
          conteudo?: string | null
          created_at?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          id?: string
          instrutor_id?: string | null
          instrutor_nome?: string | null
          instrutor_tipo?: string | null
          link_online?: string | null
          local_treinamento?: string | null
          modalidade: string
          nome: string
          objetivo?: string | null
          pre_requisitos?: string | null
          publico_alvo?: string | null
          status_treinamento?: string | null
          tipo: string
          updated_at?: string | null
          valor_investimento?: number | null
        }
        Update: {
          carga_horaria?: number | null
          certificado_template?: string | null
          codigo?: string | null
          conteudo?: string | null
          created_at?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          id?: string
          instrutor_id?: string | null
          instrutor_nome?: string | null
          instrutor_tipo?: string | null
          link_online?: string | null
          local_treinamento?: string | null
          modalidade?: string
          nome?: string
          objetivo?: string | null
          pre_requisitos?: string | null
          publico_alvo?: string | null
          status_treinamento?: string | null
          tipo?: string
          updated_at?: string | null
          valor_investimento?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "treinamentos_instrutor_id_fkey"
            columns: ["instrutor_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treinamentos_instrutor_id_fkey"
            columns: ["instrutor_id"]
            isOneToOne: false
            referencedRelation: "view_aniversariantes_mes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treinamentos_instrutor_id_fkey"
            columns: ["instrutor_id"]
            isOneToOne: false
            referencedRelation: "view_funcionarios_ativos"
            referencedColumns: ["id"]
          },
        ]
      }
      treinamentos_participantes: {
        Row: {
          certificado_emitido_em: string | null
          certificado_url: string | null
          created_at: string | null
          funcionario_id: string
          id: string
          nota: number | null
          observacoes: string | null
          presenca_percentual: number | null
          status_participante: string | null
          treinamento_id: string
        }
        Insert: {
          certificado_emitido_em?: string | null
          certificado_url?: string | null
          created_at?: string | null
          funcionario_id: string
          id?: string
          nota?: number | null
          observacoes?: string | null
          presenca_percentual?: number | null
          status_participante?: string | null
          treinamento_id: string
        }
        Update: {
          certificado_emitido_em?: string | null
          certificado_url?: string | null
          created_at?: string | null
          funcionario_id?: string
          id?: string
          nota?: number | null
          observacoes?: string | null
          presenca_percentual?: number | null
          status_participante?: string | null
          treinamento_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "treinamentos_participantes_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treinamentos_participantes_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "view_aniversariantes_mes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treinamentos_participantes_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "view_funcionarios_ativos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treinamentos_participantes_treinamento_id_fkey"
            columns: ["treinamento_id"]
            isOneToOne: false
            referencedRelation: "treinamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      turnos_profissionais: {
        Row: {
          created_at: string | null
          data: string
          encerrado_automaticamente: boolean | null
          fim_almoco: string | null
          fim_turno: string | null
          id: string
          inicio_almoco: string | null
          inicio_turno: string | null
          minutos_almoco: number | null
          minutos_atraso_almoco: number | null
          minutos_extras: number | null
          minutos_faltantes: number | null
          minutos_trabalhados: number | null
          profissional_id: string
          saldo_anterior_minutos: number | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          data: string
          encerrado_automaticamente?: boolean | null
          fim_almoco?: string | null
          fim_turno?: string | null
          id?: string
          inicio_almoco?: string | null
          inicio_turno?: string | null
          minutos_almoco?: number | null
          minutos_atraso_almoco?: number | null
          minutos_extras?: number | null
          minutos_faltantes?: number | null
          minutos_trabalhados?: number | null
          profissional_id: string
          saldo_anterior_minutos?: number | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          data?: string
          encerrado_automaticamente?: boolean | null
          fim_almoco?: string | null
          fim_turno?: string | null
          id?: string
          inicio_almoco?: string | null
          inicio_turno?: string | null
          minutos_almoco?: number | null
          minutos_atraso_almoco?: number | null
          minutos_extras?: number | null
          minutos_faltantes?: number | null
          minutos_trabalhados?: number | null
          profissional_id?: string
          saldo_anterior_minutos?: number | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "turnos_profissionais_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turnos_profissionais_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "turnos_profissionais_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
        ]
      }
      user_module_item_visibility: {
        Row: {
          created_at: string
          id: string
          item_id: string
          module_id: string
          updated_at: string
          user_id: string
          visible: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          module_id: string
          updated_at?: string
          user_id: string
          visible?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          module_id?: string
          updated_at?: string
          user_id?: string
          visible?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "user_module_item_visibility_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_module_item_visibility_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "user_module_item_visibility_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
        ]
      }
      user_module_visibility: {
        Row: {
          can_edit: boolean
          created_at: string
          id: string
          module_id: string
          updated_at: string
          user_id: string
          visible: boolean
        }
        Insert: {
          can_edit?: boolean
          created_at?: string
          id?: string
          module_id: string
          updated_at?: string
          user_id: string
          visible?: boolean
        }
        Update: {
          can_edit?: boolean
          created_at?: string
          id?: string
          module_id?: string
          updated_at?: string
          user_id?: string
          visible?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "user_module_visibility_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_module_visibility_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "user_module_visibility_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      utms: {
        Row: {
          ativo: boolean | null
          campanha_id: string | null
          cliques: number | null
          created_at: string | null
          criado_por: string | null
          id: string
          leads_gerados: number | null
          url_completa: string | null
          url_curta: string | null
          url_destino: string
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string
          utm_term: string | null
        }
        Insert: {
          ativo?: boolean | null
          campanha_id?: string | null
          cliques?: number | null
          created_at?: string | null
          criado_por?: string | null
          id?: string
          leads_gerados?: number | null
          url_completa?: string | null
          url_curta?: string | null
          url_destino: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source: string
          utm_term?: string | null
        }
        Update: {
          ativo?: boolean | null
          campanha_id?: string | null
          cliques?: number | null
          created_at?: string | null
          criado_por?: string | null
          id?: string
          leads_gerados?: number | null
          url_completa?: string | null
          url_curta?: string | null
          url_destino?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string
          utm_term?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "utms_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "campanhas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "utms_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "utms_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "utms_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
        ]
      }
      vagas: {
        Row: {
          atividades: string | null
          beneficios_vaga: string | null
          cargo_id: string | null
          codigo: string | null
          created_at: string | null
          created_by: string | null
          departamento_id: string | null
          encerrado_em: string | null
          gestor_id: string | null
          id: string
          jornada: string | null
          local_trabalho: string | null
          motivo_encerramento: string | null
          publicado_em: string | null
          quantidade: number | null
          requisitos: string | null
          requisitos_desejaveis: string | null
          salario_max: number | null
          salario_min: number | null
          salario_publico: boolean | null
          status_vaga: string | null
          tipo_contrato: string | null
          titulo: string
          updated_at: string | null
          urgencia: string | null
        }
        Insert: {
          atividades?: string | null
          beneficios_vaga?: string | null
          cargo_id?: string | null
          codigo?: string | null
          created_at?: string | null
          created_by?: string | null
          departamento_id?: string | null
          encerrado_em?: string | null
          gestor_id?: string | null
          id?: string
          jornada?: string | null
          local_trabalho?: string | null
          motivo_encerramento?: string | null
          publicado_em?: string | null
          quantidade?: number | null
          requisitos?: string | null
          requisitos_desejaveis?: string | null
          salario_max?: number | null
          salario_min?: number | null
          salario_publico?: boolean | null
          status_vaga?: string | null
          tipo_contrato?: string | null
          titulo: string
          updated_at?: string | null
          urgencia?: string | null
        }
        Update: {
          atividades?: string | null
          beneficios_vaga?: string | null
          cargo_id?: string | null
          codigo?: string | null
          created_at?: string | null
          created_by?: string | null
          departamento_id?: string | null
          encerrado_em?: string | null
          gestor_id?: string | null
          id?: string
          jornada?: string | null
          local_trabalho?: string | null
          motivo_encerramento?: string | null
          publicado_em?: string | null
          quantidade?: number | null
          requisitos?: string | null
          requisitos_desejaveis?: string | null
          salario_max?: number | null
          salario_min?: number | null
          salario_publico?: boolean | null
          status_vaga?: string | null
          tipo_contrato?: string | null
          titulo?: string
          updated_at?: string | null
          urgencia?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vagas_cargo_id_fkey"
            columns: ["cargo_id"]
            isOneToOne: false
            referencedRelation: "cargos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vagas_departamento_id_fkey"
            columns: ["departamento_id"]
            isOneToOne: false
            referencedRelation: "departamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vagas_gestor_id_fkey"
            columns: ["gestor_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vagas_gestor_id_fkey"
            columns: ["gestor_id"]
            isOneToOne: false
            referencedRelation: "view_aniversariantes_mes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vagas_gestor_id_fkey"
            columns: ["gestor_id"]
            isOneToOne: false
            referencedRelation: "view_funcionarios_ativos"
            referencedColumns: ["id"]
          },
        ]
      }
      veiculos: {
        Row: {
          ano_fabricacao: number
          ano_modelo: number
          associado_id: string
          ativo: boolean
          blindado: boolean | null
          chassi: string | null
          cobertura_assistencia: boolean | null
          cobertura_roubo_furto: boolean | null
          cobertura_terceiros: boolean | null
          cobertura_total: boolean | null
          cobertura_vidros: boolean | null
          codigo_fipe: string | null
          codigo_hinova: number | null
          combustivel: string | null
          cor: string | null
          created_at: string
          data_inativacao: string | null
          faixa_cota_id: string | null
          flag_avarias_vistoria: boolean | null
          flag_chassi_remarcado: boolean | null
          flag_ex_ressarcido: boolean | null
          flag_ex_taxi: boolean | null
          flag_leilao: boolean | null
          flag_placa_vermelha: boolean | null
          flag_taxi_ativo: boolean | null
          id: string
          marca: string
          modelo: string
          motivo_inativacao: string | null
          motivo_recusa_veiculo: string | null
          placa: string
          plataforma_app: string | null
          principal: boolean | null
          quantidade_cotas: number | null
          recusado_em: string | null
          recusado_por: string | null
          rede_veiculos_cliente_id: string | null
          rede_veiculos_veiculo_id: string | null
          renavam: string | null
          sincronizado_hinova: boolean | null
          sincronizado_hinova_em: string | null
          softruck_vehicle_id: string | null
          status: Database["public"]["Enums"]["status_veiculo"] | null
          status_sga: string | null
          substituicao_id: string | null
          substituido_por: string | null
          updated_at: string
          uso_aplicativo: boolean | null
          valor_fipe: number | null
          valor_fipe_atualizado_em: string | null
          valor_fipe_cache: number | null
        }
        Insert: {
          ano_fabricacao: number
          ano_modelo: number
          associado_id: string
          ativo?: boolean
          blindado?: boolean | null
          chassi?: string | null
          cobertura_assistencia?: boolean | null
          cobertura_roubo_furto?: boolean | null
          cobertura_terceiros?: boolean | null
          cobertura_total?: boolean | null
          cobertura_vidros?: boolean | null
          codigo_fipe?: string | null
          codigo_hinova?: number | null
          combustivel?: string | null
          cor?: string | null
          created_at?: string
          data_inativacao?: string | null
          faixa_cota_id?: string | null
          flag_avarias_vistoria?: boolean | null
          flag_chassi_remarcado?: boolean | null
          flag_ex_ressarcido?: boolean | null
          flag_ex_taxi?: boolean | null
          flag_leilao?: boolean | null
          flag_placa_vermelha?: boolean | null
          flag_taxi_ativo?: boolean | null
          id?: string
          marca: string
          modelo: string
          motivo_inativacao?: string | null
          motivo_recusa_veiculo?: string | null
          placa: string
          plataforma_app?: string | null
          principal?: boolean | null
          quantidade_cotas?: number | null
          recusado_em?: string | null
          recusado_por?: string | null
          rede_veiculos_cliente_id?: string | null
          rede_veiculos_veiculo_id?: string | null
          renavam?: string | null
          sincronizado_hinova?: boolean | null
          sincronizado_hinova_em?: string | null
          softruck_vehicle_id?: string | null
          status?: Database["public"]["Enums"]["status_veiculo"] | null
          status_sga?: string | null
          substituicao_id?: string | null
          substituido_por?: string | null
          updated_at?: string
          uso_aplicativo?: boolean | null
          valor_fipe?: number | null
          valor_fipe_atualizado_em?: string | null
          valor_fipe_cache?: number | null
        }
        Update: {
          ano_fabricacao?: number
          ano_modelo?: number
          associado_id?: string
          ativo?: boolean
          blindado?: boolean | null
          chassi?: string | null
          cobertura_assistencia?: boolean | null
          cobertura_roubo_furto?: boolean | null
          cobertura_terceiros?: boolean | null
          cobertura_total?: boolean | null
          cobertura_vidros?: boolean | null
          codigo_fipe?: string | null
          codigo_hinova?: number | null
          combustivel?: string | null
          cor?: string | null
          created_at?: string
          data_inativacao?: string | null
          faixa_cota_id?: string | null
          flag_avarias_vistoria?: boolean | null
          flag_chassi_remarcado?: boolean | null
          flag_ex_ressarcido?: boolean | null
          flag_ex_taxi?: boolean | null
          flag_leilao?: boolean | null
          flag_placa_vermelha?: boolean | null
          flag_taxi_ativo?: boolean | null
          id?: string
          marca?: string
          modelo?: string
          motivo_inativacao?: string | null
          motivo_recusa_veiculo?: string | null
          placa?: string
          plataforma_app?: string | null
          principal?: boolean | null
          quantidade_cotas?: number | null
          recusado_em?: string | null
          recusado_por?: string | null
          rede_veiculos_cliente_id?: string | null
          rede_veiculos_veiculo_id?: string | null
          renavam?: string | null
          sincronizado_hinova?: boolean | null
          sincronizado_hinova_em?: string | null
          softruck_vehicle_id?: string | null
          status?: Database["public"]["Enums"]["status_veiculo"] | null
          status_sga?: string | null
          substituicao_id?: string | null
          substituido_por?: string | null
          updated_at?: string
          uso_aplicativo?: boolean | null
          valor_fipe?: number | null
          valor_fipe_atualizado_em?: string | null
          valor_fipe_cache?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "veiculos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "associados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "veiculos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "veiculos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "veiculos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associado_financeiro"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "veiculos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associados_publico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "veiculos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_inadimplentes"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "veiculos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "veiculos_faixa_cota_id_fkey"
            columns: ["faixa_cota_id"]
            isOneToOne: false
            referencedRelation: "faixas_cotas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "veiculos_substituicao_id_fkey"
            columns: ["substituicao_id"]
            isOneToOne: false
            referencedRelation: "substituicoes_veiculo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "veiculos_substituido_por_fkey"
            columns: ["substituido_por"]
            isOneToOne: false
            referencedRelation: "veiculos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "veiculos_substituido_por_fkey"
            columns: ["substituido_por"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["veiculo_id"]
          },
          {
            foreignKeyName: "veiculos_substituido_por_fkey"
            columns: ["substituido_por"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["veiculo_id"]
          },
          {
            foreignKeyName: "veiculos_substituido_por_fkey"
            columns: ["substituido_por"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["veiculo_id"]
          },
          {
            foreignKeyName: "veiculos_substituido_por_fkey"
            columns: ["substituido_por"]
            isOneToOne: false
            referencedRelation: "vw_veiculos_com_cotas"
            referencedColumns: ["id"]
          },
        ]
      }
      vendedores_monitoramento: {
        Row: {
          alertas_confirmados: number | null
          analisado_por: string | null
          created_at: string | null
          id: string
          motivo: string | null
          observacoes: string | null
          score_risco_acumulado: number | null
          status_monitoramento: string | null
          total_alertas: number | null
          ultima_analise: string | null
          updated_at: string | null
          vendedor_id: string
        }
        Insert: {
          alertas_confirmados?: number | null
          analisado_por?: string | null
          created_at?: string | null
          id?: string
          motivo?: string | null
          observacoes?: string | null
          score_risco_acumulado?: number | null
          status_monitoramento?: string | null
          total_alertas?: number | null
          ultima_analise?: string | null
          updated_at?: string | null
          vendedor_id: string
        }
        Update: {
          alertas_confirmados?: number | null
          analisado_por?: string | null
          created_at?: string | null
          id?: string
          motivo?: string | null
          observacoes?: string | null
          score_risco_acumulado?: number | null
          status_monitoramento?: string | null
          total_alertas?: number | null
          ultima_analise?: string | null
          updated_at?: string | null
          vendedor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendedores_monitoramento_analisado_por_fkey"
            columns: ["analisado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendedores_monitoramento_analisado_por_fkey"
            columns: ["analisado_por"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "vendedores_monitoramento_analisado_por_fkey"
            columns: ["analisado_por"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "vendedores_monitoramento_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendedores_monitoramento_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: true
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "vendedores_monitoramento_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: true
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
        ]
      }
      vistoria_fotos: {
        Row: {
          arquivo_url: string
          created_at: string
          id: string
          tipo: string
          visivel_cliente: boolean
          vistoria_id: string
        }
        Insert: {
          arquivo_url: string
          created_at?: string
          id?: string
          tipo: string
          visivel_cliente?: boolean
          vistoria_id: string
        }
        Update: {
          arquivo_url?: string
          created_at?: string
          id?: string
          tipo?: string
          visivel_cliente?: boolean
          vistoria_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vistoria_fotos_vistoria_id_fkey"
            columns: ["vistoria_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["vistoria_id"]
          },
          {
            foreignKeyName: "vistoria_fotos_vistoria_id_fkey"
            columns: ["vistoria_id"]
            isOneToOne: false
            referencedRelation: "vistorias"
            referencedColumns: ["id"]
          },
        ]
      }
      vistoriadores_localizacao: {
        Row: {
          em_servico: boolean | null
          latitude: number
          longitude: number
          precisao_metros: number | null
          updated_at: string | null
          vistoriador_id: string
        }
        Insert: {
          em_servico?: boolean | null
          latitude: number
          longitude: number
          precisao_metros?: number | null
          updated_at?: string | null
          vistoriador_id: string
        }
        Update: {
          em_servico?: boolean | null
          latitude?: number
          longitude?: number
          precisao_metros?: number | null
          updated_at?: string | null
          vistoriador_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vistoriadores_localizacao_vistoriador_id_fkey"
            columns: ["vistoriador_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vistoriadores_localizacao_vistoriador_id_fkey"
            columns: ["vistoriador_id"]
            isOneToOne: true
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "vistoriadores_localizacao_vistoriador_id_fkey"
            columns: ["vistoriador_id"]
            isOneToOne: true
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
        ]
      }
      vistorias: {
        Row: {
          analisado_em: string | null
          analisado_por: string | null
          assinatura_autentique_id: string | null
          assinatura_concluida_em: string | null
          assinatura_documento_url: string | null
          assinatura_enviada_em: string | null
          assinatura_status: string | null
          associado_id: string | null
          avarias: string | null
          chassi_ocr: string | null
          chassi_ocr_confianca: number | null
          chassi_validacao: string | null
          concluida_em: string | null
          contrato_id: string | null
          cotacao_id: string | null
          created_at: string
          dados_parciais: Json | null
          data_agendada: string | null
          data_agendada_original: string | null
          em_rota_em: string | null
          encaixe_executado: boolean | null
          endereco_bairro: string | null
          endereco_cep: string | null
          endereco_cidade: string | null
          endereco_estado: string | null
          endereco_latitude: number | null
          endereco_logradouro: string | null
          endereco_longitude: number | null
          endereco_numero: string | null
          fotos_recusa: string[] | null
          horario_agendado: string | null
          id: string
          imei_rastreador: string | null
          iniciada_em: string | null
          instalacao_id: string | null
          km_atual: number | null
          lead_id: string | null
          local_vistoria: string | null
          modalidade: string | null
          motivo_reprovacao: string | null
          observacoes: string | null
          observacoes_analise: string | null
          origem: string | null
          permite_encaixe: boolean | null
          protocolo: string | null
          ressalvas: string | null
          rota_id: string | null
          sinistro_id: string | null
          status: Database["public"]["Enums"]["status_vistoria"]
          tipo: Database["public"]["Enums"]["tipo_vistoria"]
          updated_at: string
          veiculo_id: string | null
          video_360_url: string | null
          vistoriador_id: string | null
        }
        Insert: {
          analisado_em?: string | null
          analisado_por?: string | null
          assinatura_autentique_id?: string | null
          assinatura_concluida_em?: string | null
          assinatura_documento_url?: string | null
          assinatura_enviada_em?: string | null
          assinatura_status?: string | null
          associado_id?: string | null
          avarias?: string | null
          chassi_ocr?: string | null
          chassi_ocr_confianca?: number | null
          chassi_validacao?: string | null
          concluida_em?: string | null
          contrato_id?: string | null
          cotacao_id?: string | null
          created_at?: string
          dados_parciais?: Json | null
          data_agendada?: string | null
          data_agendada_original?: string | null
          em_rota_em?: string | null
          encaixe_executado?: boolean | null
          endereco_bairro?: string | null
          endereco_cep?: string | null
          endereco_cidade?: string | null
          endereco_estado?: string | null
          endereco_latitude?: number | null
          endereco_logradouro?: string | null
          endereco_longitude?: number | null
          endereco_numero?: string | null
          fotos_recusa?: string[] | null
          horario_agendado?: string | null
          id?: string
          imei_rastreador?: string | null
          iniciada_em?: string | null
          instalacao_id?: string | null
          km_atual?: number | null
          lead_id?: string | null
          local_vistoria?: string | null
          modalidade?: string | null
          motivo_reprovacao?: string | null
          observacoes?: string | null
          observacoes_analise?: string | null
          origem?: string | null
          permite_encaixe?: boolean | null
          protocolo?: string | null
          ressalvas?: string | null
          rota_id?: string | null
          sinistro_id?: string | null
          status?: Database["public"]["Enums"]["status_vistoria"]
          tipo?: Database["public"]["Enums"]["tipo_vistoria"]
          updated_at?: string
          veiculo_id?: string | null
          video_360_url?: string | null
          vistoriador_id?: string | null
        }
        Update: {
          analisado_em?: string | null
          analisado_por?: string | null
          assinatura_autentique_id?: string | null
          assinatura_concluida_em?: string | null
          assinatura_documento_url?: string | null
          assinatura_enviada_em?: string | null
          assinatura_status?: string | null
          associado_id?: string | null
          avarias?: string | null
          chassi_ocr?: string | null
          chassi_ocr_confianca?: number | null
          chassi_validacao?: string | null
          concluida_em?: string | null
          contrato_id?: string | null
          cotacao_id?: string | null
          created_at?: string
          dados_parciais?: Json | null
          data_agendada?: string | null
          data_agendada_original?: string | null
          em_rota_em?: string | null
          encaixe_executado?: boolean | null
          endereco_bairro?: string | null
          endereco_cep?: string | null
          endereco_cidade?: string | null
          endereco_estado?: string | null
          endereco_latitude?: number | null
          endereco_logradouro?: string | null
          endereco_longitude?: number | null
          endereco_numero?: string | null
          fotos_recusa?: string[] | null
          horario_agendado?: string | null
          id?: string
          imei_rastreador?: string | null
          iniciada_em?: string | null
          instalacao_id?: string | null
          km_atual?: number | null
          lead_id?: string | null
          local_vistoria?: string | null
          modalidade?: string | null
          motivo_reprovacao?: string | null
          observacoes?: string | null
          observacoes_analise?: string | null
          origem?: string | null
          permite_encaixe?: boolean | null
          protocolo?: string | null
          ressalvas?: string | null
          rota_id?: string | null
          sinistro_id?: string | null
          status?: Database["public"]["Enums"]["status_vistoria"]
          tipo?: Database["public"]["Enums"]["tipo_vistoria"]
          updated_at?: string
          veiculo_id?: string | null
          video_360_url?: string | null
          vistoriador_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vistorias_analisado_por_fkey"
            columns: ["analisado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vistorias_analisado_por_fkey"
            columns: ["analisado_por"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "vistorias_analisado_por_fkey"
            columns: ["analisado_por"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "vistorias_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "associados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vistorias_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "vistorias_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "vistorias_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associado_financeiro"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "vistorias_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associados_publico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vistorias_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_inadimplentes"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "vistorias_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "vistorias_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vistorias_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["contrato_id"]
          },
          {
            foreignKeyName: "vistorias_cotacao_id_fkey"
            columns: ["cotacao_id"]
            isOneToOne: false
            referencedRelation: "cotacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vistorias_instalacao_id_fkey"
            columns: ["instalacao_id"]
            isOneToOne: false
            referencedRelation: "instalacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vistorias_instalacao_id_fkey"
            columns: ["instalacao_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["instalacao_id"]
          },
          {
            foreignKeyName: "vistorias_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vistorias_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "vistorias_rota_id_fkey"
            columns: ["rota_id"]
            isOneToOne: false
            referencedRelation: "rotas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vistorias_sinistro_id_fkey"
            columns: ["sinistro_id"]
            isOneToOne: false
            referencedRelation: "sinistros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vistorias_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vistorias_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["veiculo_id"]
          },
          {
            foreignKeyName: "vistorias_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["veiculo_id"]
          },
          {
            foreignKeyName: "vistorias_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["veiculo_id"]
          },
          {
            foreignKeyName: "vistorias_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "vw_veiculos_com_cotas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vistorias_vistoriador_id_fkey"
            columns: ["vistoriador_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vistorias_vistoriador_id_fkey"
            columns: ["vistoriador_id"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "vistorias_vistoriador_id_fkey"
            columns: ["vistoriador_id"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
        ]
      }
      vistorias_evento: {
        Row: {
          concluida_em: string | null
          created_at: string
          dados_vistoria: Json | null
          data_agendada: string
          endereco_bairro: string | null
          endereco_cidade: string | null
          endereco_complemento: string | null
          endereco_latitude: number | null
          endereco_longitude: number | null
          endereco_numero: string | null
          endereco_rua: string | null
          horario_agendado: string
          id: string
          iniciada_em: string | null
          link_id: string | null
          observacoes: string | null
          permite_encaixe: boolean
          regulador_id: string | null
          sinistro_id: string
          status: string
          updated_at: string
        }
        Insert: {
          concluida_em?: string | null
          created_at?: string
          dados_vistoria?: Json | null
          data_agendada: string
          endereco_bairro?: string | null
          endereco_cidade?: string | null
          endereco_complemento?: string | null
          endereco_latitude?: number | null
          endereco_longitude?: number | null
          endereco_numero?: string | null
          endereco_rua?: string | null
          horario_agendado: string
          id?: string
          iniciada_em?: string | null
          link_id?: string | null
          observacoes?: string | null
          permite_encaixe?: boolean
          regulador_id?: string | null
          sinistro_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          concluida_em?: string | null
          created_at?: string
          dados_vistoria?: Json | null
          data_agendada?: string
          endereco_bairro?: string | null
          endereco_cidade?: string | null
          endereco_complemento?: string | null
          endereco_latitude?: number | null
          endereco_longitude?: number | null
          endereco_numero?: string | null
          endereco_rua?: string | null
          horario_agendado?: string
          id?: string
          iniciada_em?: string | null
          link_id?: string | null
          observacoes?: string | null
          permite_encaixe?: boolean
          regulador_id?: string | null
          sinistro_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vistorias_evento_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "sinistro_evento_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vistorias_evento_regulador_id_fkey"
            columns: ["regulador_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vistorias_evento_regulador_id_fkey"
            columns: ["regulador_id"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "vistorias_evento_regulador_id_fkey"
            columns: ["regulador_id"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "vistorias_evento_sinistro_id_fkey"
            columns: ["sinistro_id"]
            isOneToOne: false
            referencedRelation: "sinistros"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_fila_ia: {
        Row: {
          created_at: string | null
          erro: string | null
          id: string
          latitude: number | null
          longitude: number | null
          mensagem_id: string | null
          message_id: string | null
          processed_at: string | null
          status: string | null
          telefone: string
          tentativas: number | null
          texto: string | null
          tipo_msg: string | null
        }
        Insert: {
          created_at?: string | null
          erro?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          mensagem_id?: string | null
          message_id?: string | null
          processed_at?: string | null
          status?: string | null
          telefone: string
          tentativas?: number | null
          texto?: string | null
          tipo_msg?: string | null
        }
        Update: {
          created_at?: string | null
          erro?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          mensagem_id?: string | null
          message_id?: string | null
          processed_at?: string | null
          status?: string | null
          telefone?: string
          tentativas?: number | null
          texto?: string | null
          tipo_msg?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_fila_ia_mensagem_id_fkey"
            columns: ["mensagem_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_mensagens"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_instancias: {
        Row: {
          api_url: string
          ativa: boolean | null
          created_at: string | null
          descricao: string | null
          foto_perfil: string | null
          ia_habilitada: boolean
          id: string
          instance_name: string
          nome: string
          nome_perfil: string | null
          principal: boolean | null
          provedor: string | null
          status: string | null
          telefone: string | null
          ultima_conexao: string | null
          updated_at: string | null
          webhook_enabled: boolean | null
          webhook_events: string[] | null
          webhook_url: string | null
        }
        Insert: {
          api_url: string
          ativa?: boolean | null
          created_at?: string | null
          descricao?: string | null
          foto_perfil?: string | null
          ia_habilitada?: boolean
          id?: string
          instance_name: string
          nome: string
          nome_perfil?: string | null
          principal?: boolean | null
          provedor?: string | null
          status?: string | null
          telefone?: string | null
          ultima_conexao?: string | null
          updated_at?: string | null
          webhook_enabled?: boolean | null
          webhook_events?: string[] | null
          webhook_url?: string | null
        }
        Update: {
          api_url?: string
          ativa?: boolean | null
          created_at?: string | null
          descricao?: string | null
          foto_perfil?: string | null
          ia_habilitada?: boolean
          id?: string
          instance_name?: string
          nome?: string
          nome_perfil?: string | null
          principal?: boolean | null
          provedor?: string | null
          status?: string | null
          telefone?: string | null
          ultima_conexao?: string | null
          updated_at?: string | null
          webhook_enabled?: boolean | null
          webhook_events?: string[] | null
          webhook_url?: string | null
        }
        Relationships: []
      }
      whatsapp_logs: {
        Row: {
          created_at: string | null
          erro: string | null
          evento: string | null
          id: string
          instancia_id: string | null
          payload: Json | null
          resposta: Json | null
          tipo: string
        }
        Insert: {
          created_at?: string | null
          erro?: string | null
          evento?: string | null
          id?: string
          instancia_id?: string | null
          payload?: Json | null
          resposta?: Json | null
          tipo: string
        }
        Update: {
          created_at?: string | null
          erro?: string | null
          evento?: string | null
          id?: string
          instancia_id?: string | null
          payload?: Json | null
          resposta?: Json | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_logs_instancia_id_fkey"
            columns: ["instancia_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instancias"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_mensagens: {
        Row: {
          created_at: string | null
          delivered_at: string | null
          direcao: string | null
          enviado_por: string | null
          erro_codigo: string | null
          erro_mensagem: string | null
          id: string
          instancia_id: string | null
          media_filename: string | null
          media_mimetype: string | null
          media_url: string | null
          mensagem: string | null
          message_id: string | null
          nome_contato: string | null
          provedor: string | null
          read_at: string | null
          referencia_id: string | null
          referencia_tipo: string | null
          sent_at: string | null
          status: string | null
          telefone: string
          template_id: string | null
          template_variaveis: Json | null
          tipo: string | null
        }
        Insert: {
          created_at?: string | null
          delivered_at?: string | null
          direcao?: string | null
          enviado_por?: string | null
          erro_codigo?: string | null
          erro_mensagem?: string | null
          id?: string
          instancia_id?: string | null
          media_filename?: string | null
          media_mimetype?: string | null
          media_url?: string | null
          mensagem?: string | null
          message_id?: string | null
          nome_contato?: string | null
          provedor?: string | null
          read_at?: string | null
          referencia_id?: string | null
          referencia_tipo?: string | null
          sent_at?: string | null
          status?: string | null
          telefone: string
          template_id?: string | null
          template_variaveis?: Json | null
          tipo?: string | null
        }
        Update: {
          created_at?: string | null
          delivered_at?: string | null
          direcao?: string | null
          enviado_por?: string | null
          erro_codigo?: string | null
          erro_mensagem?: string | null
          id?: string
          instancia_id?: string | null
          media_filename?: string | null
          media_mimetype?: string | null
          media_url?: string | null
          mensagem?: string | null
          message_id?: string | null
          nome_contato?: string | null
          provedor?: string | null
          read_at?: string | null
          referencia_id?: string | null
          referencia_tipo?: string | null
          sent_at?: string | null
          status?: string | null
          telefone?: string
          template_id?: string | null
          template_variaveis?: Json | null
          tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_mensagens_enviado_por_fkey"
            columns: ["enviado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_mensagens_enviado_por_fkey"
            columns: ["enviado_por"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "whatsapp_mensagens_enviado_por_fkey"
            columns: ["enviado_por"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "whatsapp_mensagens_instancia_id_fkey"
            columns: ["instancia_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instancias"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_meta_config: {
        Row: {
          access_token: string | null
          ativo: boolean | null
          created_at: string | null
          id: string
          last_webhook_at: string | null
          last_webhook_error: string | null
          last_webhook_event: string | null
          last_webhook_messages_count: number | null
          last_webhook_statuses_count: number | null
          phone_number_id: string
          testado: boolean | null
          testado_em: string | null
          updated_at: string | null
          verify_token: string | null
          waba_id: string
        }
        Insert: {
          access_token?: string | null
          ativo?: boolean | null
          created_at?: string | null
          id?: string
          last_webhook_at?: string | null
          last_webhook_error?: string | null
          last_webhook_event?: string | null
          last_webhook_messages_count?: number | null
          last_webhook_statuses_count?: number | null
          phone_number_id?: string
          testado?: boolean | null
          testado_em?: string | null
          updated_at?: string | null
          verify_token?: string | null
          waba_id?: string
        }
        Update: {
          access_token?: string | null
          ativo?: boolean | null
          created_at?: string | null
          id?: string
          last_webhook_at?: string | null
          last_webhook_error?: string | null
          last_webhook_event?: string | null
          last_webhook_messages_count?: number | null
          last_webhook_statuses_count?: number | null
          phone_number_id?: string
          testado?: boolean | null
          testado_em?: string | null
          updated_at?: string | null
          verify_token?: string | null
          waba_id?: string
        }
        Relationships: []
      }
      whatsapp_meta_templates: {
        Row: {
          aprovado_em: string | null
          botoes: Json | null
          categoria: string
          corpo: string
          created_at: string | null
          enviado_em: string | null
          header_texto: string | null
          header_tipo: string | null
          id: string
          idioma: string | null
          meta_template_id: string | null
          motivo_rejeicao: string | null
          nome: string
          rodape: string | null
          status: string | null
          updated_at: string | null
          variaveis_exemplo: Json | null
        }
        Insert: {
          aprovado_em?: string | null
          botoes?: Json | null
          categoria?: string
          corpo: string
          created_at?: string | null
          enviado_em?: string | null
          header_texto?: string | null
          header_tipo?: string | null
          id?: string
          idioma?: string | null
          meta_template_id?: string | null
          motivo_rejeicao?: string | null
          nome: string
          rodape?: string | null
          status?: string | null
          updated_at?: string | null
          variaveis_exemplo?: Json | null
        }
        Update: {
          aprovado_em?: string | null
          botoes?: Json | null
          categoria?: string
          corpo?: string
          created_at?: string | null
          enviado_em?: string | null
          header_texto?: string | null
          header_tipo?: string | null
          id?: string
          idioma?: string | null
          meta_template_id?: string | null
          motivo_rejeicao?: string | null
          nome?: string
          rodape?: string | null
          status?: string | null
          updated_at?: string | null
          variaveis_exemplo?: Json | null
        }
        Relationships: []
      }
      whatsapp_templates: {
        Row: {
          ativo: boolean | null
          categoria: string
          codigo: string
          created_at: string | null
          descricao: string | null
          id: string
          mensagem: string
          nome: string
          updated_at: string | null
          variaveis: string[] | null
        }
        Insert: {
          ativo?: boolean | null
          categoria: string
          codigo: string
          created_at?: string | null
          descricao?: string | null
          id?: string
          mensagem: string
          nome: string
          updated_at?: string | null
          variaveis?: string[] | null
        }
        Update: {
          ativo?: boolean | null
          categoria?: string
          codigo?: string
          created_at?: string | null
          descricao?: string | null
          id?: string
          mensagem?: string
          nome?: string
          updated_at?: string | null
          variaveis?: string[] | null
        }
        Relationships: []
      }
    }
    Views: {
      servicos_pendentes_rota: {
        Row: {
          associado_id: string | null
          associado_nome: string | null
          associado_telefone: string | null
          data_agendada: string | null
          endereco_bairro: string | null
          endereco_cep: string | null
          endereco_cidade: string | null
          endereco_logradouro: string | null
          endereco_numero: string | null
          id: string | null
          marca: string | null
          modelo: string | null
          periodo: Database["public"]["Enums"]["periodo_instalacao"] | null
          placa: string | null
          rota_id: string | null
          tipo_servico: string | null
          tipo_vistoria: string | null
          veiculo_id: string | null
        }
        Relationships: []
      }
      view_acompanhamento: {
        Row: {
          associado_id: string | null
          associado_status:
            | Database["public"]["Enums"]["status_associado"]
            | null
          contrato_adesao_paga: boolean | null
          contrato_data_assinatura: string | null
          contrato_id: string | null
          contrato_status: Database["public"]["Enums"]["status_contrato"] | null
          cotacao_publica_id: string | null
          cotacao_publica_status: string | null
          cpf: string | null
          detalhe_fase: string | null
          docs_aprovados: number | null
          docs_total: number | null
          fase_acompanhamento: string | null
          instalacao_data: string | null
          instalacao_id: string | null
          instalacao_status:
            | Database["public"]["Enums"]["status_instalacao"]
            | null
          lead_id: string | null
          nome: string | null
          telefone: string | null
          updated_at: string | null
          veiculo_ano: number | null
          veiculo_id: string | null
          veiculo_marca: string | null
          veiculo_modelo: string | null
          veiculo_placa: string | null
          veiculo_status: Database["public"]["Enums"]["status_veiculo"] | null
          vendedor_id: string | null
          vendedor_nome: string | null
          vistoria_data: string | null
          vistoria_id: string | null
          vistoria_status: Database["public"]["Enums"]["status_vistoria"] | null
          vistoria_tipo: Database["public"]["Enums"]["tipo_vistoria"] | null
        }
        Relationships: []
      }
      view_alertas_ativos: {
        Row: {
          associado_email: string | null
          associado_id: string | null
          associado_nome: string | null
          associado_telefone: string | null
          created_at: string | null
          dados: Json | null
          horas_aberto: number | null
          id: string | null
          marca: string | null
          mensagem: string | null
          modelo: string | null
          placa: string | null
          plataforma: string | null
          rastreador_codigo: string | null
          rastreador_id: string | null
          severidade: string | null
          status: string | null
          tipo: string | null
          ultima_comunicacao: string | null
          updated_at: string | null
          veiculo_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rastreador_alertas_rastreador_id_fkey"
            columns: ["rastreador_id"]
            isOneToOne: false
            referencedRelation: "rastreadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rastreador_alertas_rastreador_id_fkey"
            columns: ["rastreador_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["rastreador_id"]
          },
        ]
      }
      view_aniversariantes_mes: {
        Row: {
          cargo_nome: string | null
          data_nascimento: string | null
          departamento_nome: string | null
          dia: number | null
          foto_url: string | null
          id: string | null
          nome_completo: string | null
        }
        Relationships: []
      }
      view_associado_financeiro: {
        Row: {
          associado_id: string | null
          associado_status:
            | Database["public"]["Enums"]["status_associado"]
            | null
          cobrancas_pagas: number | null
          cobrancas_pendentes: number | null
          cobrancas_vencidas: number | null
          cpf: string | null
          dias_maior_atraso: number | null
          nome: string | null
          proximo_vencimento: string | null
          total_cobrancas: number | null
          valor_pago: number | null
          valor_pendente: number | null
          valor_vencido: number | null
        }
        Relationships: []
      }
      view_associados_publico: {
        Row: {
          cidade: string | null
          data_adesao: string | null
          data_ativacao: string | null
          id: string | null
          nome: string | null
          plano_id: string | null
          status: Database["public"]["Enums"]["status_associado"] | null
          uf: string | null
        }
        Insert: {
          cidade?: string | null
          data_adesao?: string | null
          data_ativacao?: string | null
          id?: string | null
          nome?: string | null
          plano_id?: string | null
          status?: Database["public"]["Enums"]["status_associado"] | null
          uf?: string | null
        }
        Update: {
          cidade?: string | null
          data_adesao?: string | null
          data_ativacao?: string | null
          id?: string | null
          nome?: string | null
          plano_id?: string | null
          status?: Database["public"]["Enums"]["status_associado"] | null
          uf?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "associados_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "planos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "associados_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "vw_plans_compat"
            referencedColumns: ["id"]
          },
        ]
      }
      view_dashboard_diretoria: {
        Row: {
          assistencias_mes: number | null
          associados_ativos: number | null
          associados_inadimplentes: number | null
          conversoes_mes: number | null
          despesas_mes: number | null
          instalacoes_mes: number | null
          leads_mes: number | null
          receita_mes: number | null
          sinistros_mes: number | null
          valor_sinistros_mes: number | null
        }
        Relationships: []
      }
      view_funcionarios_ativos: {
        Row: {
          agencia: string | null
          bairro: string | null
          banco: string | null
          carga_horaria_semanal: number | null
          cargo_id: string | null
          cargo_nivel: number | null
          cargo_nome: string | null
          celular: string | null
          cep: string | null
          certificado_reservista: string | null
          cidade: string | null
          cnh: string | null
          cnh_categoria: string | null
          cnh_validade: string | null
          complemento: string | null
          conta: string | null
          cpf: string | null
          created_at: string | null
          ctps_numero: string | null
          ctps_serie: string | null
          ctps_uf: string | null
          data_admissao: string | null
          data_demissao: string | null
          data_nascimento: string | null
          departamento_id: string | null
          departamento_nome: string | null
          email_corporativo: string | null
          email_pessoal: string | null
          estado: string | null
          estado_civil: string | null
          foto_url: string | null
          gestor_id: string | null
          gestor_nome: string | null
          horario_entrada: string | null
          horario_saida: string | null
          id: string | null
          intervalo_minutos: number | null
          logradouro: string | null
          matricula: string | null
          motivo_demissao: string | null
          nacionalidade: string | null
          naturalidade: string | null
          nome_completo: string | null
          numero: string | null
          pis: string | null
          pix_chave: string | null
          pix_tipo: string | null
          rg: string | null
          rg_orgao: string | null
          salario_atual: number | null
          secao_eleitoral: string | null
          sexo: string | null
          status: string | null
          telefone: string | null
          tipo_conta: string | null
          tipo_contrato: string | null
          titulo_eleitor: string | null
          updated_at: string | null
          usuario_id: string | null
          zona_eleitoral: string | null
        }
        Relationships: [
          {
            foreignKeyName: "funcionarios_cargo_id_fkey"
            columns: ["cargo_id"]
            isOneToOne: false
            referencedRelation: "cargos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcionarios_departamento_id_fkey"
            columns: ["departamento_id"]
            isOneToOne: false
            referencedRelation: "departamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcionarios_gestor_id_fkey"
            columns: ["gestor_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcionarios_gestor_id_fkey"
            columns: ["gestor_id"]
            isOneToOne: false
            referencedRelation: "view_aniversariantes_mes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcionarios_gestor_id_fkey"
            columns: ["gestor_id"]
            isOneToOne: false
            referencedRelation: "view_funcionarios_ativos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcionarios_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcionarios_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: true
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "funcionarios_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: true
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
        ]
      }
      view_inadimplentes: {
        Row: {
          associado_id: string | null
          contatos_ultimos_30_dias: number | null
          cpf: string | null
          dias_atraso_maximo: number | null
          email: string | null
          faixa_atraso: string | null
          nome: string | null
          qtd_boletos_vencidos: number | null
          status_associado:
            | Database["public"]["Enums"]["status_associado"]
            | null
          telefone: string | null
          ultimo_contato: string | null
          valor_total_divida: number | null
          vencimento_mais_antigo: string | null
          vencimento_mais_recente: string | null
          whatsapp: string | null
        }
        Relationships: []
      }
      view_indicacoes_pendentes: {
        Row: {
          associado_id: string | null
          codigo: string | null
          created_at: string | null
          data_contato: string | null
          data_conversao: string | null
          data_indicacao: string | null
          data_recompensa: string | null
          id: string | null
          indicado_email: string | null
          indicado_nome: string | null
          indicado_telefone: string | null
          indicador_id: string | null
          indicador_nome: string | null
          indicador_nome_completo: string | null
          indicador_telefone: string | null
          indicador_telefone_completo: string | null
          lead_id: string | null
          observacoes: string | null
          programa_id: string | null
          programa_nome: string | null
          recompensa_paga: boolean | null
          status: string | null
          updated_at: string | null
          valor_indicador: number | null
          valor_recompensa: number | null
        }
        Relationships: [
          {
            foreignKeyName: "indicacoes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "associados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "indicacoes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "indicacoes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "indicacoes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associado_financeiro"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "indicacoes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associados_publico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "indicacoes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_inadimplentes"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "indicacoes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "indicacoes_indicador_id_fkey"
            columns: ["indicador_id"]
            isOneToOne: false
            referencedRelation: "associados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "indicacoes_indicador_id_fkey"
            columns: ["indicador_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "indicacoes_indicador_id_fkey"
            columns: ["indicador_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "indicacoes_indicador_id_fkey"
            columns: ["indicador_id"]
            isOneToOne: false
            referencedRelation: "view_associado_financeiro"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "indicacoes_indicador_id_fkey"
            columns: ["indicador_id"]
            isOneToOne: false
            referencedRelation: "view_associados_publico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "indicacoes_indicador_id_fkey"
            columns: ["indicador_id"]
            isOneToOne: false
            referencedRelation: "view_inadimplentes"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "indicacoes_indicador_id_fkey"
            columns: ["indicador_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "indicacoes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "indicacoes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "indicacoes_programa_id_fkey"
            columns: ["programa_id"]
            isOneToOne: false
            referencedRelation: "programa_indicacao"
            referencedColumns: ["id"]
          },
        ]
      }
      view_movimentacoes_diarias: {
        Row: {
          conta_bancaria_id: string | null
          data_lancamento: string | null
          qtd_conciliados: number | null
          qtd_lancamentos: number | null
          saldo_dia: number | null
          total_creditos: number | null
          total_debitos: number | null
        }
        Relationships: [
          {
            foreignKeyName: "movimentacoes_bancarias_conta_bancaria_id_fkey"
            columns: ["conta_bancaria_id"]
            isOneToOne: false
            referencedRelation: "contas_bancarias"
            referencedColumns: ["id"]
          },
        ]
      }
      view_performance_canais: {
        Row: {
          conversoes: number | null
          cpl_medio: number | null
          id: string | null
          investimento_total: number | null
          nome: string | null
          taxa_conversao: number | null
          tipo: string | null
          total_leads: number | null
        }
        Relationships: []
      }
      view_prazos_proximos: {
        Row: {
          data_fim: string | null
          descricao: string | null
          id: string | null
          parte_contraria_nome: string | null
          prioridade: string | null
          processo_cnj: string | null
          processo_numero: string | null
          processo_tipo: string | null
          responsavel_id: string | null
          responsavel_nome: string | null
          status: string | null
          urgencia: string | null
        }
        Relationships: [
          {
            foreignKeyName: "processos_prazos_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processos_prazos_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "processos_prazos_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
        ]
      }
      view_rastreadores_posicao: {
        Row: {
          ano_modelo: number | null
          associado_email: string | null
          associado_id: string | null
          associado_nome: string | null
          associado_telefone: string | null
          codigo: string | null
          cor: string | null
          horas_sem_comunicacao: number | null
          id_plataforma: string | null
          ignicao: boolean | null
          imei: string | null
          latitude: number | null
          longitude: number | null
          marca: string | null
          modelo: string | null
          numero_serie: string | null
          placa: string | null
          plataforma: string | null
          rastreador_id: string | null
          status: Database["public"]["Enums"]["status_rastreador"] | null
          status_comunicacao: string | null
          ultima_comunicacao: string | null
          veiculo_id: string | null
          velocidade: number | null
        }
        Relationships: []
      }
      view_vistorias_mapa: {
        Row: {
          associado_nome: string | null
          associado_telefone: string | null
          associado_whatsapp: string | null
          data_agendada: string | null
          endereco_bairro: string | null
          endereco_cep: string | null
          endereco_cidade: string | null
          endereco_logradouro: string | null
          endereco_numero: string | null
          horario_agendado: string | null
          id: string | null
          latitude: number | null
          longitude: number | null
          rota_codigo: string | null
          rota_cor: string | null
          rota_id: string | null
          rota_regiao: string | null
          status: string | null
          tipo_servico: string | null
          tipo_vistoria: string | null
          veiculo_cor: string | null
          veiculo_marca: string | null
          veiculo_modelo: string | null
          veiculo_placa: string | null
          vistoriador_id: string | null
          vistoriador_nome: string | null
        }
        Relationships: []
      }
      vw_cc_vendedor_saldo: {
        Row: {
          a_receber_mes: number | null
          antecipacoes_abertas: number | null
          saldo_atual: number | null
          vendedor_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cc_vendedor_lancamentos_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cc_vendedor_lancamentos_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vw_metricas_vendedores"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "cc_vendedor_lancamentos_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vw_vendedores_conflito"
            referencedColumns: ["vendedor_id"]
          },
        ]
      }
      vw_cpfs_duplicados: {
        Row: {
          cpf: string | null
          nomes_usados: string[] | null
          qtd_vendedores: number | null
          total_leads: number | null
          ultimo_lead: string | null
          vendedores_ids: string[] | null
        }
        Relationships: []
      }
      vw_custo_real_adicionais: {
        Row: {
          beneficio_id: string | null
          categoria: string | null
          codigo: string | null
          custo_real: number | null
          gasto_total_60d: number | null
          indicador: string | null
          margem: number | null
          nome: string | null
          preco_sugerido: number | null
          qtd_utilizacoes_60d: number | null
          tipo_beneficio: string | null
          total_associados: number | null
          total_cotas: number | null
          total_veiculos: number | null
          variacao_por_cota: boolean | null
        }
        Relationships: []
      }
      vw_custo_real_benefits: {
        Row: {
          beneficio_id: string | null
          categoria: string | null
          codigo: string | null
          custo_real: number | null
          gasto_total_60d: number | null
          indicador: string | null
          margem: number | null
          nome: string | null
          preco_sugerido: number | null
          qtd_utilizacoes_60d: number | null
          tipo_beneficio: string | null
          total_associados: number | null
          total_cotas: number | null
        }
        Relationships: []
      }
      vw_metricas_vendedores: {
        Row: {
          cotacoes_abandonadas: number | null
          cotacoes_aceitas: number | null
          leads_em_andamento: number | null
          leads_ganhos: number | null
          leads_perdidos: number | null
          score_risco_acumulado: number | null
          status_monitoramento: string | null
          taxa_conversao: number | null
          taxa_perda: number | null
          total_cotacoes: number | null
          total_leads: number | null
          vendedor_id: string | null
          vendedor_nome: string | null
        }
        Relationships: []
      }
      vw_plans_compat: {
        Row: {
          additional_price: number | null
          badge_color: string | null
          badge_text: string | null
          cota_app_min: number | null
          cota_app_percent: number | null
          cota_desagio_min: number | null
          cota_desagio_percent: number | null
          cota_passeio_min: number | null
          cota_passeio_percent: number | null
          coverage_type: string | null
          created_at: string | null
          display_order: number | null
          footer_note: string | null
          id: string | null
          is_active: boolean | null
          min_vehicle_year: string | null
          name: string | null
          product_line_id: string | null
          restriction_alert: string | null
          slug: string | null
          tipo_uso: string | null
          updated_at: string | null
        }
        Insert: {
          additional_price?: number | null
          badge_color?: string | null
          badge_text?: string | null
          cota_app_min?: number | null
          cota_app_percent?: number | null
          cota_desagio_min?: number | null
          cota_desagio_percent?: number | null
          cota_passeio_min?: number | null
          cota_passeio_percent?: number | null
          coverage_type?: string | null
          created_at?: string | null
          display_order?: never
          footer_note?: string | null
          id?: string | null
          is_active?: boolean | null
          min_vehicle_year?: never
          name?: string | null
          product_line_id?: string | null
          restriction_alert?: string | null
          slug?: never
          tipo_uso?: never
          updated_at?: string | null
        }
        Update: {
          additional_price?: number | null
          badge_color?: string | null
          badge_text?: string | null
          cota_app_min?: number | null
          cota_app_percent?: number | null
          cota_desagio_min?: number | null
          cota_desagio_percent?: number | null
          cota_passeio_min?: number | null
          cota_passeio_percent?: number | null
          coverage_type?: string | null
          created_at?: string | null
          display_order?: never
          footer_note?: string | null
          id?: string | null
          is_active?: boolean | null
          min_vehicle_year?: never
          name?: string | null
          product_line_id?: string | null
          restriction_alert?: string | null
          slug?: never
          tipo_uso?: never
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "planos_product_line_id_fkey"
            columns: ["product_line_id"]
            isOneToOne: false
            referencedRelation: "product_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_veiculos_com_cotas: {
        Row: {
          associado_id: string | null
          cobertura_assistencia: boolean | null
          cobertura_roubo_furto: boolean | null
          cobertura_terceiros: boolean | null
          cobertura_total: boolean | null
          cobertura_vidros: boolean | null
          cotas_calculadas: number | null
          faixa_cota_id: string | null
          fipe_ate: number | null
          fipe_de: number | null
          id: string | null
          placa: string | null
          status: Database["public"]["Enums"]["status_veiculo"] | null
          valor_fipe: number | null
        }
        Relationships: [
          {
            foreignKeyName: "veiculos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "associados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "veiculos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "veiculos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "veiculos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associado_financeiro"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "veiculos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associados_publico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "veiculos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_inadimplentes"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "veiculos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "veiculos_faixa_cota_id_fkey"
            columns: ["faixa_cota_id"]
            isOneToOne: false
            referencedRelation: "faixas_cotas"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_vendedores_conflito: {
        Row: {
          associacoes_envolvidas: string[] | null
          email: string | null
          indicios_confirmados: number | null
          indicios_pendentes: number | null
          nome: string | null
          score_total: number | null
          total_indicios: number | null
          ultimo_indicio: string | null
          vendedor_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      adicionar_fila_cobranca: {
        Args: {
          p_associado_id: string
          p_cobranca_id: string
          p_motivo: string
          p_prioridade?: number
        }
        Returns: string
      }
      am_i_associado: { Args: never; Returns: boolean }
      am_i_funcionario: { Args: never; Returns: boolean }
      am_i_gerencia: { Args: never; Returns: boolean }
      am_i_prestador: { Args: never; Returns: boolean }
      am_i_vendedor: { Args: never; Returns: boolean }
      atribuir_lead_automaticamente: {
        Args: { p_lead_id: string }
        Returns: string
      }
      atualizar_cobrancas_vencidas: { Args: never; Returns: number }
      atualizar_parcelas_vencidas: { Args: never; Returns: number }
      atualizar_valor_os: { Args: { os_id: string }; Returns: undefined }
      buscar_tarefa_atual_profissional: {
        Args: { p_profissional_id: string }
        Returns: {
          associado_id: string
          associado_nome: string
          associado_telefone: string
          associado_whatsapp: string
          bairro: string
          cep: string
          cidade: string
          confirmacao_whatsapp: string
          confirmado_via_whatsapp_em: string
          contato_realizado_em: string
          contato_tipo: string
          contrato_id: string
          cor: string
          cotacao_id: string
          data_agendada: string
          em_rota_em: string
          etapa_atual: number
          hora_agendada: string
          id: string
          imei_rastreador: string
          iniciada_em: string
          instalacao_origem_id: string
          latitude: number
          local_vistoria: string
          logradouro: string
          longitude: number
          marca: string
          modelo: string
          numero: string
          observacoes: string
          periodo: string
          permite_encaixe: boolean
          placa: string
          rastreador_id: string
          rota_id: string
          status: string
          tipo: string
          uf: string
          veiculo_id: string
          vistoria_origem_id: string
        }[]
      }
      buscar_tarefa_atual_vistoriador: {
        Args: { p_vistoriador_id: string }
        Returns: {
          associado_id: string
          associado_nome: string
          associado_telefone: string
          bairro: string
          cidade: string
          data_agendada: string
          endereco_latitude: number
          endereco_longitude: number
          hora_agendada: string
          id: string
          logradouro: string
          numero: string
          rota_id: string
          status: string
          tipo: string
          uf: string
          veiculo_id: string
          veiculo_marca: string
          veiculo_modelo: string
          veiculo_placa: string
        }[]
      }
      calcular_comissao_contrato: {
        Args: { p_contrato_id: string }
        Returns: string
      }
      calcular_sinistralidade: {
        Args: { p_ano: number; p_mes: number }
        Returns: {
          frequencia: number
          sinistralidade: number
          ticket_medio: number
        }[]
      }
      can_access_api_settings: { Args: { _user_id: string }; Returns: boolean }
      can_create_contracts: { Args: { _user_id: string }; Returns: boolean }
      can_manage_juridico: { Args: { _user_id: string }; Returns: boolean }
      can_manage_marketing: { Args: { _user_id: string }; Returns: boolean }
      can_manage_permissions: { Args: { _user_id: string }; Returns: boolean }
      confirmar_encaixe_urgente: {
        Args: { p_encaixe_id: string; p_profissional_id: string }
        Returns: boolean
      }
      expirar_encaixes_urgentes: { Args: never; Returns: number }
      fn_calcular_bonificacao_adesao: {
        Args: {
          p_ano: number
          p_campanha_id?: string
          p_mes: number
          p_vendedor_id: string
        }
        Returns: Json
      }
      fn_calcular_custo_beneficio: {
        Args: { p_beneficio_id: string; p_tipo?: string }
        Returns: {
          beneficio_id: string
          custo_real: number
          gasto_total_60d: number
          indicador: string
          margem: number
          preco_sugerido: number
          total_cotas: number
        }[]
      }
      fn_calcular_producao: {
        Args: { p_ano: number; p_mes: number; p_vendedor_id: string }
        Returns: Json
      }
      fn_calcular_prorata: {
        Args: {
          p_ano: number
          p_data_adesao: string
          p_data_saida: string
          p_mes: number
        }
        Returns: number
      }
      fn_calcular_ranking_campanha: {
        Args: { p_campanha_id: string }
        Returns: undefined
      }
      fn_calcular_rateio_por_cotas: {
        Args: { p_custo_total: number; p_percentual_fundo?: number }
        Returns: {
          ajuste_percentual: number
          contratos_na_faixa: number
          faixa_id: string
          fipe_ate: number
          fipe_de: number
          quantidade_cotas: number
          total_cotas_faixa: number
          valor_base_cota: number
          valor_final_cota: number
        }[]
      }
      fn_calcular_recorrente: {
        Args: { p_ano: number; p_mes: number; p_vendedor_id: string }
        Returns: Json
      }
      fn_calcular_total_cotas_ativos: { Args: never; Returns: number }
      fn_calcular_valor_por_cota_beneficio: {
        Args: { p_fechamento_id: string; p_tipo_beneficio: string }
        Returns: {
          quantidade_associados: number
          total_cotas: number
          valor_por_cota: number
          valor_total: number
        }[]
      }
      fn_fechamento_mensal_comissoes: {
        Args: { p_ano: number; p_mes: number; p_usuario_id?: string }
        Returns: Json
      }
      fn_get_cotas_por_fipe: { Args: { p_valor_fipe: number }; Returns: number }
      fn_get_cotas_veiculo: { Args: { p_veiculo_id: string }; Returns: number }
      fn_limpar_tokens_expirados: { Args: never; Returns: undefined }
      fn_parametro_comissao: { Args: { p_chave: string }; Returns: number }
      fn_placas_ativas_consultor: {
        Args: { p_vendedor_id: string }
        Returns: number
      }
      fn_resumo_saude_beneficios: {
        Args: never
        Returns: {
          equilibrio: number
          prejuizo: number
          sem_dados: number
          superavit: number
          total_beneficios: number
        }[]
      }
      fn_tempo_casa_consultor: {
        Args: { p_vendedor_id: string }
        Returns: string
      }
      fn_tipo_consultor: { Args: { p_vendedor_id: string }; Returns: string }
      fn_verificar_almoco_profissional: {
        Args: { p_profissional_id: string }
        Returns: boolean
      }
      fn_verificar_crescimento: {
        Args: { p_vendedor_id: string }
        Returns: Json
      }
      fn_verificar_fim_almoco_profissional: {
        Args: { p_profissional_id: string }
        Returns: boolean
      }
      fn_verificar_recorde: {
        Args: { p_ano: number; p_mes: number; p_vendedor_id: string }
        Returns: Json
      }
      gerar_hash_lancamento: {
        Args: {
          p_conta_id: string
          p_data: string
          p_descricao: string
          p_documento: string
          p_valor: number
        }
        Returns: string
      }
      get_alertas_contagem: {
        Args: never
        Returns: {
          abertos: number
          criticos: number
          total: number
          visualizados: number
        }[]
      }
      get_associado_id_for_user: {
        Args: { p_auth_user_id: string }
        Returns: string
      }
      get_current_profile_id: { Args: never; Returns: string }
      get_estatisticas_assistencia_dia: {
        Args: { p_data?: string }
        Returns: Json
      }
      get_estatisticas_cobrancas_mes: {
        Args: { p_ano: number; p_mes: number }
        Returns: Json
      }
      get_estatisticas_prestador: {
        Args: { p_prestador_id: string }
        Returns: Json
      }
      get_my_associado_id: { Args: { _user_id: string }; Returns: string }
      get_my_perfis: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"][]
      }
      get_my_profile_id: { Args: never; Returns: string }
      get_my_tipo: {
        Args: never
        Returns: Database["public"]["Enums"]["tipo_usuario"]
      }
      get_profile_id_for_auth: { Args: { auth_uid: string }; Returns: string }
      get_proximo_vendedor_distribuicao: { Args: never; Returns: string }
      get_ultimas_posicoes: {
        Args: never
        Returns: {
          associado_nome: string
          associado_telefone: string
          codigo: string
          data_posicao: string
          horas_sem_comunicacao: number
          ignicao: boolean
          latitude: number
          longitude: number
          placa: string
          rastreador_id: string
          status_comunicacao: string
          velocidade: number
        }[]
      }
      get_user_perfis: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"][]
      }
      get_user_tipo: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["tipo_usuario"]
      }
      get_visible_modules: { Args: { _user_id: string }; Returns: string[] }
      has_permission: {
        Args: { _permission: string; _user_id: string }
        Returns: boolean
      }
      has_role:
        | {
            Args: {
              _role: Database["public"]["Enums"]["app_role"]
              _user_id: string
            }
            Returns: boolean
          }
        | { Args: { _role: string; _user_id: string }; Returns: boolean }
      is_admin_master: { Args: { _user_id: string }; Returns: boolean }
      is_associado: { Args: { _user_id: string }; Returns: boolean }
      is_desenvolvedor: { Args: { _user_id: string }; Returns: boolean }
      is_diretor: { Args: { _user_id: string }; Returns: boolean }
      is_diretor_for_crud: { Args: { _user_id: string }; Returns: boolean }
      is_diretor_or_admin: { Args: { _user_id: string }; Returns: boolean }
      is_funcionario: { Args: { _user_id: string }; Returns: boolean }
      is_gerencia: { Args: { _user_id: string }; Returns: boolean }
      is_prestador: { Args: { _user_id: string }; Returns: boolean }
      is_sindicante_of_sinistro: {
        Args: { _sinistro_id: string }
        Returns: boolean
      }
      is_supervisor_of: { Args: { _vendedor_id: string }; Returns: boolean }
      is_vendedor: { Args: { _user_id: string }; Returns: boolean }
      log_auth_event: {
        Args: {
          p_acao: string
          p_email?: string
          p_ip?: string
          p_metadata?: Json
          p_user_agent?: string
        }
        Returns: string
      }
      map_to_status_servico: {
        Args: { p_status: string }
        Returns: Database["public"]["Enums"]["status_servico"]
      }
      map_vistoria_tipo_to_servico: {
        Args: { p_tipo: string }
        Returns: Database["public"]["Enums"]["tipo_servico"]
      }
      processar_template: {
        Args: { p_template_id: string; p_variaveis: Json }
        Returns: string
      }
      reservar_encaixe_urgente: {
        Args: { p_encaixe_id: string; p_profissional_id: string }
        Returns: boolean
      }
      resetar_contadores_distribuicao: { Args: never; Returns: undefined }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      verificar_acordos_quebrados: { Args: never; Returns: number }
    }
    Enums: {
      app_role:
        | "diretor"
        | "gerente_comercial"
        | "supervisor_vendas"
        | "vendedor_clt"
        | "vendedor_externo"
        | "analista_cadastro"
        | "coordenador_monitoramento"
        | "analista_plataforma"
        | "instalador_vistoriador"
        | "associado"
        | "analista_marketing"
        | "analista_juridico"
        | "desenvolvedor"
        | "admin_master"
        | "agencia"
        | "admin"
        | "vistoriador_base"
        | "regulador"
        | "analista_eventos"
        | "advogado"
        | "sindicante"
      cc_status_lancamento:
        | "pendente"
        | "a_pagar"
        | "pago"
        | "antecipado"
        | "cancelado"
        | "em_abatimento"
      cc_tipo_lancamento: "credito" | "debito"
      etapa_lead:
        | "novo"
        | "contato_inicial"
        | "apresentacao"
        | "cotacao_enviada"
        | "negociacao"
        | "vistoria_agendada"
        | "contrato_enviado"
        | "contrato_assinado"
        | "instalacao_agendada"
        | "ganho"
        | "perdido"
        | "contato"
        | "qualificado"
      forma_pagamento_oficina: "pix" | "transferencia" | "boleto" | "cheque"
      motivo_perda:
        | "preco"
        | "concorrencia"
        | "desistiu"
        | "nao_qualificado"
        | "veiculo_reprovado"
        | "nao_respondeu"
        | "outro"
      origem_lead:
        | "indicacao"
        | "site"
        | "facebook"
        | "instagram"
        | "google"
        | "telefone"
        | "presencial"
        | "parceiro"
        | "outro"
        | "api"
        | "whatsapp"
        | "cotador"
      periodo_instalacao: "manha" | "tarde" | "noite"
      periodo_servico: "manha" | "tarde" | "noite"
      status_associado:
        | "em_analise"
        | "pendente_vistoria"
        | "aprovado"
        | "documentacao_pendente"
        | "aguardando_instalacao"
        | "ativo"
        | "inadimplente"
        | "suspenso"
        | "cancelado"
        | "bloqueado"
        | "recusado"
      status_chamado:
        | "aberto"
        | "em_atendimento"
        | "em_deslocamento"
        | "concluido"
        | "cancelado"
        | "aguardando_prestador"
        | "prestador_despachado"
        | "prestador_a_caminho"
        | "cancelado_associado"
        | "cancelado_sistema"
      status_contrato:
        | "rascunho"
        | "pendente"
        | "enviado"
        | "assinado"
        | "ativo"
        | "suspenso"
        | "cancelado"
        | "visualizado"
        | "expirado"
        | "pendente_assinatura"
      status_cotacao:
        | "rascunho"
        | "enviada"
        | "aceita"
        | "recusada"
        | "expirada"
      status_documento:
        | "pendente"
        | "em_analise"
        | "aprovado"
        | "reprovado"
        | "expirado"
      status_instalacao:
        | "agendada"
        | "em_rota"
        | "em_andamento"
        | "concluida"
        | "reagendada"
        | "cancelada"
        | "em_analise"
        | "nao_compareceu"
      status_oficina: "ativo" | "inativo" | "suspenso" | "bloqueado"
      status_ordem_servico:
        | "rascunho"
        | "aguardando_entrada"
        | "aguardando_orcamento"
        | "orcamento_enviado"
        | "aguardando_aprovacao"
        | "aprovado"
        | "em_execucao"
        | "aguardando_peca"
        | "concluido"
        | "aguardando_pagamento"
        | "pago"
        | "cancelado"
        | "pendente_assinatura"
        | "finalizado"
        | "entregue"
      status_pagamento_oficina:
        | "pendente"
        | "processando"
        | "pago"
        | "cancelado"
      status_rastreador:
        | "estoque"
        | "reservado"
        | "instalado"
        | "manutencao"
        | "reagendar_manutencao"
        | "baixado"
        | "retorno_base"
        | "triagem"
        | "em_analise_plataforma"
        | "em_garantia"
        | "retirada_pendente"
      status_rota: "pendente" | "em_andamento" | "concluida" | "cancelada"
      status_servico:
        | "pendente"
        | "agendada"
        | "em_rota"
        | "em_andamento"
        | "concluida"
        | "aprovada"
        | "reprovada"
        | "aprovada_ressalvas"
        | "em_analise"
        | "reagendada"
        | "cancelada"
        | "nao_compareceu"
        | "imprevisto_pendente"
      status_sinistro:
        | "em_analise"
        | "aprovado"
        | "reprovado"
        | "indenizado"
        | "cancelado"
        | "comunicado"
        | "documentacao_pendente"
        | "aguardando_vistoria"
        | "em_vistoria"
        | "aguardando_parecer"
        | "negado"
        | "em_regulacao"
        | "em_reparo"
        | "pago"
        | "encerrado"
        | "em_sindicancia"
        | "em_pericia"
        | "suspenso"
        | "analise_interna"
        | "aguardando_cota"
        | "aguardando_termo"
        | "em_garantia"
        | "em_recuperacao"
        | "aguardando_analise"
        | "pagamento_confirmado"
        | "pronto_para_oficina"
        | "aguardando_diretoria"
        | "aguardando_juridico"
        | "aguardando_confirmacoes"
        | "em_oficina"
        | "aguardando_peca"
        | "em_finalizacao"
        | "concluido"
        | "entregue"
        | "finalizado"
        | "aguardando_indenizacao"
        | "aguardando_pagamento"
        | "pecas_em_cotacao"
      status_veiculo:
        | "em_analise"
        | "aprovado"
        | "instalacao_pendente"
        | "ativo"
        | "suspenso"
        | "cancelado"
        | "sinistrado"
        | "recusado"
      status_vistoria:
        | "pendente"
        | "aprovada"
        | "reprovada"
        | "em_analise"
        | "agendada"
        | "cancelada"
        | "em_rota"
        | "em_andamento"
        | "concluida"
      template_status: "draft" | "active" | "archived"
      tipo_documento:
        | "cnh"
        | "crlv"
        | "comprovante_residencia"
        | "foto_frontal_veiculo"
        | "foto_traseira_veiculo"
        | "foto_lateral_esquerda"
        | "foto_lateral_direita"
        | "foto_painel"
        | "foto_hodometro"
        | "outro"
        | "selfie_veiculo"
        | "frente"
        | "traseira"
        | "lateral_direita"
        | "lateral_esquerda"
        | "odometro"
        | "chassi"
        | "motor"
        | "banco_dianteiro"
        | "banco_traseiro"
        | "pneu_dianteiro_direito"
        | "pneu_dianteiro_esquerdo"
        | "pneu_traseiro_direito"
        | "pneu_traseiro_esquerdo"
        | "laudo_vistoria"
      tipo_foto_os: "entrada" | "execucao" | "conclusao"
      tipo_item_os: "peca" | "mao_de_obra" | "servico_terceiro"
      tipo_pix: "cpf" | "cnpj" | "email" | "telefone" | "aleatoria"
      tipo_reprovacao:
        | "vistoria_reprovada"
        | "proposta_reprovada"
        | "associado_bloqueado"
      tipo_servico:
        | "instalacao"
        | "vistoria_entrada"
        | "vistoria_saida"
        | "vistoria_sinistro"
        | "vistoria_periodica"
        | "vistoria_manutencao"
        | "vistoria_retirada"
      tipo_sinistro:
        | "roubo"
        | "furto"
        | "colisao"
        | "incendio"
        | "alagamento"
        | "outro"
        | "fenomeno_natural"
        | "vidros"
        | "terceiros"
      tipo_usuario: "funcionario" | "associado" | "prestador"
      tipo_vistoria: "entrada" | "saida" | "sinistro"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "diretor",
        "gerente_comercial",
        "supervisor_vendas",
        "vendedor_clt",
        "vendedor_externo",
        "analista_cadastro",
        "coordenador_monitoramento",
        "analista_plataforma",
        "instalador_vistoriador",
        "associado",
        "analista_marketing",
        "analista_juridico",
        "desenvolvedor",
        "admin_master",
        "agencia",
        "admin",
        "vistoriador_base",
        "regulador",
        "analista_eventos",
        "advogado",
        "sindicante",
      ],
      cc_status_lancamento: [
        "pendente",
        "a_pagar",
        "pago",
        "antecipado",
        "cancelado",
        "em_abatimento",
      ],
      cc_tipo_lancamento: ["credito", "debito"],
      etapa_lead: [
        "novo",
        "contato_inicial",
        "apresentacao",
        "cotacao_enviada",
        "negociacao",
        "vistoria_agendada",
        "contrato_enviado",
        "contrato_assinado",
        "instalacao_agendada",
        "ganho",
        "perdido",
        "contato",
        "qualificado",
      ],
      forma_pagamento_oficina: ["pix", "transferencia", "boleto", "cheque"],
      motivo_perda: [
        "preco",
        "concorrencia",
        "desistiu",
        "nao_qualificado",
        "veiculo_reprovado",
        "nao_respondeu",
        "outro",
      ],
      origem_lead: [
        "indicacao",
        "site",
        "facebook",
        "instagram",
        "google",
        "telefone",
        "presencial",
        "parceiro",
        "outro",
        "api",
        "whatsapp",
        "cotador",
      ],
      periodo_instalacao: ["manha", "tarde", "noite"],
      periodo_servico: ["manha", "tarde", "noite"],
      status_associado: [
        "em_analise",
        "pendente_vistoria",
        "aprovado",
        "documentacao_pendente",
        "aguardando_instalacao",
        "ativo",
        "inadimplente",
        "suspenso",
        "cancelado",
        "bloqueado",
        "recusado",
      ],
      status_chamado: [
        "aberto",
        "em_atendimento",
        "em_deslocamento",
        "concluido",
        "cancelado",
        "aguardando_prestador",
        "prestador_despachado",
        "prestador_a_caminho",
        "cancelado_associado",
        "cancelado_sistema",
      ],
      status_contrato: [
        "rascunho",
        "pendente",
        "enviado",
        "assinado",
        "ativo",
        "suspenso",
        "cancelado",
        "visualizado",
        "expirado",
        "pendente_assinatura",
      ],
      status_cotacao: ["rascunho", "enviada", "aceita", "recusada", "expirada"],
      status_documento: [
        "pendente",
        "em_analise",
        "aprovado",
        "reprovado",
        "expirado",
      ],
      status_instalacao: [
        "agendada",
        "em_rota",
        "em_andamento",
        "concluida",
        "reagendada",
        "cancelada",
        "em_analise",
        "nao_compareceu",
      ],
      status_oficina: ["ativo", "inativo", "suspenso", "bloqueado"],
      status_ordem_servico: [
        "rascunho",
        "aguardando_entrada",
        "aguardando_orcamento",
        "orcamento_enviado",
        "aguardando_aprovacao",
        "aprovado",
        "em_execucao",
        "aguardando_peca",
        "concluido",
        "aguardando_pagamento",
        "pago",
        "cancelado",
        "pendente_assinatura",
        "finalizado",
        "entregue",
      ],
      status_pagamento_oficina: [
        "pendente",
        "processando",
        "pago",
        "cancelado",
      ],
      status_rastreador: [
        "estoque",
        "reservado",
        "instalado",
        "manutencao",
        "reagendar_manutencao",
        "baixado",
        "retorno_base",
        "triagem",
        "em_analise_plataforma",
        "em_garantia",
        "retirada_pendente",
      ],
      status_rota: ["pendente", "em_andamento", "concluida", "cancelada"],
      status_servico: [
        "pendente",
        "agendada",
        "em_rota",
        "em_andamento",
        "concluida",
        "aprovada",
        "reprovada",
        "aprovada_ressalvas",
        "em_analise",
        "reagendada",
        "cancelada",
        "nao_compareceu",
        "imprevisto_pendente",
      ],
      status_sinistro: [
        "em_analise",
        "aprovado",
        "reprovado",
        "indenizado",
        "cancelado",
        "comunicado",
        "documentacao_pendente",
        "aguardando_vistoria",
        "em_vistoria",
        "aguardando_parecer",
        "negado",
        "em_regulacao",
        "em_reparo",
        "pago",
        "encerrado",
        "em_sindicancia",
        "em_pericia",
        "suspenso",
        "analise_interna",
        "aguardando_cota",
        "aguardando_termo",
        "em_garantia",
        "em_recuperacao",
        "aguardando_analise",
        "pagamento_confirmado",
        "pronto_para_oficina",
        "aguardando_diretoria",
        "aguardando_juridico",
        "aguardando_confirmacoes",
        "em_oficina",
        "aguardando_peca",
        "em_finalizacao",
        "concluido",
        "entregue",
        "finalizado",
        "aguardando_indenizacao",
        "aguardando_pagamento",
        "pecas_em_cotacao",
      ],
      status_veiculo: [
        "em_analise",
        "aprovado",
        "instalacao_pendente",
        "ativo",
        "suspenso",
        "cancelado",
        "sinistrado",
        "recusado",
      ],
      status_vistoria: [
        "pendente",
        "aprovada",
        "reprovada",
        "em_analise",
        "agendada",
        "cancelada",
        "em_rota",
        "em_andamento",
        "concluida",
      ],
      template_status: ["draft", "active", "archived"],
      tipo_documento: [
        "cnh",
        "crlv",
        "comprovante_residencia",
        "foto_frontal_veiculo",
        "foto_traseira_veiculo",
        "foto_lateral_esquerda",
        "foto_lateral_direita",
        "foto_painel",
        "foto_hodometro",
        "outro",
        "selfie_veiculo",
        "frente",
        "traseira",
        "lateral_direita",
        "lateral_esquerda",
        "odometro",
        "chassi",
        "motor",
        "banco_dianteiro",
        "banco_traseiro",
        "pneu_dianteiro_direito",
        "pneu_dianteiro_esquerdo",
        "pneu_traseiro_direito",
        "pneu_traseiro_esquerdo",
        "laudo_vistoria",
      ],
      tipo_foto_os: ["entrada", "execucao", "conclusao"],
      tipo_item_os: ["peca", "mao_de_obra", "servico_terceiro"],
      tipo_pix: ["cpf", "cnpj", "email", "telefone", "aleatoria"],
      tipo_reprovacao: [
        "vistoria_reprovada",
        "proposta_reprovada",
        "associado_bloqueado",
      ],
      tipo_servico: [
        "instalacao",
        "vistoria_entrada",
        "vistoria_saida",
        "vistoria_sinistro",
        "vistoria_periodica",
        "vistoria_manutencao",
        "vistoria_retirada",
      ],
      tipo_sinistro: [
        "roubo",
        "furto",
        "colisao",
        "incendio",
        "alagamento",
        "outro",
        "fenomeno_natural",
        "vidros",
        "terceiros",
      ],
      tipo_usuario: ["funcionario", "associado", "prestador"],
      tipo_vistoria: ["entrada", "saida", "sinistro"],
    },
  },
} as const
