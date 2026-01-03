import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';
import { User, Lock, Bell, Building, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { maskTelefone } from '@/lib/validations';

export default function Configuracoes() {
  const { profile, user } = useAuth();

  // Profile form state
  const [nome, setNome] = useState(profile?.nome || '');
  const [telefone, setTelefone] = useState(profile?.telefone || '');
  const [savingProfile, setSavingProfile] = useState(false);

  // Password form state
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const handleSaveProfile = async () => {
    if (!nome.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    if (!user?.id) {
      toast.error('Usuário não encontrado');
      return;
    }

    setSavingProfile(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          nome: nome.trim(),
          telefone: telefone || null,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);

      if (error) throw error;

      toast.success('Perfil atualizado com sucesso!');
    } catch (error) {
      console.error('Erro ao atualizar perfil:', error);
      toast.error('Erro ao atualizar perfil');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (!novaSenha || !confirmarSenha) {
      toast.error('Preencha todos os campos de senha');
      return;
    }

    if (novaSenha.length < 6) {
      toast.error('A senha deve ter no mínimo 6 caracteres');
      return;
    }

    if (novaSenha !== confirmarSenha) {
      toast.error('As senhas não coincidem');
      return;
    }

    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: novaSenha,
      });

      if (error) throw error;

      toast.success('Senha alterada com sucesso!');
      setSenhaAtual('');
      setNovaSenha('');
      setConfirmarSenha('');
    } catch (error: any) {
      console.error('Erro ao alterar senha:', error);
      toast.error(error?.message || 'Erro ao alterar senha');
    } finally {
      setSavingPassword(false);
    }
  };

  const handleTelefoneChange = (value: string) => {
    setTelefone(maskTelefone(value));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Configurações</h1>
        <p className="text-muted-foreground">
          Gerencie suas preferências e configurações da conta
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Profile */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Perfil
            </CardTitle>
            <CardDescription>Suas informações pessoais</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome completo</Label>
              <Input
                id="nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Seu nome completo"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                defaultValue={profile?.email}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                O email não pode ser alterado
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="telefone">Telefone</Label>
              <Input
                id="telefone"
                value={telefone}
                onChange={(e) => handleTelefoneChange(e.target.value)}
                placeholder="(00) 00000-0000"
                maxLength={15}
              />
            </div>
            <Button onClick={handleSaveProfile} disabled={savingProfile}>
              {savingProfile && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar alterações
            </Button>
          </CardContent>
        </Card>

        {/* Security */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Segurança
            </CardTitle>
            <CardDescription>Altere sua senha de acesso</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="senha-atual">Senha atual</Label>
              <Input
                id="senha-atual"
                type="password"
                value={senhaAtual}
                onChange={(e) => setSenhaAtual(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nova-senha">Nova senha</Label>
              <Input
                id="nova-senha"
                type="password"
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                placeholder="Mínimo 6 caracteres"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmar-senha">Confirmar nova senha</Label>
              <Input
                id="confirmar-senha"
                type="password"
                value={confirmarSenha}
                onChange={(e) => setConfirmarSenha(e.target.value)}
                placeholder="Repita a nova senha"
              />
            </div>
            <Button onClick={handleChangePassword} disabled={savingPassword}>
              {savingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Alterar senha
            </Button>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notificações
            </CardTitle>
            <CardDescription>Configure como deseja receber notificações</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Novos leads</p>
                  <p className="text-sm text-muted-foreground">
                    Receber notificação quando um novo lead for atribuído
                  </p>
                </div>
                <Button variant="outline" size="sm">Ativar</Button>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Documentos pendentes</p>
                  <p className="text-sm text-muted-foreground">
                    Alerta quando houver documentos para análise
                  </p>
                </div>
                <Button variant="outline" size="sm">Ativar</Button>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Resumo diário</p>
                  <p className="text-sm text-muted-foreground">
                    Receber resumo das atividades por email
                  </p>
                </div>
                <Button variant="outline" size="sm">Ativar</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Company Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Informações da Empresa
            </CardTitle>
            <CardDescription>Dados da associação (somente leitura)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Razão Social</Label>
              <Input value="Associação de Proteção Veicular PRATIC" disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label>CNPJ</Label>
              <Input value="00.000.000/0001-00" disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label>Versão do Sistema</Label>
              <Input value="SGA PRATIC 2.0" disabled className="bg-muted" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
