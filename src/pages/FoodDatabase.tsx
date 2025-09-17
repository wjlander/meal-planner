import { useState, useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { BarcodeScanner } from "@/components/barcode/BarcodeScanner";
import { PhotoFoodSearch } from "@/components/food/PhotoFoodSearch";
import { useToast } from "@/hooks/use-toast";
import { UKFoodDatabaseService } from "@/services/ukFoodDatabases";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { 
  Scan, 
  Package, 
  Plus, 
  Search,
  Camera,
  Apple,
  Wheat,
  Beef,
  Loader2,
  Download
} from "lucide-react";

interface FoodItem {
  id: string;
  barcode: string;
  name: string;
  brand?: string;
  calories_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
  fiber_per_100g?: number;
  sugar_per_100g?: number;
  sodium_per_100g?: number;
  serving_size?: number;
  serving_unit?: string;
  image_url?: string;
  categories?: string[];
  is_public?: boolean;
}

const getCategoryIcon = (categories?: string[]) => {
  if (!categories || categories.length === 0) return Package;
  
  const category = categories[0].toLowerCase();
  if (category.includes('fruit')) return Apple;
  if (category.includes('bread') || category.includes('cereal')) return Wheat;
  if (category.includes('meat') || category.includes('fish')) return Beef;
  return Package;
};

const getPrimaryCategory = (categories?: string[]) => {
  if (!categories || categories.length === 0) return 'Food';
  return categories[0];
};

const getCategoryColor = (categories?: string[]) => {
  if (!categories || categories.length === 0) return 'bg-gray-100 text-gray-800';
  
  const category = categories[0].toLowerCase();
  switch (true) {
    case 'fruits': return Apple;
    case 'bakery': return Wheat;
    case 'meat': return Beef;
    default: return Package;
  }
};

export default function FoodDatabase() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isPhotoSearchOpen, setIsPhotoSearchOpen] = useState(false);
  const [isManualDialogOpen, setIsManualDialogOpen] = useState(false);
  const [foodItems, setFoodItems] = useState<FoodItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<FoodItem[]>([]);
  const [manualFormData, setManualFormData] = useState({
    name: '',
    brand: '',
    barcode: '',
    calories_per_100g: '',
    protein_per_100g: '',
    carbs_per_100g: '',
    fat_per_100g: '',
    fiber_per_100g: '',
    sugar_per_100g: '',
    sodium_per_100g: '',
    serving_size: '',
    serving_unit: 'g',
  });
  const { toast } = useToast();
  const { user } = useAuth();

  const loadFoodItems = async () => {
    const { data, error } = await supabase
      .from('food_items')
      .select('*')
      .order('name');

    if (error) {
      toast({
        title: "Error",
        description: "Failed to load food items",
        variant: "destructive",
      });
      return;
    }

    setFoodItems(data || []);
  };

  const handleBarcodeScanned = async (barcode: string) => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to scan barcodes",
        variant: "destructive",
      });
      return;
    }

    // First check if item exists in our database
    const { data: existingItem } = await supabase
      .from('food_items')
      .select('*')
      .eq('barcode', barcode)
      .maybeSingle();

    if (existingItem) {
      toast({
        title: "Food Item Found",
        description: `Found: ${existingItem.name}${existingItem.brand ? ` by ${existingItem.brand}` : ''}`,
      });
      return;
    }

    // If not found, search Open Food Facts
    setIsSearching(true);
    try {
      const foodItem = await UKFoodDatabaseService.searchByBarcodeAllDatabases(barcode);
      
      if (foodItem) {
        // Add to our database
        const success = await UKFoodDatabaseService.addToDatabase(foodItem, user.id);
        
        if (success) {
          toast({
            title: "Food Item Added",
            description: `Added: ${foodItem.name}${foodItem.brand ? ` by ${foodItem.brand}` : ''} from ${foodItem.source}`,
          });
          loadFoodItems(); // Refresh the list
        } else {
          toast({
            title: "Error",
            description: "Failed to add item to database",
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Item Not Found",
          description: "This item is not in any UK food database. Would you like to add it manually?",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to search for item",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
    
    setIsScannerOpen(false);
  };

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;
    
    setIsSearching(true);
    try {
      const results = await UKFoodDatabaseService.searchAllDatabases(searchTerm);
      setSearchResults(results);
      
      if (results.length === 0) {
        toast({
          title: "No Results",
          description: "No food items found for your search",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to search food items",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  const addSearchResultToDatabase = async (foodItem: FoodItem) => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to add food items",
        variant: "destructive",
      });
      return;
    }

    const success = await UKFoodDatabaseService.addToDatabase(foodItem, user.id);
    
    if (success) {
      toast({
        title: "Food Item Added",
        description: `Added: ${foodItem.name} to your database`,
      });
      loadFoodItems();
    } else {
      toast({
        title: "Error",
        description: "Failed to add item to database",
        variant: "destructive",
      });
    }
  };

  const handleManualAdd = async () => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to add food items",
        variant: "destructive",
      });
      return;
    }

    if (!manualFormData.name.trim()) {
      toast({
        title: "Error",
        description: "Food name is required",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('food_items')
        .insert({
          user_id: user.id,
          name: manualFormData.name.trim(),
          brand: manualFormData.brand.trim() || null,
          barcode: manualFormData.barcode.trim() || null,
          calories_per_100g: parseFloat(manualFormData.calories_per_100g) || null,
          protein_per_100g: parseFloat(manualFormData.protein_per_100g) || null,
          carbs_per_100g: parseFloat(manualFormData.carbs_per_100g) || null,
          fat_per_100g: parseFloat(manualFormData.fat_per_100g) || null,
          fiber_per_100g: parseFloat(manualFormData.fiber_per_100g) || null,
          sugar_per_100g: parseFloat(manualFormData.sugar_per_100g) || null,
          sodium_per_100g: parseFloat(manualFormData.sodium_per_100g) || null,
          serving_size: parseFloat(manualFormData.serving_size) || null,
          serving_unit: manualFormData.serving_unit,
          is_public: false,
        });

      if (error) {
        throw error;
      }

      toast({
        title: "Success",
        description: `Added ${manualFormData.name} to your food database`,
      });

      setIsManualDialogOpen(false);
      resetManualForm();
      loadFoodItems();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add food item",
        variant: "destructive",
      });
    }
  };

  const resetManualForm = () => {
    setManualFormData({
      name: '',
      brand: '',
      barcode: '',
      calories_per_100g: '',
      protein_per_100g: '',
      carbs_per_100g: '',
      fat_per_100g: '',
      fiber_per_100g: '',
      sugar_per_100g: '',
      sodium_per_100g: '',
      serving_size: '',
      serving_unit: 'g',
    });
  };

  const filteredItems = foodItems.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.categories?.some(cat => cat.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const displayItems = searchResults.length > 0 ? searchResults : filteredItems;

  useEffect(() => {
    loadFoodItems();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">Food Database</h1>
            <p className="text-muted-foreground">
              Scan barcodes or search for food items using Open Food Facts
            </p>
            <Badge variant="outline" className="mt-2">
              Now searching: Open Food Facts • USDA FDC • Tesco • Sainsbury's
            </Badge>
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={() => setIsScannerOpen(true)}
              className="bg-gradient-primary"
              disabled={isSearching}
            >
              {isSearching ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Scan className="h-4 w-4 mr-2" />
              )}
              {isSearching ? "Searching..." : "Scan Barcode"}
            </Button>
            <Button 
              onClick={() => setIsPhotoSearchOpen(true)}
              variant="outline"
              disabled={isSearching}
            >
              <Camera className="h-4 w-4 mr-2" />
              Search by Photo
            </Button>
            <Button 
              variant="outline"
              onClick={() => setIsManualDialogOpen(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Manual
            </Button>
          </div>
        </div>

        <div className="mb-6">
          <div className="flex gap-2">
            <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search food items from UK databases..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>
            <Button 
              onClick={handleSearch}
              disabled={isSearching || !searchTerm.trim()}
            >
              {isSearching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
          </div>
          
          {searchResults.length > 0 && (
            <div className="mt-2 flex items-center gap-2">
              <Badge variant="outline">
                {searchResults.length} results from UK food databases
              </Badge>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => {
                  setSearchResults([]);
                  setSearchTerm("");
                }}
              >
                Clear Results
              </Button>
            </div>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {displayItems.map((item, index) => {
            const CategoryIcon = getCategoryIcon(item.categories);
            const isSearchResult = searchResults.length > 0;
            
            return (
              <Card key={item.id || `search-${index}`} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      {item.image_url && (
                        <img 
                          src={item.image_url} 
                          alt={item.name}
                          className="w-12 h-12 object-cover rounded"
                        />
                      )}
                      <CategoryIcon className="h-5 w-5 text-primary" />
                      <div>
                        <CardTitle className="text-lg">{item.name}</CardTitle>
                        {item.brand && (
                          <p className="text-sm text-muted-foreground">{item.brand}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <Badge variant="outline">{getPrimaryCategory(item.categories)}</Badge>
                      <Badge variant="secondary" className="text-xs">
                        {item.source === 'openfoodfacts' ? 'Open Food Facts' : 
                         item.source === 'fdc' ? 'USDA FDC' :
                         item.source === 'tesco' ? 'Tesco' :
                         item.source === 'sainsburys' ? 'Sainsbury\'s' : 'Database'}
                      </Badge>
                      {isSearchResult && (
                        <Badge variant="secondary" className="text-xs">
                          <Download className="h-3 w-3 mr-1" />
                          Import
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="text-center p-2 bg-muted rounded">
                      <p className="font-medium">{item.calories_per_100g || 0}</p>
                      <p className="text-xs text-muted-foreground">Calories</p>
                    </div>
                    <div className="text-center p-2 bg-muted rounded">
                      <p className="font-medium">{item.protein_per_100g || 0}g</p>
                      <p className="text-xs text-muted-foreground">Protein</p>
                    </div>
                    <div className="text-center p-2 bg-muted rounded">
                      <p className="font-medium">{item.carbs_per_100g || 0}g</p>
                      <p className="text-xs text-muted-foreground">Carbs</p>
                    </div>
                    <div className="text-center p-2 bg-muted rounded">
                      <p className="font-medium">{item.fat_per_100g || 0}g</p>
                      <p className="text-xs text-muted-foreground">Fat</p>
                    </div>
                    {item.price && (
                      <div className="text-center p-2 bg-muted rounded">
                        <p className="font-medium">£{item.price.toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground">Price</p>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex gap-2">
                    {isSearchResult ? (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex-1"
                        onClick={() => addSearchResultToDatabase(item)}
                      >
                        <Download className="h-4 w-4 mr-1" />
                        Add to Database
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" className="flex-1">
                        Add to Meal
                      </Button>
                    )}
                    <Button variant="outline" size="sm" className="flex-1">
                      View Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {displayItems.length === 0 && !isSearching && (
          <div className="text-center py-12">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No food items found</h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm ? "Try a different search term or scan a barcode" : "Scan a barcode, search by photo, or search to find food items from UK databases"}
            </p>
            <Button onClick={() => setIsScannerOpen(true)} className="bg-gradient-primary">
              <Scan className="h-4 w-4 mr-2" />
              Scan Barcode
            </Button>
          </div>
        )}

        {isSearching && (
          <div className="text-center py-12">
            <Loader2 className="h-12 w-12 text-primary mx-auto mb-4 animate-spin" />
            <h3 className="text-lg font-semibold mb-2">Searching UK Food Databases</h3>
            <p className="text-muted-foreground">
              Searching Open Food Facts, USDA FDC, and UK supermarket databases...
            </p>
          </div>
        )}

        <BarcodeScanner
          isOpen={isScannerOpen}
          onClose={() => setIsScannerOpen(false)}
          onBarcodeScanned={handleBarcodeScanned}
        />

        <PhotoFoodSearch
          isOpen={isPhotoSearchOpen}
          onClose={() => setIsPhotoSearchOpen(false)}
          onFoodItemFound={(foodItem) => {
            toast({
              title: "Food Item Found",
              description: `Found: ${foodItem.name}`,
            });
            loadFoodItems();
          }}
        />

        <Dialog open={isManualDialogOpen} onOpenChange={setIsManualDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Food Item Manually</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="manual_name">Food Name *</Label>
                  <Input
                    id="manual_name"
                    placeholder="e.g., Organic Bananas"
                    value={manualFormData.name}
                    onChange={(e) => setManualFormData(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="manual_brand">Brand</Label>
                  <Input
                    id="manual_brand"
                    placeholder="e.g., Tesco"
                    value={manualFormData.brand}
                    onChange={(e) => setManualFormData(prev => ({ ...prev, brand: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="manual_barcode">Barcode (Optional)</Label>
                <Input
                  id="manual_barcode"
                  placeholder="1234567890123"
                  value={manualFormData.barcode}
                  onChange={(e) => setManualFormData(prev => ({ ...prev, barcode: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Nutrition per 100g</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="manual_calories">Calories</Label>
                    <Input
                      id="manual_calories"
                      type="number"
                      step="0.1"
                      placeholder="0"
                      value={manualFormData.calories_per_100g}
                      onChange={(e) => setManualFormData(prev => ({ ...prev, calories_per_100g: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="manual_protein">Protein (g)</Label>
                    <Input
                      id="manual_protein"
                      type="number"
                      step="0.1"
                      placeholder="0"
                      value={manualFormData.protein_per_100g}
                      onChange={(e) => setManualFormData(prev => ({ ...prev, protein_per_100g: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="manual_carbs">Carbs (g)</Label>
                    <Input
                      id="manual_carbs"
                      type="number"
                      step="0.1"
                      placeholder="0"
                      value={manualFormData.carbs_per_100g}
                      onChange={(e) => setManualFormData(prev => ({ ...prev, carbs_per_100g: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="manual_fat">Fat (g)</Label>
                    <Input
                      id="manual_fat"
                      type="number"
                      step="0.1"
                      placeholder="0"
                      value={manualFormData.fat_per_100g}
                      onChange={(e) => setManualFormData(prev => ({ ...prev, fat_per_100g: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="manual_fiber">Fiber (g)</Label>
                    <Input
                      id="manual_fiber"
                      type="number"
                      step="0.1"
                      placeholder="0"
                      value={manualFormData.fiber_per_100g}
                      onChange={(e) => setManualFormData(prev => ({ ...prev, fiber_per_100g: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="manual_sugar">Sugar (g)</Label>
                    <Input
                      id="manual_sugar"
                      type="number"
                      step="0.1"
                      placeholder="0"
                      value={manualFormData.sugar_per_100g}
                      onChange={(e) => setManualFormData(prev => ({ ...prev, sugar_per_100g: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="manual_sodium">Sodium (mg)</Label>
                    <Input
                      id="manual_sodium"
                      type="number"
                      step="0.1"
                      placeholder="0"
                      value={manualFormData.sodium_per_100g}
                      onChange={(e) => setManualFormData(prev => ({ ...prev, sodium_per_100g: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="manual_serving_size">Serving Size</Label>
                  <Input
                    id="manual_serving_size"
                    type="number"
                    step="0.1"
                    placeholder="100"
                    value={manualFormData.serving_size}
                    onChange={(e) => setManualFormData(prev => ({ ...prev, serving_size: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="manual_serving_unit">Unit</Label>
                  <Input
                    id="manual_serving_unit"
                    placeholder="g"
                    value={manualFormData.serving_unit}
                    onChange={(e) => setManualFormData(prev => ({ ...prev, serving_unit: e.target.value }))}
                  />
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <Button 
                  variant="outline" 
                  onClick={() => setIsManualDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button onClick={handleManualAdd}>
                  Add Food Item
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}