import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { UploadLogo } from '@/components/documentos/UploadLogo';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Save, Palette, Type, Eye } from 'lucide-react';

interface PdfConfig {
  id?: string;
  cor_primaria: string;
  cor_secundaria: string;
  logo_url: string | null;
  nome_empresa: string;
  mensagem_encerramento: string;
  mostrar_validade: boolean;
  mostrar_dados_solicitante: boolean;
  mostrar_dados_veiculo: boolean;
  mostrar_mensagem_encerramento: boolean;
  mostrar_whatsapp_rodape: boolean;
}

const DEFAULTS: PdfConfig = {
  cor_primaria: '#14376E',
  cor_secundaria: '#C81E41',
  logo_url: null,
  nome_empresa: 'PRATICCAR Proteção Veicular',
  mensagem_encerramento: 'Será um prazer ter você como nosso associado. Estaremos aqui para o que precisar.',
  mostrar_validade: true,
  mostrar_dados_solicitante: true,
  mostrar_dados_veiculo: true,
  mostrar_mensagem_encerramento: true,
  mostrar_whatsapp_rodape: true,
};

export default function CotacaoPdfConfig() {
  const [config, setConfig] = useState<PdfConfig>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('cotacao_pdf_config')
        .select('*')
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      if (data) {
        setConfig({
          id: data.id,
          cor_primaria: data.cor_primaria,
          cor_secundaria: data.cor_secundaria,
          logo_url: data.logo_url,
          nome_empresa: data.nome_empresa,
          mensagem_encerramento: data.mensagem_encerramento,
          mostrar_validade: data.mostrar_validade,
          mostrar_dados_solicitante: data.mostrar_dados_solicitante,
          mostrar_dados_veiculo: data.mostrar_dados_veiculo,
          mostrar_mensagem_encerramento: data.mostrar_mensagem_encerramento,
          mostrar_whatsapp_rodape: data.mostrar_whatsapp_rodape,
        });
      }
    } catch (err: any) {
      console.error('Erro ao carregar config:', err);
      toast.error('Erro ao carregar configurações');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const payload = {
        cor_primaria: config.cor_primaria,
        cor_secundaria: config.cor_secundaria,
        logo_url: config.logo_url,
        nome_empresa: config.nome_empresa,
        mensagem_encerramento: config.mensagem_encerramento,
        mostrar_validade: config.mostrar_validade,
        mostrar_dados_solicitante: config.mostrar_dados_solicitante,
        mostrar_dados_veiculo: config.mostrar_dados_veiculo,
        mostrar_mensagem_encerramento: config.mostrar_mensagem_encerramento,
        mostrar_whatsapp_rodape: config.mostrar_whatsapp_rodape,
        updated_at: new Date().toISOString(),
        updated_by: user?.id || null,
      };

      if (config.id) {
        const { error } = await (supabase as any)
          .from('cotacao_pdf_config')
          .update(payload)
          .eq('id', config.id);
        if (error) throw error;
      } else {
        const { data, error } = await (supabase as any)
          .from('cotacao_pdf_config')
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        if (data) setConfig(prev => ({ ...prev, id: data.id }));
      }

      toast.success('Configurações salvas com sucesso!');
    } catch (err: any) {
      console.error('Erro ao salvar:', err);
      toast.error(`Erro ao salvar: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const update = <K extends keyof PdfConfig>(key: K, value: PdfConfig[K]) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">PDF de Cotação</h1>
          <p className="text-muted-foreground">
            Configure a aparência e conteúdo do PDF de cotação gerado para os clientes.
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Salvar configurações
        </Button>
      </div>

      {/* Card 1 — Identidade Visual */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Identidade Visual
          </CardTitle>
          <CardDescription>Cores, logo e nome da empresa exibidos no PDF</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Cor Primária */}
            <div className="space-y-2">
              <Label>Cor primária (cabeçalho, bordas)</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={config.cor_primaria}
                  onChange={(e) => update('cor_primaria', e.target.value)}
                  className="h-10 w-14 rounded border border-input cursor-pointer"
                />
                <Input
                  value={config.cor_primaria}
                  onChange={(e) => update('cor_primaria', e.target.value)}
                  placeholder="#14376E"
                  className="font-mono"
                />
              </div>
            </div>

            {/* Cor Secundária */}
            <div className="space-y-2">
              <Label>Cor secundária (fundos de seção, badges)</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={config.cor_secundaria}
                  onChange={(e) => update('cor_secundaria', e.target.value)}
                  className="h-10 w-14 rounded border border-input cursor-pointer"
                />
                <Input
                  value={config.cor_secundaria}
                  onChange={(e) => update('cor_secundaria', e.target.value)}
                  placeholder="#C81E41"
                  className="font-mono"
                />
              </div>
            </div>
          </div>

          {/* Logo */}
          <UploadLogo
            logoAtual={config.logo_url || undefined}
            onLogoChange={(url) => update('logo_url', url)}
          />

          {/* Nome da empresa */}
          <div className="space-y-2">
            <Label>Nome de exibição da empresa</Label>
            <Input
              value={config.nome_empresa}
              onChange={(e) => update('nome_empresa', e.target.value)}
              placeholder="PRATICCAR Proteção Veicular"
            />
          </div>
        </CardContent>
      </Card>

      {/* Card 2 — Texto do PDF */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Type className="h-5 w-5" />
            Texto do PDF
          </CardTitle>
          <CardDescription>Mensagens exibidas no documento</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label>Mensagem institucional de encerramento</Label>
            <Textarea
              value={config.mensagem_encerramento}
              onChange={(e) => update('mensagem_encerramento', e.target.value)}
              rows={3}
              placeholder="Será um prazer ter você como nosso associado..."
            />
            <p className="text-xs text-muted-foreground">
              Exibida antes do rodapé do PDF de cotação.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Card 3 — Seções Visíveis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Seções Visíveis
          </CardTitle>
          <CardDescription>Ative ou desative seções individuais do PDF</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { key: 'mostrar_validade' as const, label: 'Barra de validade da cotação', desc: 'Exibe a data de validade no topo do PDF' },
            { key: 'mostrar_dados_solicitante' as const, label: 'Bloco de dados do solicitante', desc: 'Nome, telefone e e-mail do cliente' },
            { key: 'mostrar_dados_veiculo' as const, label: 'Bloco de dados do veículo', desc: 'Marca, modelo, ano e placa' },
            { key: 'mostrar_mensagem_encerramento' as const, label: 'Mensagem institucional de encerramento', desc: 'Texto antes do rodapé' },
            { key: 'mostrar_whatsapp_rodape' as const, label: 'Botão de WhatsApp do vendedor no rodapé', desc: 'Somente no PDF comparativo' },
          ].map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">{label}</Label>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
              <Switch
                checked={config[key]}
                onCheckedChange={(val) => update(key, val)}
              />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
