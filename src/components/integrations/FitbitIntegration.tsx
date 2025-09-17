import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Activity, Heart, Scale, Zap, ExternalLink, CheckCircle, AlertCircle, Info } from 'lucide-react';

interface FitbitProfile {
  fitbit_access_token?: string;
  fitbit_user_id?: string;
  fitbit_connected_at?: string;
}

export function FitbitIntegration() {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [fitbitProfile, setFitbitProfile] = useState<FitbitProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();

  const checkFitbitConnection = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('fitbit_access_token, fitbit_user_id, fitbit_connected_at')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error checking Fitbit connection:', error);
        return;
      }

      if (data?.fitbit_access_token) {
        setIsConnected(true);
        setFitbitProfile(data);
      } else {
        setIsConnected(false);
        setFitbitProfile(null);
      }
    } catch (error) {
      console.error('Error checking Fitbit connection:', error);
    } finally {
      setLoading(false);
    }
  };

  const connectToFitbit = async () => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to connect your Fitbit account.",
        variant: "destructive",
      });
      return;
    }

    // For now, show setup instructions instead of attempting OAuth
    toast({
      title: "Fitbit Integration Setup",
      description: "Fitbit integration requires additional server configuration. Please contact your administrator.",
    });
  };

  const disconnectFitbit = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          fitbit_access_token: null,
          fitbit_refresh_token: null,
          fitbit_user_id: null,
          fitbit_connected_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);

      if (error) {
        throw error;
      }

      setIsConnected(false);
      setFitbitProfile(null);
      
      toast({
        title: "Fitbit Disconnected",
        description: "Your Fitbit account has been disconnected.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to disconnect Fitbit account.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    checkFitbitConnection();
  }, [user]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-sm text-muted-foreground mt-2">Loading Fitbit status...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-[#00B2A9]" />
          Fitbit Integration
        </CardTitle>
        <CardDescription>
          Connect your Fitbit account to automatically sync meal data and track nutrition goals.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>Status:</span>
            <Badge variant={isConnected ? "default" : "secondary"} className="flex items-center gap-1">
              {isConnected ? (
                <>
                  <CheckCircle className="h-3 w-3" />
                  Connected
                </>
              ) : (
                <>
                  <AlertCircle className="h-3 w-3" />
                  Not Connected
                </>
              )}
            </Badge>
          </div>
          
          {isConnected && fitbitProfile?.fitbit_connected_at && (
            <span className="text-xs text-muted-foreground">
              Connected on {new Date(fitbitProfile.fitbit_connected_at).toLocaleDateString()}
            </span>
          )}
        </div>

        {isConnected ? (
          <div className="space-y-4">
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Your Fitbit account is connected! Meals will be automatically synced to your Fitbit food log.
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg">
                <Heart className="h-4 w-4 text-red-500" />
                <span className="text-sm">Heart Rate Sync</span>
              </div>
              <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg">
                <Scale className="h-4 w-4 text-blue-500" />
                <span className="text-sm">Weight Tracking</span>
              </div>
              <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg">
                <Zap className="h-4 w-4 text-yellow-500" />
                <span className="text-sm">Activity Data</span>
              </div>
              <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg">
                <Activity className="h-4 w-4 text-green-500" />
                <span className="text-sm">Nutrition Sync</span>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={disconnectFitbit} className="flex-1">
                Disconnect
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Fitbit integration requires additional server configuration with OAuth credentials. Contact your administrator to enable this feature.
              </AlertDescription>
            </Alert>

            <div className="p-4 bg-muted/30 rounded-lg">
              <h4 className="font-medium mb-2">Benefits of connecting Fitbit:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Automatic meal logging to Fitbit</li>
                <li>• Sync nutrition data with your fitness goals</li>
                <li>• Track calories burned vs consumed</li>
                <li>• Better insights into your health journey</li>
              </ul>
            </div>

            <Button 
              onClick={connectToFitbit} 
              disabled={true}
              className="w-full bg-muted text-muted-foreground cursor-not-allowed"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Connect to Fitbit (Setup Required)
            </Button>
          </div>
        )}

        <div className="text-xs text-muted-foreground">
          <p>
            By connecting your Fitbit account, you agree to share meal and nutrition data between 
            UK Meal Planner and Fitbit. You can disconnect at any time.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default FitbitIntegration;