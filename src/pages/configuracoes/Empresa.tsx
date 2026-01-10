import { useState } from 'react';
import { Building2, Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

export default function Empresa() {
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    nome: 'PRATIC Proteção Veicular',
    cnpj: '',
    telefone: '',
    email: '',
    endereco: '',
  });

  const handleSave = async () => {
    setSaving(true);
    // Simular salvamento - em produção, salvar na tabela configuracoes_sistema
    await new Promise(r => setTimeout(r, 1000));
    toast.success('Dados da empresa salvos!');
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Empresa</h1>
        <p className="text-sm text-muted-foreground">Dados da associação</p>
      </div>

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Building2 className="w-5 h-5" />
            Informações da Empresa
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome da empresa</Label>
              <Input 
                id="nome" 
                value={formData.nome} 
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })} 
                className="bg-background" 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cnpj">CNPJ</Label>
              <Input 
                id="cnpj" 
                value={formData.cnpj} 
                onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })} 
                placeholder="00.000.000/0000-00" 
                className="bg-background" 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="telefone">Telefone</Label>
              <Input 
                id="telefone" 
                value={formData.telefone} 
                onChange={(e) => setFormData({ ...formData, telefone: e.target.value })} 
                placeholder="(00) 0000-0000" 
                className="bg-background" 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email" 
                type="email" 
                value={formData.email} 
                onChange={(e) => setFormData({ ...formData, email: e.target.value })} 
                className="bg-background" 
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="endereco">Endereço completo</Label>
            <Textarea 
              id="endereco" 
              value={formData.endereco} 
              onChange={(e) => setFormData({ ...formData, endereco: e.target.value })} 
              className="bg-background" 
              rows={3} 
            />
          </div>
          
          <div className="flex justify-end pt-4">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Salvar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
