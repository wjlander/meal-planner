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
      
      // Search Sainsbury's API (simulated)
      const sainsburysResults = await this.searchSainsburysAPI(query);
      results.push(...sainsburysResults);
      
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
      
      // Try FoodData Central (some products have UPC codes)
      const fdcResult = await this.searchFoodDataCentralByBarcode(barcode);
      if (fdcResult) return fdcResult;
      
      // Try simulated UK supermarket databases
      const tescoResult = await this.searchTescoByBarcode(barcode);
      if (tescoResult) return tescoResult;
      
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

  private static async searchFoodDataCentralByBarcode(barcode: string): Promise<UKFoodItem | null> {
    try {
      // Search FDC by UPC (barcode)
      const response = await fetch(
        `${this.FDC_BASE_URL}/foods/search?query=${barcode}&dataType=Branded&pageSize=5&api_key=${this.FDC_API_KEY}`
      );
      
      if (!response.ok) return null;
      
      const data = await response.json();
      const foods = data.foods || [];
      
      // Look for exact barcode match in the results
      const matchingFood = foods.find((food: any) => 
        food.gtinUpc === barcode || 
        food.ingredients?.includes(barcode) ||
        food.description?.includes(barcode)
      );
      
      if (!matchingFood) return null;
      
      const nutrients = matchingFood.foodNutrients || [];
      
      const getNutrientValue = (nutrientId: number) => {
        const nutrient = nutrients.find((n: any) => n.nutrientId === nutrientId);
        return nutrient?.value;
      };
      
      return {
        source: 'fdc',
        barcode,
        name: matchingFood.description,
        brand: matchingFood.brandOwner || matchingFood.brandName,
        calories_per_100g: getNutrientValue(this.NUTRIENT_IDS.ENERGY),
        protein_per_100g: getNutrientValue(this.NUTRIENT_IDS.PROTEIN),
        carbs_per_100g: getNutrientValue(this.NUTRIENT_IDS.CARBS),
        fat_per_100g: getNutrientValue(this.NUTRIENT_IDS.FAT),
        fiber_per_100g: getNutrientValue(this.NUTRIENT_IDS.FIBER),
        sugar_per_100g: getNutrientValue(this.NUTRIENT_IDS.SUGARS),
        sodium_per_100g: getNutrientValue(this.NUTRIENT_IDS.SODIUM),
        categories: ['Branded Food'],
      };
    } catch (error) {
      console.error('Error searching FDC by barcode:', error);
      return null;
    }
  }

  private static async searchTescoByBarcode(barcode: string): Promise<UKFoodItem | null> {
    try {
      // Simulated Tesco barcode lookup
      const mockTescoBarcodes: Record<string, TescoProduct> = {
        '5010026517661': {
          id: 'tesco_bread_001',
          name: 'Tesco Everyday Value White Bread 800g',
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
        '5000169086926': {
          id: 'tesco_milk_001',
          name: 'Tesco Semi Skimmed Milk 2 Pints',
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
        },
        '5000169005743': {
          id: 'tesco_pasta_001',
          name: 'Tesco Penne Pasta 500g',
          brand: 'Tesco',
          price: 0.70,
          image: 'https://images.pexels.com/photos/1437267/pexels-photo-1437267.jpeg',
          nutrition: {
            per100g: {
              energy: 350,
              protein: 12.0,
              carbohydrate: 70.0,
              fat: 1.5,
              fibre: 3.0,
              salt: 0.01,
            }
          }
        }
      };

      const product = mockTescoBarcodes[barcode];
      if (!product) return null;

      return {
        source: 'tesco',
        barcode,
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
      };
    } catch (error) {
      console.error('Error searching Tesco by barcode:', error);
      return null;
    }
  }

  private static async searchFoodDataCentral(query: string): Promise<UKFoodItem[]> {
    try {
      // Search FoodData Central for UK/international products with enhanced filtering
      const response = await fetch(
        `${this.FDC_BASE_URL}/foods/search?query=${encodeURIComponent(query)}&dataType=Branded,Foundation&pageSize=15&api_key=${this.FDC_API_KEY}`
      );
      
      if (!response.ok) return [];
      
      const data = await response.json();
      
      return (data.foods || [])
        .filter((food: any) => {
          // Filter for UK-relevant products
          const description = food.description?.toLowerCase() || '';
          const brand = (food.brandOwner || food.brandName || '').toLowerCase();
          
          // Include if it's a common food item or UK brand
          return description.length > 0 && (
            // Common food terms
            ['bread', 'milk', 'cheese', 'chicken', 'beef', 'pasta', 'rice', 'oats', 'cereal', 'yogurt', 'butter', 'eggs'].some(term => description.includes(term)) ||
            // UK/International brands available in UK
            ['tesco', 'sainsbury', 'asda', 'morrisons', 'waitrose', 'marks', 'spencer', 'co-op', 'iceland', 'aldi', 'lidl', 'nestle', 'unilever', 'kraft', 'kellogg'].some(brand_term => brand.includes(brand_term))
          );
        })
        .map((food: FDCFoodItem) => {
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
          categories: ['USDA Database'],
        };
      }).filter((item: UKFoodItem) => item.name && item.calories_per_100g);
    } catch (error) {
      console.error('Error searching FoodData Central:', error);
      return [];
    }
  }

  private static async searchTescoAPI(query: string): Promise<UKFoodItem[]> {
    try {
      // Expanded simulated Tesco products database
      const mockTescoProducts: TescoProduct[] = [
        {
          id: 'tesco_bread_001',
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
          id: 'tesco_milk_001',
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
        },
        {
          id: 'tesco_pasta_001',
          name: 'Tesco Penne Pasta',
          brand: 'Tesco',
          price: 0.70,
          image: 'https://images.pexels.com/photos/1437267/pexels-photo-1437267.jpeg',
          nutrition: {
            per100g: {
              energy: 350,
              protein: 12.0,
              carbohydrate: 70.0,
              fat: 1.5,
              fibre: 3.0,
              salt: 0.01,
            }
          }
        },
        {
          id: 'tesco_chicken_001',
          name: 'Tesco British Chicken Breast',
          brand: 'Tesco',
          price: 3.50,
          image: 'https://images.pexels.com/photos/616354/pexels-photo-616354.jpeg',
          nutrition: {
            per100g: {
              energy: 165,
              protein: 31.0,
              carbohydrate: 0,
              fat: 3.6,
              fibre: 0,
              salt: 0.1,
            }
          }
        },
        {
          id: 'tesco_rice_001',
          name: 'Tesco Basmati Rice',
          brand: 'Tesco',
          price: 2.00,
          image: 'https://images.pexels.com/photos/723198/pexels-photo-723198.jpeg',
          nutrition: {
            per100g: {
              energy: 345,
              protein: 7.5,
              carbohydrate: 78.0,
              fat: 0.9,
              fibre: 1.3,
              salt: 0.01,
            }
          }
        },
        {
          id: 'tesco_cheese_001',
          name: 'Tesco Mature Cheddar Cheese',
          brand: 'Tesco',
          price: 2.50,
          image: 'https://images.pexels.com/photos/773253/pexels-photo-773253.jpeg',
          nutrition: {
            per100g: {
              energy: 416,
              protein: 25.0,
              carbohydrate: 0.1,
              fat: 34.9,
              fibre: 0,
              salt: 1.8,
            }
          }
        },
        {
          id: 'tesco_banana_001',
          name: 'Tesco Bananas',
          brand: 'Tesco',
          price: 0.68,
          image: 'https://images.pexels.com/photos/61127/pexels-photo-61127.jpeg',
          nutrition: {
            per100g: {
              energy: 89,
              protein: 1.1,
              carbohydrate: 22.8,
              fat: 0.3,
              fibre: 2.6,
              salt: 0.001,
            }
          }
        },
        {
          id: 'tesco_oats_001',
          name: 'Tesco Porridge Oats',
          brand: 'Tesco',
          price: 1.20,
          image: 'https://images.pexels.com/photos/216951/pexels-photo-216951.jpeg',
          nutrition: {
            per100g: {
              energy: 379,
              protein: 11.2,
              carbohydrate: 60.0,
              fat: 8.0,
              fibre: 9.0,
              salt: 0.02,
            }
          }
        },
        {
          id: 'tesco_pasta_001',
          name: 'Tesco Penne Pasta 500g',
          brand: 'Tesco',
          price: 0.70,
          image: 'https://images.pexels.com/photos/1437267/pexels-photo-1437267.jpeg',
          nutrition: {
            per100g: {
              energy: 350,
              protein: 12.0,
              carbohydrate: 70.0,
              fat: 1.5,
              fibre: 3.0,
              salt: 0.01,
            }
          }
        },
        {
          id: 'tesco_chicken_001',
          name: 'Tesco British Chicken Breast Fillets',
          brand: 'Tesco',
          price: 3.50,
          image: 'https://images.pexels.com/photos/616354/pexels-photo-616354.jpeg',
          nutrition: {
            per100g: {
              energy: 165,
              protein: 31.0,
              carbohydrate: 0,
              fat: 3.6,
              fibre: 0,
              salt: 0.1,
            }
          }
        },
        {
          id: 'tesco_rice_001',
          name: 'Tesco Basmati Rice 1kg',
          brand: 'Tesco',
          price: 2.00,
          image: 'https://images.pexels.com/photos/723198/pexels-photo-723198.jpeg',
          nutrition: {
            per100g: {
              energy: 345,
              protein: 7.5,
              carbohydrate: 78.0,
              fat: 0.9,
              fibre: 1.3,
              salt: 0.01,
            }
          }
        },
        {
          id: 'tesco_cheese_001',
          name: 'Tesco Mature Cheddar Cheese 200g',
          brand: 'Tesco',
          price: 2.50,
          image: 'https://images.pexels.com/photos/773253/pexels-photo-773253.jpeg',
          nutrition: {
            per100g: {
              energy: 416,
              protein: 25.0,
              carbohydrate: 0.1,
              fat: 34.9,
              fibre: 0,
              salt: 1.8,
            }
          }
        },
        {
          id: 'tesco_banana_001',
          name: 'Tesco Bananas Loose',
          brand: 'Tesco',
          price: 0.68,
          image: 'https://images.pexels.com/photos/61127/pexels-photo-61127.jpeg',
          nutrition: {
            per100g: {
              energy: 89,
              protein: 1.1,
              carbohydrate: 22.8,
              fat: 0.3,
              fibre: 2.6,
              salt: 0.001,
            }
          }
        },
        {
          id: 'tesco_oats_001',
          name: 'Tesco Porridge Oats 1kg',
          brand: 'Tesco',
          price: 1.20,
          image: 'https://images.pexels.com/photos/216951/pexels-photo-216951.jpeg',
          nutrition: {
            per100g: {
              energy: 379,
              protein: 11.2,
              carbohydrate: 60.0,
              fat: 8.0,
              fibre: 9.0,
              salt: 0.02,
            }
          }
        },
        {
          id: 'tesco_yogurt_001',
          name: 'Tesco Greek Style Natural Yogurt',
          brand: 'Tesco',
          price: 1.00,
          image: 'https://images.pexels.com/photos/1435735/pexels-photo-1435735.jpeg',
          nutrition: {
            per100g: {
              energy: 97,
              protein: 9.0,
              carbohydrate: 4.0,
              fat: 5.0,
              fibre: 0,
              salt: 0.1,
            }
          }
        },
        {
          id: 'tesco_eggs_001',
          name: 'Tesco British Free Range Eggs Large',
          brand: 'Tesco',
          price: 2.25,
          image: 'https://images.pexels.com/photos/162712/egg-white-food-protein-162712.jpeg',
          nutrition: {
            per100g: {
              energy: 155,
              protein: 13.0,
              carbohydrate: 1.1,
              fat: 11.0,
              fibre: 0,
              salt: 0.3,
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

  // Add Sainsbury's simulated API
  private static async searchSainsburysAPI(query: string): Promise<UKFoodItem[]> {
    try {
      const mockSainsburysProducts = [
        {
          id: 'sainsburys_001',
          name: 'Sainsbury\'s Taste the Difference Sourdough Bread',
          brand: 'Sainsbury\'s',
          price: 1.50,
          image: 'https://images.pexels.com/photos/1775043/pexels-photo-1775043.jpeg',
          nutrition: {
            per100g: {
              energy: 250,
              protein: 8.5,
              carbohydrate: 45.0,
              fat: 3.8,
              fibre: 4.2,
              salt: 1.2,
            }
          }
        },
        {
          id: 'sainsburys_002',
          name: 'Sainsbury\'s Organic Whole Milk',
          brand: 'Sainsbury\'s',
          price: 1.45,
          image: 'https://images.pexels.com/photos/248412/pexels-photo-248412.jpeg',
          nutrition: {
            per100g: {
              energy: 68,
              protein: 3.3,
              carbohydrate: 4.8,
              fat: 4.0,
              fibre: 0,
              salt: 0.1,
            }
          }
        },
        {
          id: 'sainsburys_003',
          name: 'Sainsbury\'s British Beef Mince 5% Fat',
          brand: 'Sainsbury\'s',
          price: 4.00,
          image: 'https://images.pexels.com/photos/2338407/pexels-photo-2338407.jpeg',
          nutrition: {
            per100g: {
              energy: 123,
              protein: 20.7,
              carbohydrate: 0,
              fat: 5.0,
              fibre: 0,
              salt: 0.1,
            }
          }
        }
      ];

      const filtered = mockSainsburysProducts.filter(product => 
        product.name.toLowerCase().includes(query.toLowerCase()) ||
        product.brand?.toLowerCase().includes(query.toLowerCase())
      );

      return filtered.map(product => ({
        source: 'sainsburys' as const,
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
        availability: 'Sainsbury\'s stores',
      }));
    } catch (error) {
      console.error('Error searching Sainsbury\'s API:', error);
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