interface UKFoodItem {
  source: 'openfoodfacts' | 'fdc' | 'tesco' | 'sainsburys';
  barcode?: string;
  name: string;
  brand?: string;
  calories_per_100g?: number;
  protein_per_100g?: number;
  carbs_per_100g?: number;
  fat_per_100g?: number;
  fiber_per_100g?: number;
  sugar_per_100g?: number;
  sodium_per_100g?: number;
  serving_size?: number;
  serving_unit?: string;
  image_url?: string;
  categories?: string[];
  price?: number;
  availability?: string;
}

interface FDCFoodItem {
  fdcId: number;
  description: string;
  brandOwner?: string;
  brandName?: string;
  foodNutrients: Array<{
    nutrientId: number;
    nutrientName: string;
    value: number;
    unitName: string;
  }>;
  packageWeight?: string;
}

interface TescoProduct {
  id: string;
  name: string;
  brand?: string;
  price: number;
  image: string;
  nutrition?: {
    per100g: {
      energy: number;
      protein: number;
      carbohydrate: number;
      fat: number;
      fibre: number;
      salt: number;
    };
  };
}

export class UKFoodDatabaseService {
  private static readonly FDC_API_KEY = 'DEMO_KEY'; // Replace with actual API key
  private static readonly FDC_BASE_URL = 'https://api.nal.usda.gov/fdc/v1';
  
  // Nutrient ID mappings for FDC API
  private static readonly NUTRIENT_IDS = {
    ENERGY: 1008, // Energy (kcal)
    PROTEIN: 1003, // Protein
    CARBS: 1005, // Carbohydrate
    FAT: 1004, // Total lipid (fat)
    FIBER: 1079, // Fiber
    SUGARS: 2000, // Sugars
    SODIUM: 1093, // Sodium
  };

  static async searchAllDatabases(query: string): Promise<UKFoodItem[]> {
    const results: UKFoodItem[] = [];
    
    try {
      // Search Open Food Facts (existing)
      const offResults = await this.searchOpenFoodFacts(query);
      results.push(...offResults);
      
      // Search USDA FoodData Central (has many UK products)
      const fdcResults = await this.searchFoodDataCentral(query);
      results.push(...fdcResults);
      
      // Search Tesco API (simulated - would need real API access)
      const tescoResults = await this.searchTescoAPI(query);
      results.push(...tescoResults);
      
      // Remove duplicates based on name similarity
      return this.removeDuplicates(results);
    } catch (error) {
      console.error('Error searching food databases:', error);
      return results; // Return partial results
    }
  }

  static async searchByBarcodeAllDatabases(barcode: string): Promise<UKFoodItem | null> {
    try {
      // Try Open Food Facts first (most comprehensive for barcodes)
      const offResult = await this.searchOpenFoodFactsByBarcode(barcode);
      if (offResult) return offResult;
      
      // Try other databases if needed
      // Note: Most other APIs don't support barcode lookup directly
      
      return null;
    } catch (error) {
      console.error('Error searching barcode in databases:', error);
      return null;
    }
  }

  private static async searchOpenFoodFacts(query: string): Promise<UKFoodItem[]> {
    try {
      const response = await fetch(
        `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=10&countries=United%20Kingdom`
      );
      
      if (!response.ok) return [];
      
      const data = await response.json();
      
      return (data.products || []).map((product: any) => ({
        source: 'openfoodfacts' as const,
        barcode: product.code,
        name: product.product_name || 'Unknown Product',
        brand: product.brands,
        calories_per_100g: product.nutriments?.['energy-kcal_100g'],
        protein_per_100g: product.nutriments?.['proteins_100g'],
        carbs_per_100g: product.nutriments?.['carbohydrates_100g'],
        fat_per_100g: product.nutriments?.['fat_100g'],
        fiber_per_100g: product.nutriments?.['fiber_100g'],
        sugar_per_100g: product.nutriments?.['sugars_100g'],
        sodium_per_100g: product.nutriments?.['sodium_100g'] ? product.nutriments['sodium_100g'] * 1000 : undefined,
        image_url: product.image_url,
        categories: product.categories ? product.categories.split(',').map((c: string) => c.trim()) : [],
      })).filter((item: UKFoodItem) => item.name !== 'Unknown Product');
    } catch (error) {
      console.error('Error searching Open Food Facts:', error);
      return [];
    }
  }

