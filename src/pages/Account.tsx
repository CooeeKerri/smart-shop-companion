import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LogOut, Users, Settings, Pencil, Check, X } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const Account = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');

  useEffect(() => {
    if (user) loadProfile();
  }, [user]);

  const loadProfile = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('user_id', user!.id)
      .single();
    if (data?.display_name) {
      setDisplayName(data.display_name);
    }
  };

  const saveName = async () => {
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: trimmed })
      .eq('user_id', user!.id);
    if (error) {
      toast({ title: 'Failed to save nickname', variant: 'destructive' });
    } else {
      setDisplayName(trimmed);
      setEditingName(false);
      toast({ title: 'Nickname updated!' });
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <AppLayout>
      <div className="px-4 pt-6 pb-4">
        <h1 className="font-display text-2xl font-bold">Account</h1>
        <p className="text-sm text-muted-foreground">{user?.email}</p>
      </div>

      <div className="px-4 space-y-3">
        {/* Nickname */}
        <Card>
          <CardContent className="p-4 space-y-2">
            <Label className="text-xs text-muted-foreground">Nickname</Label>
            {editingName ? (
              <div className="flex items-center gap-2">
                <Input
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="Enter a nickname"
                  className="h-9"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && saveName()}
                />
                <Button size="icon" variant="ghost" onClick={saveName} className="shrink-0">
                  <Check className="h-4 w-4 text-primary" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => setEditingName(false)} className="shrink-0">
                  <X className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  {displayName || 'No nickname set'}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => { setNameInput(displayName); setEditingName(true); }}
                >
                  <Pencil className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => navigate('/onboarding')}>
          <CardContent className="flex items-center gap-3 p-4">
            <Users className="h-5 w-5 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-sm font-medium">Household profile</p>
              <p className="text-xs text-muted-foreground">Update your family details</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Settings className="h-5 w-5 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-sm font-medium">Settings</p>
              <p className="text-xs text-muted-foreground">Preferences and notifications</p>
            </div>
          </CardContent>
        </Card>

        <Button
          variant="outline"
          className="w-full text-destructive hover:text-destructive"
          onClick={handleSignOut}
        >
          <LogOut className="mr-2 h-4 w-4" /> Sign out
        </Button>
      </div>
    </AppLayout>
  );
};

export default Account;
