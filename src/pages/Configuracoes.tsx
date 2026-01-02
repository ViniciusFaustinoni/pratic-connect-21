import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { User, Lock, Bell, Building, Plug } from 'lucide-react';
import { LeadApiTab } from '@/components/leads/LeadApiTab';

export default function Configuracoes() {
  const { profile, canAccessApiSettings } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Configurações</h1>
        <p className="text-muted-foreground">
          Gerencie suas preferências e configurações da conta
        </p>
      </div>

      <Tabs defaultValue="geral" className="space-y-6">
        <TabsList>
          <TabsTrigger value="geral">Geral</TabsTrigger>
          {canAccessApiSettings() && (
            <TabsTrigger value="api" className="flex items-center gap-2">
              <Plug className="h-4 w-4" />
              API/Integrações
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="geral" className="space-y-6">
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
                  <Input id="nome" defaultValue={profile?.nome} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" defaultValue={profile?.email} disabled />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="telefone">Telefone</Label>
                  <Input id="telefone" defaultValue={profile?.telefone || ''} placeholder="(00) 00000-0000" />
                </div>
                <Button>Salvar alterações</Button>
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
                  <Input id="senha-atual" type="password" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nova-senha">Nova senha</Label>
                  <Input id="nova-senha" type="password" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmar-senha">Confirmar nova senha</Label>
                  <Input id="confirmar-senha" type="password" />
                </div>
                <Button>Alterar senha</Button>
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
                  <Input value="Associação de Proteção Veicular PRATIC" disabled />
                </div>
                <div className="space-y-2">
                  <Label>CNPJ</Label>
                  <Input value="00.000.000/0001-00" disabled />
                </div>
                <div className="space-y-2">
                  <Label>Versão do Sistema</Label>
                  <Input value="SGA PRATIC 2.0" disabled />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {canAccessApiSettings() && (
          <TabsContent value="api">
            <LeadApiTab />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
