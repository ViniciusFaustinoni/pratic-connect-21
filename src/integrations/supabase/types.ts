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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      adicionais: {
        Row: {
          created_at: string | null
          descricao: string | null
          id: string
          is_active: boolean | null
          nome: string
          ordem: number | null
          updated_at: string | null
          valor: number
        }
        Insert: {
          created_at?: string | null
          descricao?: string | null
          id?: string
          is_active?: boolean | null
          nome: string
          ordem?: number | null
          updated_at?: string | null
          valor?: number
        }
        Update: {
          created_at?: string | null
          descricao?: string | null
          id?: string
          is_active?: boolean | null
          nome?: string
          ordem?: number | null
          updated_at?: string | null
          valor?: number
        }
        Relationships: []
      }
      associados: {
        Row: {
          bairro: string | null
          categoria_cnh: string | null
          cep: string | null
          cidade: string | null
          cnh: string | null
          codigo_beneficiario: string | null
          codigo_estado_civil: string | null
          codigo_hinova: string
          codigo_regional: string | null
          codigo_situacao: string | null
          complemento: string | null
          cpf: string | null
          created_at: string | null
          data_cadastro: string | null
          data_contrato: string | null
          data_expedicao_rg: string | null
          data_nascimento: string | null
          data_vencimento_cnh: string | null
          descricao_situacao: string | null
          dia_vencimento: string | null
          email: string | null
          email_auxiliar: string | null
          estado: string | null
          filhos: number | null
          id: string
          logradouro: string | null
          nome: string | null
          nome_mae: string | null
          nome_pai: string | null
          numero: string | null
          orgao_expedidor_rg: string | null
          pontos: number | null
          rg: string | null
          sexo: string | null
          sincronizado_em: string | null
          spc_serasa: string | null
          telefone_celular: string | null
          telefone_celular_aux: string | null
          telefone_comercial: string | null
          telefone_fixo: string | null
          updated_at: string | null
        }
        Insert: {
          bairro?: string | null
          categoria_cnh?: string | null
          cep?: string | null
          cidade?: string | null
          cnh?: string | null
          codigo_beneficiario?: string | null
          codigo_estado_civil?: string | null
          codigo_hinova: string
          codigo_regional?: string | null
          codigo_situacao?: string | null
          complemento?: string | null
          cpf?: string | null
          created_at?: string | null
          data_cadastro?: string | null
          data_contrato?: string | null
          data_expedicao_rg?: string | null
          data_nascimento?: string | null
          data_vencimento_cnh?: string | null
          descricao_situacao?: string | null
          dia_vencimento?: string | null
          email?: string | null
          email_auxiliar?: string | null
          estado?: string | null
          filhos?: number | null
          id?: string
          logradouro?: string | null
          nome?: string | null
          nome_mae?: string | null
          nome_pai?: string | null
          numero?: string | null
          orgao_expedidor_rg?: string | null
          pontos?: number | null
          rg?: string | null
          sexo?: string | null
          sincronizado_em?: string | null
          spc_serasa?: string | null
          telefone_celular?: string | null
          telefone_celular_aux?: string | null
          telefone_comercial?: string | null
          telefone_fixo?: string | null
          updated_at?: string | null
        }
        Update: {
          bairro?: string | null
          categoria_cnh?: string | null
          cep?: string | null
          cidade?: string | null
          cnh?: string | null
          codigo_beneficiario?: string | null
          codigo_estado_civil?: string | null
          codigo_hinova?: string
          codigo_regional?: string | null
          codigo_situacao?: string | null
          complemento?: string | null
          cpf?: string | null
          created_at?: string | null
          data_cadastro?: string | null
          data_contrato?: string | null
          data_expedicao_rg?: string | null
          data_nascimento?: string | null
          data_vencimento_cnh?: string | null
          descricao_situacao?: string | null
          dia_vencimento?: string | null
          email?: string | null
          email_auxiliar?: string | null
          estado?: string | null
          filhos?: number | null
          id?: string
          logradouro?: string | null
          nome?: string | null
          nome_mae?: string | null
          nome_pai?: string | null
          numero?: string | null
          orgao_expedidor_rg?: string | null
          pontos?: number | null
          rg?: string | null
          sexo?: string | null
          sincronizado_em?: string | null
          spc_serasa?: string | null
          telefone_celular?: string | null
          telefone_celular_aux?: string | null
          telefone_comercial?: string | null
          telefone_fixo?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      atendimentos: {
        Row: {
          codigo_associado: string | null
          codigo_departamento: string | null
          codigo_fornecedor: string | null
          codigo_hinova: string
          codigo_status_atendimento: string | null
          codigo_terceiro: string | null
          codigo_tipo_atendimento: string | null
          codigo_usuario: string | null
          codigo_veiculo: string | null
          cpf_associado: string | null
          cpf_usuario: string | null
          created_at: string | null
          data_cadastro: string | null
          descricao: string | null
          descricao_departamento: string | null
          descricao_status_atendimento: string | null
          descricao_tipo_atendimento: string | null
          hora_cadastro: string | null
          id: string
          nome_associado: string | null
          nome_usuario: string | null
          placa: string | null
          sincronizado_em: string | null
          titulo: string | null
          updated_at: string | null
          valor_atendimento: number | null
        }
        Insert: {
          codigo_associado?: string | null
          codigo_departamento?: string | null
          codigo_fornecedor?: string | null
          codigo_hinova: string
          codigo_status_atendimento?: string | null
          codigo_terceiro?: string | null
          codigo_tipo_atendimento?: string | null
          codigo_usuario?: string | null
          codigo_veiculo?: string | null
          cpf_associado?: string | null
          cpf_usuario?: string | null
          created_at?: string | null
          data_cadastro?: string | null
          descricao?: string | null
          descricao_departamento?: string | null
          descricao_status_atendimento?: string | null
          descricao_tipo_atendimento?: string | null
          hora_cadastro?: string | null
          id?: string
          nome_associado?: string | null
          nome_usuario?: string | null
          placa?: string | null
          sincronizado_em?: string | null
          titulo?: string | null
          updated_at?: string | null
          valor_atendimento?: number | null
        }
        Update: {
          codigo_associado?: string | null
          codigo_departamento?: string | null
          codigo_fornecedor?: string | null
          codigo_hinova?: string
          codigo_status_atendimento?: string | null
          codigo_terceiro?: string | null
          codigo_tipo_atendimento?: string | null
          codigo_usuario?: string | null
          codigo_veiculo?: string | null
          cpf_associado?: string | null
          cpf_usuario?: string | null
          created_at?: string | null
          data_cadastro?: string | null
          descricao?: string | null
          descricao_departamento?: string | null
          descricao_status_atendimento?: string | null
          descricao_tipo_atendimento?: string | null
          hora_cadastro?: string | null
          id?: string
          nome_associado?: string | null
          nome_usuario?: string | null
          placa?: string | null
          sincronizado_em?: string | null
          titulo?: string | null
          updated_at?: string | null
          valor_atendimento?: number | null
        }
        Relationships: []
      }
      beneficios: {
        Row: {
          classificacao_beneficio: string | null
          codigo_hinova: string
          compulsorio: string | null
          created_at: string | null
          descricao_beneficio: string | null
          id: string
          id_classificacaobeneficio: number | null
          idade_beneficiario_final: number | null
          idade_beneficiario_inicial: number | null
          padrao: string | null
          sincronizado_em: string | null
          situacao: string | null
          updated_at: string | null
          valor_beneficio: number | null
        }
        Insert: {
          classificacao_beneficio?: string | null
          codigo_hinova: string
          compulsorio?: string | null
          created_at?: string | null
          descricao_beneficio?: string | null
          id?: string
          id_classificacaobeneficio?: number | null
          idade_beneficiario_final?: number | null
          idade_beneficiario_inicial?: number | null
          padrao?: string | null
          sincronizado_em?: string | null
          situacao?: string | null
          updated_at?: string | null
          valor_beneficio?: number | null
        }
        Update: {
          classificacao_beneficio?: string | null
          codigo_hinova?: string
          compulsorio?: string | null
          created_at?: string | null
          descricao_beneficio?: string | null
          id?: string
          id_classificacaobeneficio?: number | null
          idade_beneficiario_final?: number | null
          idade_beneficiario_inicial?: number | null
          padrao?: string | null
          sincronizado_em?: string | null
          situacao?: string | null
          updated_at?: string | null
          valor_beneficio?: number | null
        }
        Relationships: []
      }
      boletos: {
        Row: {
          asaas_customer_id: string | null
          asaas_id: string | null
          asaas_subscription_id: string | null
          codigo_associado_hinova: string | null
          codigo_barras: string | null
          codigo_hinova: string
          codigo_situacao: string | null
          codigo_tipo_boleto: string | null
          cpf_cnpj_associado: string | null
          created_at: string | null
          data_pagamento: string | null
          data_vencimento: string | null
          data_vencimento_original: string | null
          descricao_situacao: string | null
          forma_pagamento: string | null
          id: string
          linha_digitavel: string | null
          link_boleto: string | null
          mes_referente: string | null
          nome_associado: string | null
          nosso_numero: string | null
          pix_copia_cola: string | null
          pix_qr_code: string | null
          sincronizado_em: string | null
          status: string | null
          tipo_boleto: string | null
          updated_at: string | null
          valor: number | null
          valor_desconto: number | null
          valor_juros: number | null
          valor_multa: number | null
          valor_pago: number | null
        }
        Insert: {
          asaas_customer_id?: string | null
          asaas_id?: string | null
          asaas_subscription_id?: string | null
          codigo_associado_hinova?: string | null
          codigo_barras?: string | null
          codigo_hinova: string
          codigo_situacao?: string | null
          codigo_tipo_boleto?: string | null
          cpf_cnpj_associado?: string | null
          created_at?: string | null
          data_pagamento?: string | null
          data_vencimento?: string | null
          data_vencimento_original?: string | null
          descricao_situacao?: string | null
          forma_pagamento?: string | null
          id?: string
          linha_digitavel?: string | null
          link_boleto?: string | null
          mes_referente?: string | null
          nome_associado?: string | null
          nosso_numero?: string | null
          pix_copia_cola?: string | null
          pix_qr_code?: string | null
          sincronizado_em?: string | null
          status?: string | null
          tipo_boleto?: string | null
          updated_at?: string | null
          valor?: number | null
          valor_desconto?: number | null
          valor_juros?: number | null
          valor_multa?: number | null
          valor_pago?: number | null
        }
        Update: {
          asaas_customer_id?: string | null
          asaas_id?: string | null
          asaas_subscription_id?: string | null
          codigo_associado_hinova?: string | null
          codigo_barras?: string | null
          codigo_hinova?: string
          codigo_situacao?: string | null
          codigo_tipo_boleto?: string | null
          cpf_cnpj_associado?: string | null
          created_at?: string | null
          data_pagamento?: string | null
          data_vencimento?: string | null
          data_vencimento_original?: string | null
          descricao_situacao?: string | null
          forma_pagamento?: string | null
          id?: string
          linha_digitavel?: string | null
          link_boleto?: string | null
          mes_referente?: string | null
          nome_associado?: string | null
          nosso_numero?: string | null
          pix_copia_cola?: string | null
          pix_qr_code?: string | null
          sincronizado_em?: string | null
          status?: string | null
          tipo_boleto?: string | null
          updated_at?: string | null
          valor?: number | null
          valor_desconto?: number | null
          valor_juros?: number | null
          valor_multa?: number | null
          valor_pago?: number | null
        }
        Relationships: []
      }
      brazilian_states: {
        Row: {
          code: string
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
        }
        Insert: {
          code: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
        }
        Update: {
          code?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
        }
        Relationships: []
      }
      CHAT: {
        Row: {
          account_id: number | null
          content: string | null
          content_attributes: Json | null
          content_type: string | null
          conversation_id: number | null
          created_at: string | null
          external_source_ids: Json | null
          id: number | null
          inbox_id: number | null
          message_type: string | null
          private: boolean | null
          processed_message_content: string | null
          sender_id: number | null
          sender_type: string | null
          source_id: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          account_id?: number | null
          content?: string | null
          content_attributes?: Json | null
          content_type?: string | null
          conversation_id?: number | null
          created_at?: string | null
          external_source_ids?: Json | null
          id?: number | null
          inbox_id?: number | null
          message_type?: string | null
          private?: boolean | null
          processed_message_content?: string | null
          sender_id?: number | null
          sender_type?: string | null
          source_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          account_id?: number | null
          content?: string | null
          content_attributes?: Json | null
          content_type?: string | null
          conversation_id?: number | null
          created_at?: string | null
          external_source_ids?: Json | null
          id?: number | null
          inbox_id?: number | null
          message_type?: string | null
          private?: boolean | null
          processed_message_content?: string | null
          sender_id?: number | null
          sender_type?: string | null
          source_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      classificacoes_associado: {
        Row: {
          codigo_hinova: string
          created_at: string | null
          descricao: string
          id: string
          sincronizado_em: string | null
          situacao: string | null
          updated_at: string | null
        }
        Insert: {
          codigo_hinova: string
          created_at?: string | null
          descricao: string
          id?: string
          sincronizado_em?: string | null
          situacao?: string | null
          updated_at?: string | null
        }
        Update: {
          codigo_hinova?: string
          created_at?: string | null
          descricao?: string
          id?: string
          sincronizado_em?: string | null
          situacao?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      combustiveis: {
        Row: {
          codigo_hinova: string
          created_at: string | null
          descricao: string
          id: string
          sincronizado_em: string | null
          updated_at: string | null
        }
        Insert: {
          codigo_hinova: string
          created_at?: string | null
          descricao: string
          id?: string
          sincronizado_em?: string | null
          updated_at?: string | null
        }
        Update: {
          codigo_hinova?: string
          created_at?: string | null
          descricao?: string
          id?: string
          sincronizado_em?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      cooperativas_dados: {
        Row: {
          bairro: string | null
          cep: string | null
          cidade: string | null
          codigo_hinova: string
          complemento: string | null
          contato: string | null
          cpf: string | null
          created_at: string | null
          email: string | null
          estado: string | null
          formato_pagamento: string | null
          formato_pagamento_residual: string | null
          id: string
          logradouro: string | null
          nome: string | null
          numero: string | null
          sincronizado_em: string | null
          situacao: string | null
          telefone: string | null
          updated_at: string | null
          valor_pagamento: number | null
          valor_pagamento_residual: number | null
        }
        Insert: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          codigo_hinova: string
          complemento?: string | null
          contato?: string | null
          cpf?: string | null
          created_at?: string | null
          email?: string | null
          estado?: string | null
          formato_pagamento?: string | null
          formato_pagamento_residual?: string | null
          id?: string
          logradouro?: string | null
          nome?: string | null
          numero?: string | null
          sincronizado_em?: string | null
          situacao?: string | null
          telefone?: string | null
          updated_at?: string | null
          valor_pagamento?: number | null
          valor_pagamento_residual?: number | null
        }
        Update: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          codigo_hinova?: string
          complemento?: string | null
          contato?: string | null
          cpf?: string | null
          created_at?: string | null
          email?: string | null
          estado?: string | null
          formato_pagamento?: string | null
          formato_pagamento_residual?: string | null
          id?: string
          logradouro?: string | null
          nome?: string | null
          numero?: string | null
          sincronizado_em?: string | null
          situacao?: string | null
          telefone?: string | null
          updated_at?: string | null
          valor_pagamento?: number | null
          valor_pagamento_residual?: number | null
        }
        Relationships: []
      }
      cooperatives: {
        Row: {
          address: string | null
          city: string | null
          cnpj: string | null
          created_at: string | null
          email: string | null
          id: string
          is_active: boolean | null
          name: string
          phone: string | null
          state: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          cnpj?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          phone?: string | null
          state?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          cnpj?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          phone?: string | null
          state?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      cores_veiculo: {
        Row: {
          codigo_hinova: string
          created_at: string | null
          descricao: string
          id: string
          sincronizado_em: string | null
          updated_at: string | null
        }
        Insert: {
          codigo_hinova: string
          created_at?: string | null
          descricao: string
          id?: string
          sincronizado_em?: string | null
          updated_at?: string | null
        }
        Update: {
          codigo_hinova?: string
          created_at?: string | null
          descricao?: string
          id?: string
          sincronizado_em?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      crm_api_keys: {
        Row: {
          api_key: string
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          last_used_at: string | null
          name: string
          request_count: number | null
        }
        Insert: {
          api_key?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          name: string
          request_count?: number | null
        }
        Update: {
          api_key?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          name?: string
          request_count?: number | null
        }
        Relationships: []
      }
      crm_distribution_queue: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          queue_position: number
          user_id: string | null
          user_name: string | null
          voluntario_codigo_hinova: string
          voluntario_nome: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          queue_position: number
          user_id?: string | null
          user_name?: string | null
          voluntario_codigo_hinova: string
          voluntario_nome: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          queue_position?: number
          user_id?: string | null
          user_name?: string | null
          voluntario_codigo_hinova?: string
          voluntario_nome?: string
        }
        Relationships: []
      }
      crm_hinova_defaults: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          key: string
          updated_at: string | null
          value: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          key: string
          updated_at?: string | null
          value: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          key?: string
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      crm_incoming_leads: {
        Row: {
          api_key_id: string | null
          assigned_to_voluntario: string | null
          created_at: string | null
          deal_id: string | null
          error_message: string | null
          id: string
          processed: boolean | null
          raw_data: Json
        }
        Insert: {
          api_key_id?: string | null
          assigned_to_voluntario?: string | null
          created_at?: string | null
          deal_id?: string | null
          error_message?: string | null
          id?: string
          processed?: boolean | null
          raw_data: Json
        }
        Update: {
          api_key_id?: string | null
          assigned_to_voluntario?: string | null
          created_at?: string | null
          deal_id?: string | null
          error_message?: string | null
          id?: string
          processed?: boolean | null
          raw_data?: Json
        }
        Relationships: [
          {
            foreignKeyName: "crm_incoming_leads_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "crm_api_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_incoming_leads_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_lead_distribution_config: {
        Row: {
          distribution_mode: string | null
          id: string
          is_enabled: boolean | null
          last_assigned_index: number | null
          updated_at: string | null
        }
        Insert: {
          distribution_mode?: string | null
          id?: string
          is_enabled?: boolean | null
          last_assigned_index?: number | null
          updated_at?: string | null
        }
        Update: {
          distribution_mode?: string | null
          id?: string
          is_enabled?: boolean | null
          last_assigned_index?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      crm_payment_days_config: {
        Row: {
          created_at: string | null
          day: number
          id: string
          is_active: boolean | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          day: number
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          day?: number
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      deal_activities: {
        Row: {
          activity_type: string
          assigned_to: string | null
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          deal_id: string | null
          description: string | null
          id: string
          scheduled_at: string | null
          title: string
        }
        Insert: {
          activity_type: string
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          deal_id?: string | null
          description?: string | null
          id?: string
          scheduled_at?: string | null
          title: string
        }
        Update: {
          activity_type?: string
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          deal_id?: string | null
          description?: string | null
          id?: string
          scheduled_at?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_activities_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_attachments: {
        Row: {
          created_at: string | null
          deal_id: string | null
          document_type: string | null
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
        }
        Insert: {
          created_at?: string | null
          deal_id?: string | null
          document_type?: string | null
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
        }
        Update: {
          created_at?: string | null
          deal_id?: string | null
          document_type?: string | null
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_attachments_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_history: {
        Row: {
          action: string
          created_at: string | null
          deal_id: string | null
          description: string | null
          field_name: string | null
          id: string
          new_value: string | null
          old_value: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          deal_id?: string | null
          description?: string | null
          field_name?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          deal_id?: string | null
          description?: string | null
          field_name?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_history_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_inspection_photos: {
        Row: {
          created_at: string
          file_path: string
          file_url: string
          id: string
          inspection_id: string | null
          is_cancelled: boolean | null
          latitude: number | null
          location_accuracy: number | null
          longitude: number | null
          photo_label: string
          photo_type: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_path: string
          file_url: string
          id?: string
          inspection_id?: string | null
          is_cancelled?: boolean | null
          latitude?: number | null
          location_accuracy?: number | null
          longitude?: number | null
          photo_label: string
          photo_type: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_path?: string
          file_url?: string
          id?: string
          inspection_id?: string | null
          is_cancelled?: boolean | null
          latitude?: number | null
          location_accuracy?: number | null
          longitude?: number | null
          photo_label?: string
          photo_type?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_inspection_photos_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "deal_inspections"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_inspections: {
        Row: {
          accepts_early_slot: boolean | null
          acessorios: string[] | null
          ai_observations: string | null
          avaliado_at: string | null
          avaliador_nome: string | null
          avaliador_observacoes: string | null
          avaliador_parecer: string | null
          chassi_remarcado: boolean | null
          claimed_at: string | null
          claimed_by_inspector_id: string | null
          completed_at: string | null
          contact_phone: string | null
          created_at: string | null
          deal_id: string | null
          encaixe_deadline_at: string | null
          id: string
          inspection_type: string | null
          inspector_id: string | null
          is_priority_encaixe: boolean | null
          is_tracker_installation: boolean | null
          location_address: string | null
          location_city: string | null
          location_lat: number | null
          location_lng: number | null
          location_neighborhood: string | null
          location_state: string | null
          notes: string | null
          odometer_reading: string | null
          pdf_generated_at: string | null
          pdf_url: string | null
          possui_gnv: boolean | null
          scheduled_at: string | null
          started_at: string | null
          status: string | null
          tracker_id: string | null
          tracker_install_location: string | null
          tracker_opinion: string | null
          tracker_opinion_audio_url: string | null
          vistoriador_rejection_notes: string | null
          vistoriador_started_location_lat: number | null
          vistoriador_started_location_lng: number | null
        }
        Insert: {
          accepts_early_slot?: boolean | null
          acessorios?: string[] | null
          ai_observations?: string | null
          avaliado_at?: string | null
          avaliador_nome?: string | null
          avaliador_observacoes?: string | null
          avaliador_parecer?: string | null
          chassi_remarcado?: boolean | null
          claimed_at?: string | null
          claimed_by_inspector_id?: string | null
          completed_at?: string | null
          contact_phone?: string | null
          created_at?: string | null
          deal_id?: string | null
          encaixe_deadline_at?: string | null
          id?: string
          inspection_type?: string | null
          inspector_id?: string | null
          is_priority_encaixe?: boolean | null
          is_tracker_installation?: boolean | null
          location_address?: string | null
          location_city?: string | null
          location_lat?: number | null
          location_lng?: number | null
          location_neighborhood?: string | null
          location_state?: string | null
          notes?: string | null
          odometer_reading?: string | null
          pdf_generated_at?: string | null
          pdf_url?: string | null
          possui_gnv?: boolean | null
          scheduled_at?: string | null
          started_at?: string | null
          status?: string | null
          tracker_id?: string | null
          tracker_install_location?: string | null
          tracker_opinion?: string | null
          tracker_opinion_audio_url?: string | null
          vistoriador_rejection_notes?: string | null
          vistoriador_started_location_lat?: number | null
          vistoriador_started_location_lng?: number | null
        }
        Update: {
          accepts_early_slot?: boolean | null
          acessorios?: string[] | null
          ai_observations?: string | null
          avaliado_at?: string | null
          avaliador_nome?: string | null
          avaliador_observacoes?: string | null
          avaliador_parecer?: string | null
          chassi_remarcado?: boolean | null
          claimed_at?: string | null
          claimed_by_inspector_id?: string | null
          completed_at?: string | null
          contact_phone?: string | null
          created_at?: string | null
          deal_id?: string | null
          encaixe_deadline_at?: string | null
          id?: string
          inspection_type?: string | null
          inspector_id?: string | null
          is_priority_encaixe?: boolean | null
          is_tracker_installation?: boolean | null
          location_address?: string | null
          location_city?: string | null
          location_lat?: number | null
          location_lng?: number | null
          location_neighborhood?: string | null
          location_state?: string | null
          notes?: string | null
          odometer_reading?: string | null
          pdf_generated_at?: string | null
          pdf_url?: string | null
          possui_gnv?: boolean | null
          scheduled_at?: string | null
          started_at?: string | null
          status?: string | null
          tracker_id?: string | null
          tracker_install_location?: string | null
          tracker_opinion?: string | null
          tracker_opinion_audio_url?: string | null
          vistoriador_rejection_notes?: string | null
          vistoriador_started_location_lat?: number | null
          vistoriador_started_location_lng?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_inspections_claimed_by_inspector_id_fkey"
            columns: ["claimed_by_inspector_id"]
            isOneToOne: false
            referencedRelation: "vistoriadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_inspections_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_quotes: {
        Row: {
          accepted_at: string | null
          chassis: string | null
          created_at: string | null
          deal_id: string | null
          depreciation: string | null
          fipe_code: string | null
          fipe_value: number | null
          id: string
          manufacture_year: string | null
          protected_value: number | null
          renavam: string | null
          sent_at: string | null
          status: string | null
          viewed_count: number | null
        }
        Insert: {
          accepted_at?: string | null
          chassis?: string | null
          created_at?: string | null
          deal_id?: string | null
          depreciation?: string | null
          fipe_code?: string | null
          fipe_value?: number | null
          id?: string
          manufacture_year?: string | null
          protected_value?: number | null
          renavam?: string | null
          sent_at?: string | null
          status?: string | null
          viewed_count?: number | null
        }
        Update: {
          accepted_at?: string | null
          chassis?: string | null
          created_at?: string | null
          deal_id?: string | null
          depreciation?: string | null
          fipe_code?: string | null
          fipe_value?: number | null
          id?: string
          manufacture_year?: string | null
          protected_value?: number | null
          renavam?: string | null
          sent_at?: string | null
          status?: string | null
          viewed_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_quotes_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_viewers: {
        Row: {
          deal_id: string
          id: string
          last_heartbeat: string | null
          user_id: string
          user_name: string
          viewing_since: string | null
        }
        Insert: {
          deal_id: string
          id?: string
          last_heartbeat?: string | null
          user_id: string
          user_name: string
          viewing_since?: string | null
        }
        Update: {
          deal_id?: string
          id?: string
          last_heartbeat?: string | null
          user_id?: string
          user_name?: string
          viewing_since?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_viewers_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          analysis_approved_at: string | null
          analysis_observations: string | null
          analysis_rejected_at: string | null
          ano_fabricacao: string | null
          asaas_customer_id: string | null
          assigned_to: string | null
          bairro: string | null
          birth_date: string | null
          brand: string | null
          cep: string | null
          chassis: string | null
          city: string | null
          cnh: string | null
          cnh_category: string | null
          cnh_expiry_date: string | null
          cnh_first_date: string | null
          code: string
          codigo_associado: string | null
          codigo_combustivel: number | null
          codigo_como_conheceu: number | null
          codigo_consultor: number | null
          codigo_conta: number | null
          codigo_cooperativa: number | null
          codigo_cor: number | null
          codigo_cota: number | null
          codigo_profissao: number | null
          codigo_regional: number | null
          codigo_tipo_veiculo: number | null
          codigo_veiculo: string | null
          codigo_veiculo_vinculado: number | null
          commission: number | null
          complemento: string | null
          consultor_id: string | null
          contact_name: string
          contacted_at: string | null
          contacted_via: string | null
          cooperative: string | null
          cpf_cnpj: string | null
          created_at: string | null
          dia_vencimento: number | null
          email: string | null
          fipe_code: string | null
          fipe_value: number | null
          fuel_type: string | null
          gender: string | null
          has_rejection_alert: boolean | null
          home_phone: string | null
          id: string
          inadimplente: boolean | null
          is_agregado: boolean | null
          is_work_vehicle: boolean | null
          kilometragem: number | null
          lead_source: string | null
          license_plate: string | null
          logradouro: string | null
          model: string | null
          numero_endereco: string | null
          numero_motor: string | null
          observacao_veiculo: string | null
          phone: string | null
          phone2: string | null
          quantidade_portas: number | null
          registration_completed_at: string | null
          registration_observations: string | null
          renavam: string | null
          rg: string | null
          rg_issue_date: string | null
          rg_issuer: string | null
          send_quote_email: boolean | null
          stage_id: string | null
          state: string | null
          tipo_cambio: string | null
          updated_at: string | null
          user_id: string
          value: number | null
          vehicle_color: string | null
          vehicle_type: string | null
          work_phone: string | null
          year_model: string | null
        }
        Insert: {
          analysis_approved_at?: string | null
          analysis_observations?: string | null
          analysis_rejected_at?: string | null
          ano_fabricacao?: string | null
          asaas_customer_id?: string | null
          assigned_to?: string | null
          bairro?: string | null
          birth_date?: string | null
          brand?: string | null
          cep?: string | null
          chassis?: string | null
          city?: string | null
          cnh?: string | null
          cnh_category?: string | null
          cnh_expiry_date?: string | null
          cnh_first_date?: string | null
          code: string
          codigo_associado?: string | null
          codigo_combustivel?: number | null
          codigo_como_conheceu?: number | null
          codigo_consultor?: number | null
          codigo_conta?: number | null
          codigo_cooperativa?: number | null
          codigo_cor?: number | null
          codigo_cota?: number | null
          codigo_profissao?: number | null
          codigo_regional?: number | null
          codigo_tipo_veiculo?: number | null
          codigo_veiculo?: string | null
          codigo_veiculo_vinculado?: number | null
          commission?: number | null
          complemento?: string | null
          consultor_id?: string | null
          contact_name: string
          contacted_at?: string | null
          contacted_via?: string | null
          cooperative?: string | null
          cpf_cnpj?: string | null
          created_at?: string | null
          dia_vencimento?: number | null
          email?: string | null
          fipe_code?: string | null
          fipe_value?: number | null
          fuel_type?: string | null
          gender?: string | null
          has_rejection_alert?: boolean | null
          home_phone?: string | null
          id?: string
          inadimplente?: boolean | null
          is_agregado?: boolean | null
          is_work_vehicle?: boolean | null
          kilometragem?: number | null
          lead_source?: string | null
          license_plate?: string | null
          logradouro?: string | null
          model?: string | null
          numero_endereco?: string | null
          numero_motor?: string | null
          observacao_veiculo?: string | null
          phone?: string | null
          phone2?: string | null
          quantidade_portas?: number | null
          registration_completed_at?: string | null
          registration_observations?: string | null
          renavam?: string | null
          rg?: string | null
          rg_issue_date?: string | null
          rg_issuer?: string | null
          send_quote_email?: boolean | null
          stage_id?: string | null
          state?: string | null
          tipo_cambio?: string | null
          updated_at?: string | null
          user_id: string
          value?: number | null
          vehicle_color?: string | null
          vehicle_type?: string | null
          work_phone?: string | null
          year_model?: string | null
        }
        Update: {
          analysis_approved_at?: string | null
          analysis_observations?: string | null
          analysis_rejected_at?: string | null
          ano_fabricacao?: string | null
          asaas_customer_id?: string | null
          assigned_to?: string | null
          bairro?: string | null
          birth_date?: string | null
          brand?: string | null
          cep?: string | null
          chassis?: string | null
          city?: string | null
          cnh?: string | null
          cnh_category?: string | null
          cnh_expiry_date?: string | null
          cnh_first_date?: string | null
          code?: string
          codigo_associado?: string | null
          codigo_combustivel?: number | null
          codigo_como_conheceu?: number | null
          codigo_consultor?: number | null
          codigo_conta?: number | null
          codigo_cooperativa?: number | null
          codigo_cor?: number | null
          codigo_cota?: number | null
          codigo_profissao?: number | null
          codigo_regional?: number | null
          codigo_tipo_veiculo?: number | null
          codigo_veiculo?: string | null
          codigo_veiculo_vinculado?: number | null
          commission?: number | null
          complemento?: string | null
          consultor_id?: string | null
          contact_name?: string
          contacted_at?: string | null
          contacted_via?: string | null
          cooperative?: string | null
          cpf_cnpj?: string | null
          created_at?: string | null
          dia_vencimento?: number | null
          email?: string | null
          fipe_code?: string | null
          fipe_value?: number | null
          fuel_type?: string | null
          gender?: string | null
          has_rejection_alert?: boolean | null
          home_phone?: string | null
          id?: string
          inadimplente?: boolean | null
          is_agregado?: boolean | null
          is_work_vehicle?: boolean | null
          kilometragem?: number | null
          lead_source?: string | null
          license_plate?: string | null
          logradouro?: string | null
          model?: string | null
          numero_endereco?: string | null
          numero_motor?: string | null
          observacao_veiculo?: string | null
          phone?: string | null
          phone2?: string | null
          quantidade_portas?: number | null
          registration_completed_at?: string | null
          registration_observations?: string | null
          renavam?: string | null
          rg?: string | null
          rg_issue_date?: string | null
          rg_issuer?: string | null
          send_quote_email?: boolean | null
          stage_id?: string | null
          state?: string | null
          tipo_cambio?: string | null
          updated_at?: string | null
          user_id?: string
          value?: number | null
          vehicle_color?: string | null
          vehicle_type?: string | null
          work_phone?: string | null
          year_model?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      departamentos: {
        Row: {
          codigo_hinova: string
          created_at: string | null
          descricao: string
          id: string
          sincronizado_em: string | null
          situacao: string | null
          updated_at: string | null
        }
        Insert: {
          codigo_hinova: string
          created_at?: string | null
          descricao: string
          id?: string
          sincronizado_em?: string | null
          situacao?: string | null
          updated_at?: string | null
        }
        Update: {
          codigo_hinova?: string
          created_at?: string | null
          descricao?: string
          id?: string
          sincronizado_em?: string | null
          situacao?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      estados_civis: {
        Row: {
          codigo_hinova: string
          created_at: string | null
          descricao: string
          id: string
          sincronizado_em: string | null
          updated_at: string | null
        }
        Insert: {
          codigo_hinova: string
          created_at?: string | null
          descricao: string
          id?: string
          sincronizado_em?: string | null
          updated_at?: string | null
        }
        Update: {
          codigo_hinova?: string
          created_at?: string | null
          descricao?: string
          id?: string
          sincronizado_em?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      eventos: {
        Row: {
          bairro: string | null
          bairro_condutor: string | null
          cep: string | null
          cep_condutor: string | null
          cidade: string | null
          cidade_condutor: string | null
          codigo_associado: string | null
          codigo_classificacao: string | null
          codigo_cooperativa: string | null
          codigo_evento: string | null
          codigo_hinova: string
          codigo_motivo: string | null
          codigo_regional_evento: string | null
          codigo_situacao: string | null
          codigo_veiculo: string | null
          codigo_voluntario: string | null
          complemento: string | null
          cpf_cnpj_associado: string | null
          cpf_condutor: string | null
          created_at: string | null
          data_cadastro: string | null
          data_comunicado_evento: string | null
          data_evento: string | null
          data_finalizacao: string | null
          descricao_cooperativa: string | null
          descricao_evento_area: string | null
          descricao_regional: string | null
          descricao_voluntario: string | null
          envolvimento: string | null
          estado: string | null
          estado_condutor: string | null
          evento_relacionado: string | null
          evento_tipo: string | null
          hora_cadastro: string | null
          hora_evento: string | null
          id: string
          logradouro: string | null
          logradouro_condutor: string | null
          marca_veiculo: string | null
          modelo_veiculo: string | null
          motivo: string | null
          nome_associado: string | null
          nome_condutor: string | null
          numero: string | null
          numero_bo: string | null
          numero_condutor: string | null
          observacao: string | null
          participacao: number | null
          passivel_ressarcimento: string | null
          placa_veiculo: string | null
          previsao_valor_reparo: number | null
          protocolo: string | null
          sincronizado_em: string | null
          situacao_evento: string | null
          solicitou_carro_reserva: string | null
          telefone_condutor: string | null
          updated_at: string | null
          valor_depreciacao_veiculo: number | null
          valor_fipe: number | null
          valor_reparo: number | null
        }
        Insert: {
          bairro?: string | null
          bairro_condutor?: string | null
          cep?: string | null
          cep_condutor?: string | null
          cidade?: string | null
          cidade_condutor?: string | null
          codigo_associado?: string | null
          codigo_classificacao?: string | null
          codigo_cooperativa?: string | null
          codigo_evento?: string | null
          codigo_hinova: string
          codigo_motivo?: string | null
          codigo_regional_evento?: string | null
          codigo_situacao?: string | null
          codigo_veiculo?: string | null
          codigo_voluntario?: string | null
          complemento?: string | null
          cpf_cnpj_associado?: string | null
          cpf_condutor?: string | null
          created_at?: string | null
          data_cadastro?: string | null
          data_comunicado_evento?: string | null
          data_evento?: string | null
          data_finalizacao?: string | null
          descricao_cooperativa?: string | null
          descricao_evento_area?: string | null
          descricao_regional?: string | null
          descricao_voluntario?: string | null
          envolvimento?: string | null
          estado?: string | null
          estado_condutor?: string | null
          evento_relacionado?: string | null
          evento_tipo?: string | null
          hora_cadastro?: string | null
          hora_evento?: string | null
          id?: string
          logradouro?: string | null
          logradouro_condutor?: string | null
          marca_veiculo?: string | null
          modelo_veiculo?: string | null
          motivo?: string | null
          nome_associado?: string | null
          nome_condutor?: string | null
          numero?: string | null
          numero_bo?: string | null
          numero_condutor?: string | null
          observacao?: string | null
          participacao?: number | null
          passivel_ressarcimento?: string | null
          placa_veiculo?: string | null
          previsao_valor_reparo?: number | null
          protocolo?: string | null
          sincronizado_em?: string | null
          situacao_evento?: string | null
          solicitou_carro_reserva?: string | null
          telefone_condutor?: string | null
          updated_at?: string | null
          valor_depreciacao_veiculo?: number | null
          valor_fipe?: number | null
          valor_reparo?: number | null
        }
        Update: {
          bairro?: string | null
          bairro_condutor?: string | null
          cep?: string | null
          cep_condutor?: string | null
          cidade?: string | null
          cidade_condutor?: string | null
          codigo_associado?: string | null
          codigo_classificacao?: string | null
          codigo_cooperativa?: string | null
          codigo_evento?: string | null
          codigo_hinova?: string
          codigo_motivo?: string | null
          codigo_regional_evento?: string | null
          codigo_situacao?: string | null
          codigo_veiculo?: string | null
          codigo_voluntario?: string | null
          complemento?: string | null
          cpf_cnpj_associado?: string | null
          cpf_condutor?: string | null
          created_at?: string | null
          data_cadastro?: string | null
          data_comunicado_evento?: string | null
          data_evento?: string | null
          data_finalizacao?: string | null
          descricao_cooperativa?: string | null
          descricao_evento_area?: string | null
          descricao_regional?: string | null
          descricao_voluntario?: string | null
          envolvimento?: string | null
          estado?: string | null
          estado_condutor?: string | null
          evento_relacionado?: string | null
          evento_tipo?: string | null
          hora_cadastro?: string | null
          hora_evento?: string | null
          id?: string
          logradouro?: string | null
          logradouro_condutor?: string | null
          marca_veiculo?: string | null
          modelo_veiculo?: string | null
          motivo?: string | null
          nome_associado?: string | null
          nome_condutor?: string | null
          numero?: string | null
          numero_bo?: string | null
          numero_condutor?: string | null
          observacao?: string | null
          participacao?: number | null
          passivel_ressarcimento?: string | null
          placa_veiculo?: string | null
          previsao_valor_reparo?: number | null
          protocolo?: string | null
          sincronizado_em?: string | null
          situacao_evento?: string | null
          solicitou_carro_reserva?: string | null
          telefone_condutor?: string | null
          updated_at?: string | null
          valor_depreciacao_veiculo?: number | null
          valor_fipe?: number | null
          valor_reparo?: number | null
        }
        Relationships: []
      }
      fornecedores: {
        Row: {
          codigo_fornecedor: number | null
          cpf_cnpj: number | null
          email: string | null
          nome: string | null
          nome_fantasia: string | null
          situacao: string | null
          telefone: string | null
        }
        Insert: {
          codigo_fornecedor?: number | null
          cpf_cnpj?: number | null
          email?: string | null
          nome?: string | null
          nome_fantasia?: string | null
          situacao?: string | null
          telefone?: string | null
        }
        Update: {
          codigo_fornecedor?: number | null
          cpf_cnpj?: number | null
          email?: string | null
          nome?: string | null
          nome_fantasia?: string | null
          situacao?: string | null
          telefone?: string | null
        }
        Relationships: []
      }
      inspection_types: {
        Row: {
          codigo_hinova: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          codigo_hinova?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          codigo_hinova?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      lead_sources: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      midias: {
        Row: {
          codigo_hinova: string
          created_at: string | null
          descricao: string
          id: string
          sincronizado_em: string | null
          situacao: string | null
          updated_at: string | null
        }
        Insert: {
          codigo_hinova: string
          created_at?: string | null
          descricao: string
          id?: string
          sincronizado_em?: string | null
          situacao?: string | null
          updated_at?: string | null
        }
        Update: {
          codigo_hinova?: string
          created_at?: string | null
          descricao?: string
          id?: string
          sincronizado_em?: string | null
          situacao?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      pipeline_stages: {
        Row: {
          color: string | null
          created_at: string | null
          id: string
          name: string
          order_position: number
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          id?: string
          name: string
          order_position: number
        }
        Update: {
          color?: string | null
          created_at?: string | null
          id?: string
          name?: string
          order_position?: number
        }
        Relationships: []
      }
      produtos: {
        Row: {
          base_cobranca: string | null
          codigo_classificacaoproduto: string | null
          codigo_fornecedor: string | null
          codigo_hinova: string
          compulsorio: string | null
          cooperativas: Json | null
          created_at: string | null
          descricao_produto: string | null
          descricao_produto_boleto: string | null
          descricao_tipo_veiculo: string | null
          formato_cobranca: string | null
          id: string
          nome_fornecedor: string | null
          padrao: string | null
          regionais: Json | null
          sincronizado_em: string | null
          situacao: string | null
          tipo_veiculo: string | null
          updated_at: string | null
          valor_fipe_final: number | null
          valor_fipe_inicial: number | null
          valor_produto: number | null
        }
        Insert: {
          base_cobranca?: string | null
          codigo_classificacaoproduto?: string | null
          codigo_fornecedor?: string | null
          codigo_hinova: string
          compulsorio?: string | null
          cooperativas?: Json | null
          created_at?: string | null
          descricao_produto?: string | null
          descricao_produto_boleto?: string | null
          descricao_tipo_veiculo?: string | null
          formato_cobranca?: string | null
          id?: string
          nome_fornecedor?: string | null
          padrao?: string | null
          regionais?: Json | null
          sincronizado_em?: string | null
          situacao?: string | null
          tipo_veiculo?: string | null
          updated_at?: string | null
          valor_fipe_final?: number | null
          valor_fipe_inicial?: number | null
          valor_produto?: number | null
        }
        Update: {
          base_cobranca?: string | null
          codigo_classificacaoproduto?: string | null
          codigo_fornecedor?: string | null
          codigo_hinova?: string
          compulsorio?: string | null
          cooperativas?: Json | null
          created_at?: string | null
          descricao_produto?: string | null
          descricao_produto_boleto?: string | null
          descricao_tipo_veiculo?: string | null
          formato_cobranca?: string | null
          id?: string
          nome_fornecedor?: string | null
          padrao?: string | null
          regionais?: Json | null
          sincronizado_em?: string | null
          situacao?: string | null
          tipo_veiculo?: string | null
          updated_at?: string | null
          valor_fipe_final?: number | null
          valor_fipe_inicial?: number | null
          valor_produto?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      profissoes: {
        Row: {
          codigo_hinova: string
          created_at: string | null
          descricao: string
          id: string
          sincronizado_em: string | null
          situacao: string | null
          updated_at: string | null
        }
        Insert: {
          codigo_hinova: string
          created_at?: string | null
          descricao: string
          id?: string
          sincronizado_em?: string | null
          situacao?: string | null
          updated_at?: string | null
        }
        Update: {
          codigo_hinova?: string
          created_at?: string | null
          descricao?: string
          id?: string
          sincronizado_em?: string | null
          situacao?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      public_quote_inspection_photos: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          file_path: string
          file_url: string
          id: string
          is_deleted: boolean | null
          latitude: number | null
          location_accuracy: number | null
          longitude: number | null
          photo_label: string
          photo_type: string
          quote_id: string
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          file_path: string
          file_url: string
          id?: string
          is_deleted?: boolean | null
          latitude?: number | null
          location_accuracy?: number | null
          longitude?: number | null
          photo_label: string
          photo_type: string
          quote_id: string
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          file_path?: string
          file_url?: string
          id?: string
          is_deleted?: boolean | null
          latitude?: number | null
          location_accuracy?: number | null
          longitude?: number | null
          photo_label?: string
          photo_type?: string
          quote_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "public_quote_inspection_photos_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "public_quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      public_quotes: {
        Row: {
          addons_total: number | null
          asaas_bank_slip_url: string | null
          asaas_charge_id: string | null
          asaas_invoice_url: string | null
          asaas_pix_qrcode: string | null
          asaas_subscription_id: string | null
          assinafy_signer_id: string | null
          base_price: number | null
          client_observations: string | null
          cnh_data: Json | null
          cnh_url: string | null
          codigo_associado_hinova: string | null
          codigo_como_conheceu: number | null
          codigo_profissao: number | null
          codigo_veiculo_hinova: string | null
          como_conheceu_texto: string | null
          comprovante_data: Json | null
          comprovante_url: string | null
          contract_accepted_at: string | null
          contract_ip: string | null
          created_at: string | null
          crlv_data: Json | null
          crlv_url: string | null
          deal_id: string | null
          dia_vencimento: number | null
          expires_at: string
          face_verification_data: Json | null
          face_verification_status: string | null
          final_price: number | null
          first_billing_date: string | null
          id: string
          inspection_type: string | null
          is_app_vehicle: boolean | null
          lead_email: string | null
          lead_phone: string | null
          payment_data: Json | null
          payment_due_date: string | null
          payment_method: string | null
          payment_status: string | null
          payment_value: number | null
          pending_observations: string | null
          pending_photos: Json | null
          products_total: number | null
          profissao_texto: string | null
          public_token: string
          quote_data: Json
          selected_addons: Json | null
          selected_products: Json | null
          status: string | null
          termos_aceitos: Json | null
          updated_at: string | null
          viewed_at: string | null
        }
        Insert: {
          addons_total?: number | null
          asaas_bank_slip_url?: string | null
          asaas_charge_id?: string | null
          asaas_invoice_url?: string | null
          asaas_pix_qrcode?: string | null
          asaas_subscription_id?: string | null
          assinafy_signer_id?: string | null
          base_price?: number | null
          client_observations?: string | null
          cnh_data?: Json | null
          cnh_url?: string | null
          codigo_associado_hinova?: string | null
          codigo_como_conheceu?: number | null
          codigo_profissao?: number | null
          codigo_veiculo_hinova?: string | null
          como_conheceu_texto?: string | null
          comprovante_data?: Json | null
          comprovante_url?: string | null
          contract_accepted_at?: string | null
          contract_ip?: string | null
          created_at?: string | null
          crlv_data?: Json | null
          crlv_url?: string | null
          deal_id?: string | null
          dia_vencimento?: number | null
          expires_at?: string
          face_verification_data?: Json | null
          face_verification_status?: string | null
          final_price?: number | null
          first_billing_date?: string | null
          id?: string
          inspection_type?: string | null
          is_app_vehicle?: boolean | null
          lead_email?: string | null
          lead_phone?: string | null
          payment_data?: Json | null
          payment_due_date?: string | null
          payment_method?: string | null
          payment_status?: string | null
          payment_value?: number | null
          pending_observations?: string | null
          pending_photos?: Json | null
          products_total?: number | null
          profissao_texto?: string | null
          public_token: string
          quote_data?: Json
          selected_addons?: Json | null
          selected_products?: Json | null
          status?: string | null
          termos_aceitos?: Json | null
          updated_at?: string | null
          viewed_at?: string | null
        }
        Update: {
          addons_total?: number | null
          asaas_bank_slip_url?: string | null
          asaas_charge_id?: string | null
          asaas_invoice_url?: string | null
          asaas_pix_qrcode?: string | null
          asaas_subscription_id?: string | null
          assinafy_signer_id?: string | null
          base_price?: number | null
          client_observations?: string | null
          cnh_data?: Json | null
          cnh_url?: string | null
          codigo_associado_hinova?: string | null
          codigo_como_conheceu?: number | null
          codigo_profissao?: number | null
          codigo_veiculo_hinova?: string | null
          como_conheceu_texto?: string | null
          comprovante_data?: Json | null
          comprovante_url?: string | null
          contract_accepted_at?: string | null
          contract_ip?: string | null
          created_at?: string | null
          crlv_data?: Json | null
          crlv_url?: string | null
          deal_id?: string | null
          dia_vencimento?: number | null
          expires_at?: string
          face_verification_data?: Json | null
          face_verification_status?: string | null
          final_price?: number | null
          first_billing_date?: string | null
          id?: string
          inspection_type?: string | null
          is_app_vehicle?: boolean | null
          lead_email?: string | null
          lead_phone?: string | null
          payment_data?: Json | null
          payment_due_date?: string | null
          payment_method?: string | null
          payment_status?: string | null
          payment_value?: number | null
          pending_observations?: string | null
          pending_photos?: Json | null
          products_total?: number | null
          profissao_texto?: string | null
          public_token?: string
          quote_data?: Json
          selected_addons?: Json | null
          selected_products?: Json | null
          status?: string | null
          termos_aceitos?: Json | null
          updated_at?: string | null
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "public_quotes_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_termo_signatures: {
        Row: {
          aceite_digital: boolean | null
          assinafy_assignment_id: string | null
          assinafy_document_id: string | null
          assinafy_signer_id: string | null
          combined_termos_ids: string[] | null
          combined_termos_names: string[] | null
          created_at: string | null
          id: string
          ip_address: string | null
          quote_id: string
          signed_at: string | null
          status: string | null
          termo_id: string
          termo_nome: string
          termo_tipo_id: string | null
          updated_at: string | null
          user_agent: string | null
        }
        Insert: {
          aceite_digital?: boolean | null
          assinafy_assignment_id?: string | null
          assinafy_document_id?: string | null
          assinafy_signer_id?: string | null
          combined_termos_ids?: string[] | null
          combined_termos_names?: string[] | null
          created_at?: string | null
          id?: string
          ip_address?: string | null
          quote_id: string
          signed_at?: string | null
          status?: string | null
          termo_id: string
          termo_nome: string
          termo_tipo_id?: string | null
          updated_at?: string | null
          user_agent?: string | null
        }
        Update: {
          aceite_digital?: boolean | null
          assinafy_assignment_id?: string | null
          assinafy_document_id?: string | null
          assinafy_signer_id?: string | null
          combined_termos_ids?: string[] | null
          combined_termos_names?: string[] | null
          created_at?: string | null
          id?: string
          ip_address?: string | null
          quote_id?: string
          signed_at?: string | null
          status?: string | null
          termo_id?: string
          termo_nome?: string
          termo_tipo_id?: string | null
          updated_at?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_termo_signatures_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "public_quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_termo_signatures_termo_id_fkey"
            columns: ["termo_id"]
            isOneToOne: false
            referencedRelation: "termos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_termo_signatures_termo_tipo_id_fkey"
            columns: ["termo_tipo_id"]
            isOneToOne: false
            referencedRelation: "termo_tipos"
            referencedColumns: ["id"]
          },
        ]
      }
      regionais: {
        Row: {
          bairro: string | null
          cep: string | null
          cidade: string | null
          cnpj: string | null
          codigo_hinova: string
          complemento: string | null
          created_at: string | null
          email: string | null
          estado: string | null
          id: string
          logradouro: string | null
          nome: string | null
          nome_fantasia: string | null
          numero: string | null
          sincronizado_em: string | null
          situacao: string | null
          telefone: string | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          codigo_hinova: string
          complemento?: string | null
          created_at?: string | null
          email?: string | null
          estado?: string | null
          id?: string
          logradouro?: string | null
          nome?: string | null
          nome_fantasia?: string | null
          numero?: string | null
          sincronizado_em?: string | null
          situacao?: string | null
          telefone?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          codigo_hinova?: string
          complemento?: string | null
          created_at?: string | null
          email?: string | null
          estado?: string | null
          id?: string
          logradouro?: string | null
          nome?: string | null
          nome_fantasia?: string | null
          numero?: string | null
          sincronizado_em?: string | null
          situacao?: string | null
          telefone?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: []
      }
      rejected_plates: {
        Row: {
          authorized_at: string | null
          authorized_by: string | null
          created_at: string | null
          deal_id: string | null
          id: string
          license_plate: string
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string
        }
        Insert: {
          authorized_at?: string | null
          authorized_by?: string | null
          created_at?: string | null
          deal_id?: string | null
          id?: string
          license_plate: string
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason: string
        }
        Update: {
          authorized_at?: string | null
          authorized_by?: string | null
          created_at?: string | null
          deal_id?: string | null
          id?: string
          license_plate?: string
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "rejected_plates_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      situacoes: {
        Row: {
          codigo_hinova: string
          cor_fonte: string | null
          cor_linha: string | null
          created_at: string | null
          descricao: string
          id: string
          sincronizado_em: string | null
          situacao: string | null
          updated_at: string | null
        }
        Insert: {
          codigo_hinova: string
          cor_fonte?: string | null
          cor_linha?: string | null
          created_at?: string | null
          descricao: string
          id?: string
          sincronizado_em?: string | null
          situacao?: string | null
          updated_at?: string | null
        }
        Update: {
          codigo_hinova?: string
          cor_fonte?: string | null
          cor_linha?: string | null
          created_at?: string | null
          descricao?: string
          id?: string
          sincronizado_em?: string | null
          situacao?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      status_atendimento: {
        Row: {
          codigo_hinova: string
          created_at: string | null
          descricao: string
          id: string
          sincronizado_em: string | null
          situacao: string | null
          updated_at: string | null
        }
        Insert: {
          codigo_hinova: string
          created_at?: string | null
          descricao: string
          id?: string
          sincronizado_em?: string | null
          situacao?: string | null
          updated_at?: string | null
        }
        Update: {
          codigo_hinova?: string
          created_at?: string | null
          descricao?: string
          id?: string
          sincronizado_em?: string | null
          situacao?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      sync_jobs: {
        Row: {
          cancelled: boolean | null
          completed_at: string | null
          current_step: string | null
          error_message: string | null
          id: string
          job_type: string
          last_error_at: string | null
          started_at: string | null
          started_by: string | null
          status: string
          steps_progress: Json | null
          total_enriched: number | null
          total_synced: number | null
          updated_at: string | null
        }
        Insert: {
          cancelled?: boolean | null
          completed_at?: string | null
          current_step?: string | null
          error_message?: string | null
          id?: string
          job_type?: string
          last_error_at?: string | null
          started_at?: string | null
          started_by?: string | null
          status?: string
          steps_progress?: Json | null
          total_enriched?: number | null
          total_synced?: number | null
          updated_at?: string | null
        }
        Update: {
          cancelled?: boolean | null
          completed_at?: string | null
          current_step?: string | null
          error_message?: string | null
          id?: string
          job_type?: string
          last_error_at?: string | null
          started_at?: string | null
          started_by?: string | null
          status?: string
          steps_progress?: Json | null
          total_enriched?: number | null
          total_synced?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          description: string | null
          id: string
          setting_key: string
          setting_value: Json
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          description?: string | null
          id?: string
          setting_key: string
          setting_value?: Json
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          description?: string | null
          id?: string
          setting_key?: string
          setting_value?: Json
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      termo_tipos: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          descricao: string | null
          id: string
          nome: string
          ordem: number | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome: string
          ordem?: number | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          ordem?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      termos: {
        Row: {
          assinafy_document_id: string | null
          codigo_hinova: string
          conteudo: string | null
          created_at: string | null
          ferramenta: string | null
          id: string
          nome: string | null
          ordem_no_tipo: number | null
          permitir_aceite_digital: string | null
          sincronizado_em: string | null
          situacao: string | null
          termo_tipo_id: string | null
          tipo: string | null
          updated_at: string | null
        }
        Insert: {
          assinafy_document_id?: string | null
          codigo_hinova: string
          conteudo?: string | null
          created_at?: string | null
          ferramenta?: string | null
          id?: string
          nome?: string | null
          ordem_no_tipo?: number | null
          permitir_aceite_digital?: string | null
          sincronizado_em?: string | null
          situacao?: string | null
          termo_tipo_id?: string | null
          tipo?: string | null
          updated_at?: string | null
        }
        Update: {
          assinafy_document_id?: string | null
          codigo_hinova?: string
          conteudo?: string | null
          created_at?: string | null
          ferramenta?: string | null
          id?: string
          nome?: string | null
          ordem_no_tipo?: number | null
          permitir_aceite_digital?: string | null
          sincronizado_em?: string | null
          situacao?: string | null
          termo_tipo_id?: string | null
          tipo?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hinova_termos_termo_tipo_id_fkey"
            columns: ["termo_tipo_id"]
            isOneToOne: false
            referencedRelation: "termo_tipos"
            referencedColumns: ["id"]
          },
        ]
      }
      tipos_atendimento: {
        Row: {
          codigo_hinova: string
          created_at: string | null
          descricao: string
          id: string
          sincronizado_em: string | null
          situacao: string | null
          updated_at: string | null
        }
        Insert: {
          codigo_hinova: string
          created_at?: string | null
          descricao: string
          id?: string
          sincronizado_em?: string | null
          situacao?: string | null
          updated_at?: string | null
        }
        Update: {
          codigo_hinova?: string
          created_at?: string | null
          descricao?: string
          id?: string
          sincronizado_em?: string | null
          situacao?: string | null
          updated_at?: string | null
        }
        Relationships: []
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
          role?: Database["public"]["Enums"]["app_role"]
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
      vehicle_types: {
        Row: {
          codigo_hinova: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          codigo_hinova?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          codigo_hinova?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      veiculos: {
        Row: {
          ano_fabricacao: string | null
          ano_modelo: string | null
          categoria: string | null
          chassi: string | null
          codigo_associado_hinova: string | null
          codigo_cota: string | null
          codigo_fipe: string | null
          codigo_hinova: string
          codigo_regional: string | null
          codigo_situacao: string | null
          codigo_tipo_veiculo: string | null
          combustivel: string | null
          cor: string | null
          cota: string | null
          cpf_cnpj_associado: string | null
          created_at: string | null
          data_cadastro_hinova: string | null
          data_contrato: string | null
          descricao_situacao: string | null
          id: string
          marca: string | null
          modelo: string | null
          nome_associado: string | null
          participacao: string | null
          placa: string | null
          renavam: string | null
          sincronizado_em: string | null
          tipo: string | null
          updated_at: string | null
          valor_adesao: number | null
          valor_fipe: number | null
          valor_fixo: number | null
        }
        Insert: {
          ano_fabricacao?: string | null
          ano_modelo?: string | null
          categoria?: string | null
          chassi?: string | null
          codigo_associado_hinova?: string | null
          codigo_cota?: string | null
          codigo_fipe?: string | null
          codigo_hinova: string
          codigo_regional?: string | null
          codigo_situacao?: string | null
          codigo_tipo_veiculo?: string | null
          combustivel?: string | null
          cor?: string | null
          cota?: string | null
          cpf_cnpj_associado?: string | null
          created_at?: string | null
          data_cadastro_hinova?: string | null
          data_contrato?: string | null
          descricao_situacao?: string | null
          id?: string
          marca?: string | null
          modelo?: string | null
          nome_associado?: string | null
          participacao?: string | null
          placa?: string | null
          renavam?: string | null
          sincronizado_em?: string | null
          tipo?: string | null
          updated_at?: string | null
          valor_adesao?: number | null
          valor_fipe?: number | null
          valor_fixo?: number | null
        }
        Update: {
          ano_fabricacao?: string | null
          ano_modelo?: string | null
          categoria?: string | null
          chassi?: string | null
          codigo_associado_hinova?: string | null
          codigo_cota?: string | null
          codigo_fipe?: string | null
          codigo_hinova?: string
          codigo_regional?: string | null
          codigo_situacao?: string | null
          codigo_tipo_veiculo?: string | null
          combustivel?: string | null
          cor?: string | null
          cota?: string | null
          cpf_cnpj_associado?: string | null
          created_at?: string | null
          data_cadastro_hinova?: string | null
          data_contrato?: string | null
          descricao_situacao?: string | null
          id?: string
          marca?: string | null
          modelo?: string | null
          nome_associado?: string | null
          participacao?: string | null
          placa?: string | null
          renavam?: string | null
          sincronizado_em?: string | null
          tipo?: string | null
          updated_at?: string | null
          valor_adesao?: number | null
          valor_fipe?: number | null
          valor_fixo?: number | null
        }
        Relationships: []
      }
      vistoriadores: {
        Row: {
          auth_user_id: string | null
          cpf_cnpj: string | null
          created_at: string | null
          id: string
          login: string | null
          nome: string
          situacao: string | null
          updated_at: string | null
        }
        Insert: {
          auth_user_id?: string | null
          cpf_cnpj?: string | null
          created_at?: string | null
          id?: string
          login?: string | null
          nome: string
          situacao?: string | null
          updated_at?: string | null
        }
        Update: {
          auth_user_id?: string | null
          cpf_cnpj?: string | null
          created_at?: string | null
          id?: string
          login?: string | null
          nome?: string
          situacao?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      vistorias: {
        Row: {
          ano: string | null
          chassi: string | null
          cod_vistoria: number
          combustivel: string | null
          cor: string | null
          cpf_segurado: string | null
          created_at: string
          data_agendamento: string | null
          data_finalizacao: string | null
          data_realizacao: string | null
          endereco: string | null
          id: string
          latitude: string | null
          longitude: string | null
          marca: string | null
          modelo: string | null
          nome_segurado: string
          observacoes: string | null
          placa: string | null
          renavam: string | null
          situacao: string
          updated_at: string
          vistoriador_id: string | null
        }
        Insert: {
          ano?: string | null
          chassi?: string | null
          cod_vistoria?: number
          combustivel?: string | null
          cor?: string | null
          cpf_segurado?: string | null
          created_at?: string
          data_agendamento?: string | null
          data_finalizacao?: string | null
          data_realizacao?: string | null
          endereco?: string | null
          id?: string
          latitude?: string | null
          longitude?: string | null
          marca?: string | null
          modelo?: string | null
          nome_segurado: string
          observacoes?: string | null
          placa?: string | null
          renavam?: string | null
          situacao?: string
          updated_at?: string
          vistoriador_id?: string | null
        }
        Update: {
          ano?: string | null
          chassi?: string | null
          cod_vistoria?: number
          combustivel?: string | null
          cor?: string | null
          cpf_segurado?: string | null
          created_at?: string
          data_agendamento?: string | null
          data_finalizacao?: string | null
          data_realizacao?: string | null
          endereco?: string | null
          id?: string
          latitude?: string | null
          longitude?: string | null
          marca?: string | null
          modelo?: string | null
          nome_segurado?: string
          observacoes?: string | null
          placa?: string | null
          renavam?: string | null
          situacao?: string
          updated_at?: string
          vistoriador_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vistorias_vistoriador_id_fkey"
            columns: ["vistoriador_id"]
            isOneToOne: false
            referencedRelation: "vistoriadores"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_consultores_for_distribution: {
        Args: never
        Returns: {
          full_name: string
          id: string
        }[]
      }
      get_vistoriador_by_auth_id: {
        Args: { _auth_user_id: string }
        Returns: {
          cod_vistoriador: number
          cpf_cnpj: string
          id: string
          login: string
          nome: string
          situacao: string
        }[]
      }
      get_vistoriador_id_for_user: {
        Args: { _user_id: string }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      sync_voluntario_cooperativas: { Args: never; Returns: number }
    }
    Enums: {
      app_role:
        | "admin"
        | "moderator"
        | "user"
        | "consultor"
        | "vistoriador"
        | "analista"
        | "cadastro"
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
        "admin",
        "moderator",
        "user",
        "consultor",
        "vistoriador",
        "analista",
        "cadastro",
      ],
    },
  },
} as const