  private static async searchOpenFoodFactsByBarcode(barcode: string): Promise<UKFoodItem | null> {
    try {
      const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json`);
      
      if (!response.ok) return null;
      
      const data = await response.json();
      
      if (data.status === 0) return null;
      
      const product = data.product;
      
      return {
        source: 'openfoodfacts',
        barcode: data.code,
        name: product.product_name || 'Unknown Product',
        brand: product.brands,
        calories_per_100g: product.nutriments?.['energy-kcal_100g'],
        protein_per_100g: product.nutriments?.['proteins_100g'],
        carbs_per_100g: product.nutriments?.['carbohydrates_100g'],
        fat_per_100g: product.nutriments?.['fat_100g'],
        fiber_per_100g: product.nutriments?.['fiber_100g'],
        sugar_per_100g: product.nutriments?.['sugars_100g'],
        sodium_per_100g: product.nutriments?.['sodium_100g'] ? product.nutriments['sodium_100g'] * 1000 : undefined,
        image_url: product.image_url,
        categories: product.categories ? product.categories.split(',').map((c: string) => c.trim()) : [],
      };
    } catch (error) {
      console.error('Error searching Open Food Facts by barcode:', error);
      return null;
    }
  }

  private static async searchFoodDataCentral(query: string): Promise<UKFoodItem[]> {
    try {
      // Search FoodData Central for UK/international products
      const response = await fetch(
        `${this.FDC_BASE_URL}/foods/search?query=${encodeURIComponent(query)}&dataType=Branded&pageSize=10&api_key=${this.FDC_API_KEY}`
      );
      
      if (!response.ok) return [];
      
      const data = await response.json();
      
      return (data.foods || []).map((food: FDCFoodItem) => {
        const nutrients = food.foodNutrients || [];
        
        const getNutrientValue = (nutrientId: number) => {
          const nutrient = nutrients.find(n => n.nutrientId === nutrientId);
          return nutrient?.value;
        };
        
        return {
          source: 'fdc' as const,
          name: food.description,
          brand: food.brandOwner || food.brandName,
          calories_per_100g: getNutrientValue(this.NUTRIENT_IDS.ENERGY),
          protein_per_100g: getNutrientValue(this.NUTRIENT_IDS.PROTEIN),
          carbs_per_100g: getNutrientValue(this.NUTRIENT_IDS.CARBS),
          fat_per_100g: getNutrientValue(this.NUTRIENT_IDS.FAT),
          fiber_per_100g: getNutrientValue(this.NUTRIENT_IDS.FIBER),
          sugar_per_100g: getNutrientValue(this.NUTRIENT_IDS.SUGARS),
          sodium_per_100g: getNutrientValue(this.NUTRIENT_IDS.SODIUM),
          categories: ['Branded Food'],
        };
      }).filter((item: UKFoodItem) => item.name && item.calories_per_100g);
    } catch (error) {
      console.error('Error searching FoodData Central:', error);
      return [];
    }
  }

  private static async searchTescoAPI(query: string): Promise<UKFoodItem[]> {
    // Note: This is a simulated implementation
    // Real Tesco API would require partnership/API access
    try {
      // Simulated Tesco products for common UK items
      const mockTescoProducts: TescoProduct[] = [
        {
          id: 'tesco_001',
          name: 'Tesco Everyday Value White Bread',
          brand: 'Tesco',
          price: 0.36,
          image: 'https://images.pexels.com/photos/209206/pexels-photo-209206.jpeg',
          nutrition: {
            per100g: {
              energy: 265,
              protein: 9.4,
              carbohydrate: 49.3,
              fat: 3.2,
              fibre: 2.7,
              salt: 1.0,
            }
          }
        },
        {
          id: 'tesco_002',
          name: 'Tesco Semi Skimmed Milk',
          brand: 'Tesco',
          price: 1.30,
          image: 'https://images.pexels.com/photos/416978/pexels-photo-416978.jpeg',
          nutrition: {
            per100g: {
              energy: 46,
              protein: 3.4,
              carbohydrate: 4.8,
              fat: 1.5,
              fibre: 0,
              salt: 0.1,
            }
          }
        }
      ];

      const filtered = mockTescoProducts.filter(product => 
        product.name.toLowerCase().includes(query.toLowerCase()) ||
        product.brand?.toLowerCase().includes(query.toLowerCase())
      );

      return filtered.map(product => ({
        source: 'tesco' as const,
        name: product.name,
        brand: product.brand,
        calories_per_100g: product.nutrition?.per100g.energy,
        protein_per_100g: product.nutrition?.per100g.protein,
        carbs_per_100g: product.nutrition?.per100g.carbohydrate,
        fat_per_100g: product.nutrition?.per100g.fat,
        fiber_per_100g: product.nutrition?.per100g.fibre,
        sodium_per_100g: product.nutrition?.per100g.salt ? product.nutrition.per100g.salt * 1000 : undefined,
        image_url: product.image,
        categories: ['UK Supermarket'],
        price: product.price,
        availability: 'Tesco stores',
      }));
    } catch (error) {
      console.error('Error searching Tesco API:', error);
      return [];
    }
  }

  private static removeDuplicates(items: UKFoodItem[]): UKFoodItem[] {
    const seen = new Set<string>();
    return items.filter(item => {
      const key = `${item.name.toLowerCase()}_${item.brand?.toLowerCase() || ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  static async addToDatabase(foodItem: UKFoodItem, userId: string): Promise<boolean> {
    try {
      const { error } = await supabase.from('food_items').insert({
        user_id: userId,
        name: foodItem.name,
        brand: foodItem.brand,
        barcode: foodItem.barcode,
        calories_per_100g: foodItem.calories_per_100g,
        protein_per_100g: foodItem.protein_per_100g,
        carbs_per_100g: foodItem.carbs_per_100g,
        fat_per_100g: foodItem.fat_per_100g,
        fiber_per_100g: foodItem.fiber_per_100g,
        sugar_per_100g: foodItem.sugar_per_100g,
        sodium_per_100g: foodItem.sodium_per_100g,
        serving_size: foodItem.serving_size,
        serving_unit: foodItem.serving_unit,
        is_public: true,
      });
      
      if (error) {
        console.error('Error adding food item to database:', error);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error adding food item to database:', error);
      return false;
    }
  }
}

// Re-export for backward compatibility
export { UKFoodDatabaseService as OpenFoodFactsService };

// Import Supabase client
import { supabase } from "@/integrations/supabase/client";