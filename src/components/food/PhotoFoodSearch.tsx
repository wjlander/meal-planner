import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Camera, Upload, X, Loader2, Search, Package } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { OpenFoodFactsService } from "@/services/openFoodFacts";
import { useAuth } from "@/hooks/useAuth";

interface PhotoFoodSearchProps {
  isOpen: boolean;
  onClose: () => void;
  onFoodItemFound: (foodItem: any) => void;
}

interface AnalysisResult {
  identifiedFoods: string[];
  confidence: string;
  suggestions: string[];
}

export function PhotoFoodSearch({ isOpen, onClose, onFoodItemFound }: PhotoFoodSearchProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isUsingCamera, setIsUsingCamera] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [photoDescription, setPhotoDescription] = useState("");
  const { toast } = useToast();
  const { user } = useAuth();

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      
      setStream(mediaStream);
      setIsUsingCamera(true);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play();
      }
    } catch (error) {
      toast({
        title: "Camera Access Required",
        description: "Please allow camera access to take photos.",
        variant: "destructive",
      });
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsUsingCamera(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    ctx.drawImage(videoRef.current, 0, 0);

    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.8);
    setSelectedImage(imageDataUrl);
    stopCamera();
    analyzePhoto(imageDataUrl);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: "Error",
        description: "Please select a valid image file",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "Error",
        description: "Image file must be less than 10MB",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const imageDataUrl = e.target?.result as string;
      setSelectedImage(imageDataUrl);
      analyzePhoto(imageDataUrl);
    };
    reader.readAsDataURL(file);
  };

  const analyzePhoto = async (imageDataUrl: string) => {
    setIsAnalyzing(true);
    setAnalysisProgress(0);
    setAnalysisResult(null);
    setSearchResults([]);

    try {
      setAnalysisProgress(25);

      // Call the Supabase edge function for AI analysis
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-food-photo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          imageUrl: imageDataUrl,
          description: photoDescription
        }),
      });

      setAnalysisProgress(50);

      if (!response.ok) {
        throw new Error(`Analysis failed: ${response.status}`);
      }

      const result = await response.json();
      setAnalysisProgress(75);

      if (!result.success) {
        throw new Error(result.error || 'Analysis failed');
      }

      const analysis: AnalysisResult = {
        identifiedFoods: result.analysis.identifiedFoods || [],
        confidence: result.analysis.confidence || 'low',
        suggestions: result.analysis.searchTerms || []
      };

      setAnalysisResult(analysis);
      setAnalysisProgress(90);

      // Search for food items based on AI suggestions
      await searchForIdentifiedFoods(analysis.suggestions);
      setAnalysisProgress(100);

    } catch (error) {
      console.error('Photo analysis error:', error);
      toast({
        title: "Error",
        description: `Failed to analyze photo: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
      setAnalysisProgress(0);
    }
  };

  const searchForIdentifiedFoods = async (searchTerms: string[]) => {
    const allResults: any[] = [];

    for (const term of searchTerms.slice(0, 3)) { // Limit to first 3 terms
      try {
        const results = await OpenFoodFactsService.searchByName(term, 1, 5);
        allResults.push(...results);
      } catch (error) {
        console.error(`Error searching for ${term}:`, error);
      }
    }

    // Remove duplicates based on barcode
    const uniqueResults = allResults.filter((item, index, self) => 
      index === self.findIndex(t => t.barcode === item.barcode)
    );

    setSearchResults(uniqueResults.slice(0, 10)); // Limit to 10 results
  };

  const addFoodItemToDatabase = async (foodItem: any) => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to add food items",
        variant: "destructive",
      });
      return;
    }

    const success = await OpenFoodFactsService.addToDatabase(foodItem, user.id);
    
    if (success) {
      toast({
        title: "Food Item Added",
        description: `Added: ${foodItem.name} to your database`,
      });
      onFoodItemFound(foodItem);
    } else {
      toast({
        title: "Error",
        description: "Failed to add item to database",
        variant: "destructive",
      });
    }
  };

  const handleClose = () => {
    stopCamera();
    setSelectedImage(null);
    setAnalysisResult(null);
    setSearchResults([]);
    setPhotoDescription("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Search Food by Photo
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {!selectedImage && !isUsingCamera && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="description">Description (Optional)</Label>
                <Input
                  id="description"
                  placeholder="Describe what food you're looking for..."
                  value={photoDescription}
                  onChange={(e) => setPhotoDescription(e.target.value)}
                />
              </div>
              
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-4">
                  Take a photo or upload an image of food to search for matching items
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Button onClick={startCamera} className="h-20 flex-col gap-2">
                  <Camera className="h-6 w-6" />
                  Take Photo
                </Button>
                
                <Button 
                  variant="outline" 
                  onClick={() => fileInputRef.current?.click()}
                  className="h-20 flex-col gap-2"
                >
                  <Upload className="h-6 w-6" />
                  Upload Image
                </Button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          )}

          {isUsingCamera && (
            <div className="space-y-4">
              <div className="relative">
                <video
                  ref={videoRef}
                  className="w-full h-64 bg-black rounded-lg object-cover"
                  autoPlay
                  muted
                  playsInline
                />
                <div className="absolute top-2 right-2">
                  <Button variant="ghost" size="icon" onClick={stopCamera}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              <div className="flex gap-2 justify-center">
                <Button onClick={capturePhoto} className="bg-gradient-primary">
                  <Camera className="h-4 w-4 mr-2" />
                  Capture Photo
                </Button>
              </div>
            </div>
          )}

          {selectedImage && (
            <div className="space-y-4">
              <div className="relative">
                <img
                  src={selectedImage}
                  alt="Selected food"
                  className="w-full h-48 object-cover rounded-lg"
                />
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="absolute top-2 right-2 bg-black/50 hover:bg-black/70"
                  onClick={() => setSelectedImage(null)}
                >
                  <X className="h-4 w-4 text-white" />
                </Button>
              </div>

              {isAnalyzing && (
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      <span className="font-medium">Analyzing photo...</span>
                    </div>
                    <Progress value={analysisProgress} className="mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Using AI to identify food items in your photo
                    </p>
                  </CardContent>
                </Card>
              )}

              {analysisResult && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Search className="h-5 w-5 text-primary" />
                      Analysis Results
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <span className="font-medium">AI Identified: </span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {analysisResult.identifiedFoods.map((food, index) => (
                          <Badge key={index} variant="default" className="bg-primary/10 text-primary">
                            {food}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Confidence: </span>
                      <Badge variant={
                        analysisResult.confidence === 'high' ? 'default' : 
                        analysisResult.confidence === 'medium' ? 'secondary' : 'outline'
                      }>
                        {analysisResult.confidence}
                      </Badge>
                    </div>
                    
                    <div className="text-sm text-muted-foreground">
                      Searching Open Food Facts for matching products...
                    </div>
                  </CardContent>
                </Card>
              )}

              {searchResults.length > 0 && (
                <div className="space-y-4">
                  <h3 className="font-semibold">Matching Food Items</h3>
                  <div className="grid gap-3 max-h-64 overflow-y-auto">
                    {searchResults.map((item, index) => (
                      <Card key={index} className="hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            {item.image_url && (
                              <img 
                                src={item.image_url} 
                                alt={item.name}
                                className="w-12 h-12 object-cover rounded"
                              />
                            )}
                            <div className="flex-1">
                              <h4 className="font-medium">{item.name}</h4>
                              {item.brand && (
                                <p className="text-sm text-muted-foreground">{item.brand}</p>
                              )}
                              <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                                <span>{item.calories_per_100g || 0} cal/100g</span>
                                <span>{item.protein_per_100g || 0}g protein</span>
                              </div>
                            </div>
                            <Button 
                              size="sm"
                              onClick={() => addFoodItemToDatabase(item)}
                            >
                              Add to Database
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {analysisResult && searchResults.length === 0 && !isAnalyzing && (
                <Card>
                  <CardContent className="p-6 text-center">
                    <Package className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      No matching items found. Try taking another photo or search manually.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}