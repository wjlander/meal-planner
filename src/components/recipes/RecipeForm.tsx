import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Plus, Trash2, Calculator } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Recipe {
  id?: string;
  name: string;
  description?: string;
  instructions?: string;
  prep_time?: number;
  cook_time?: number;
  servings?: number;
  meal_times?: string[];
  tags?: string[];
  image_url?: string;
  ingredients?: RecipeIngredient[];
}

interface RecipeIngredient {
  id?: string;
  food_item_id?: string;
  ingredient_name?: string;
  quantity: number;
  unit: string;
  food_item?: {
    id: string;
    name: string;
    brand?: string;
    calories_per_100g?: number;
    protein_per_100g?: number;
    carbs_per_100g?: number;
    fat_per_100g?: number;
  };
}

interface RecipeFormProps {
  isOpen: boolean;
  onClose: () => void;
  recipe?: Recipe | null;
  onSave: () => void;
}

const MEAL_TIMES = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snack', label: 'Snack' },
];

export function RecipeForm({ isOpen, onClose, recipe, onSave }: RecipeFormProps) {
  const [formData, setFormData] = useState<Recipe>({
    name: '',
    description: '',
    instructions: '',
    prep_time: 0,
    cook_time: 0,
    servings: 1,
    meal_times: [],
    tags: [],
    image_url: '',
  });
  const [newTag, setNewTag] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [foodItems, setFoodItems] = useState<any[]>([]);
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([]);
  const [newIngredient, setNewIngredient] = useState({
    food_item_id: '',
    ingredient_name: '',
    quantity: 0,
    unit: 'g'
  });
  const [calculatedNutrition, setCalculatedNutrition] = useState({
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0
  });
  const { toast } = useToast();

  useEffect(() => {
    if (recipe) {
      setFormData({
        ...recipe,
        meal_times: recipe.meal_times || [],
        tags: recipe.tags || [],
      });
      loadRecipeIngredients(recipe.id);
    } else {
      setFormData({
        name: '',
        description: '',
        instructions: '',
        prep_time: 0,
        cook_time: 0,
        servings: 1,
        meal_times: [],
        tags: [],
        image_url: '',
      });
      setIngredients([]);
    }
  }, [recipe]);

  useEffect(() => {
    loadFoodItems();
  }, []);

  useEffect(() => {
    calculateNutrition();
  }, [ingredients]);

  const loadFoodItems = async () => {
    const { data, error } = await supabase
      .from('food_items')
      .select('id, name, brand, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g')
      .order('name');

    if (error) {
      console.error('Error loading food items:', error);
      return;
    }

    setFoodItems(data || []);
  };

  const loadRecipeIngredients = async (recipeId?: string) => {
    if (!recipeId) return;

    const { data, error } = await supabase
      .from('recipe_ingredients')
      .select(`
        *,
        food_item:food_items(id, name, brand, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g)
      `)
      .eq('recipe_id', recipeId);

    if (error) {
      console.error('Error loading recipe ingredients:', error);
      return;
    }

    setIngredients(data || []);
  };

  const calculateNutrition = () => {
    const nutrition = ingredients.reduce((total, ingredient) => {
      if (!ingredient.food_item) return total;

      const multiplier = ingredient.quantity / 100; // Convert to per 100g basis
      
      return {
        calories: total.calories + (ingredient.food_item.calories_per_100g || 0) * multiplier,
        protein: total.protein + (ingredient.food_item.protein_per_100g || 0) * multiplier,
        carbs: total.carbs + (ingredient.food_item.carbs_per_100g || 0) * multiplier,
        fat: total.fat + (ingredient.food_item.fat_per_100g || 0) * multiplier,
      };
    }, { calories: 0, protein: 0, carbs: 0, fat: 0 });

    setCalculatedNutrition(nutrition);
  };

  const handleMealTimeToggle = (mealTime: string) => {
    setFormData(prev => ({
      ...prev,
      meal_times: prev.meal_times?.includes(mealTime)
        ? prev.meal_times.filter(t => t !== mealTime)
        : [...(prev.meal_times || []), mealTime]
    }));
  };

  const handleAddTag = () => {
    if (newTag.trim() && !formData.tags?.includes(newTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...(prev.tags || []), newTag.trim()]
      }));
      setNewTag('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags?.filter(tag => tag !== tagToRemove) || []
    }));
  };

  const addIngredient = () => {
    if (newIngredient.food_item_id || newIngredient.ingredient_name) {
      const selectedFoodItem = foodItems.find(item => item.id === newIngredient.food_item_id);
      
      const ingredient: RecipeIngredient = {
        food_item_id: newIngredient.food_item_id || null,
        ingredient_name: newIngredient.ingredient_name || selectedFoodItem?.name,
        quantity: newIngredient.quantity,
        unit: newIngredient.unit,
        food_item: selectedFoodItem
      };

      setIngredients(prev => [...prev, ingredient]);
      setNewIngredient({
        food_item_id: '',
        ingredient_name: '',
        quantity: 0,
        unit: 'g'
      });
    }
  };

  const removeIngredient = (index: number) => {
    setIngredients(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast({
        title: "Error",
        description: "Recipe name is required",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Error",
          description: "You must be logged in to save recipes",
          variant: "destructive",
        });
        return;
      }

      const recipeData = {
        ...formData,
        user_id: user.id,
        updated_at: new Date().toISOString(),
      };

      let error;
      let savedRecipeId = recipe?.id;
      
      if (recipe?.id) {
        ({ error } = await supabase
          .from('recipes')
          .update(recipeData)
          .eq('id', recipe.id));
      } else {
        const { data, error: insertError } = await supabase
          .from('recipes')
          .insert(recipeData)
          .select()
          .single();
        
        error = insertError;
        if (data) savedRecipeId = data.id;
      }

      if (error) throw error;

      // Save ingredients
      if (savedRecipeId && ingredients.length > 0) {
        // Delete existing ingredients if editing
        if (recipe?.id) {
          await supabase
            .from('recipe_ingredients')
            .delete()
            .eq('recipe_id', recipe.id);
        }

        // Insert new ingredients
        const ingredientsData = ingredients.map(ingredient => ({
          recipe_id: savedRecipeId,
          food_item_id: ingredient.food_item_id,
          ingredient_name: ingredient.ingredient_name,
          quantity: ingredient.quantity,
          unit: ingredient.unit
        }));

        const { error: ingredientsError } = await supabase
          .from('recipe_ingredients')
          .insert(ingredientsData);

        if (ingredientsError) {
          console.error('Error saving ingredients:', ingredientsError);
        }
      }

      toast({
        title: "Success",
        description: `Recipe ${recipe?.id ? 'updated' : 'created'} successfully!`,
      });

      onSave();
      onClose();
    } catch (error) {
      console.error('Error saving recipe:', error);
      toast({
        title: "Error",
        description: "Failed to save recipe",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {recipe?.id ? 'Edit Recipe' : 'Add New Recipe'}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label htmlFor="name">Recipe Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter recipe name"
                required
              />
            </div>

            <div className="col-span-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description of the recipe"
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="prep_time">Prep Time (minutes)</Label>
              <Input
                id="prep_time"
                type="number"
                value={formData.prep_time}
                onChange={(e) => setFormData(prev => ({ ...prev, prep_time: parseInt(e.target.value) || 0 }))}
                min="0"
              />
            </div>

            <div>
              <Label htmlFor="cook_time">Cook Time (minutes)</Label>
              <Input
                id="cook_time"
                type="number"
                value={formData.cook_time}
                onChange={(e) => setFormData(prev => ({ ...prev, cook_time: parseInt(e.target.value) || 0 }))}
                min="0"
              />
            </div>

            <div>
              <Label htmlFor="servings">Servings</Label>
              <Input
                id="servings"
                type="number"
                value={formData.servings}
                onChange={(e) => setFormData(prev => ({ ...prev, servings: parseInt(e.target.value) || 1 }))}
                min="1"
              />
            </div>

            <div>
              <Label htmlFor="image_url">Image URL</Label>
              <Input
                id="image_url"
                value={formData.image_url}
                onChange={(e) => setFormData(prev => ({ ...prev, image_url: e.target.value }))}
                placeholder="https://example.com/image.jpg"
              />
            </div>
          </div>

          <div>
            <Label>Ingredients</Label>
            <div className="space-y-4 mt-2">
              {/* Add new ingredient */}
              <div className="border rounded-lg p-4 bg-muted/30">
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div>
                    <Label htmlFor="food_item">From Food Database</Label>
                    <Select 
                      value={newIngredient.food_item_id} 
                      onValueChange={(value) => setNewIngredient(prev => ({ 
                        ...prev, 
                        food_item_id: value === 'manual-entry' ? '' : value,
                        ingredient_name: value === 'manual-entry' ? prev.ingredient_name : '' 
                      }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select food item" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manual-entry">None (manual entry)</SelectItem>
                        {foodItems.map(item => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.name} {item.brand && `(${item.brand})`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="ingredient_name">Or Manual Entry</Label>
                    <Input
                      id="ingredient_name"
                      placeholder="e.g., Salt, Pepper"
                      value={newIngredient.ingredient_name}
                      onChange={(e) => setNewIngredient(prev => ({ 
                        ...prev, 
                        ingredient_name: e.target.value,
                        food_item_id: e.target.value ? '' : prev.food_item_id === 'manual-entry' ? '' : prev.food_item_id 
                      }))}
                      disabled={newIngredient.food_item_id && newIngredient.food_item_id !== 'manual-entry'}
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label htmlFor="quantity">Quantity</Label>
                    <Input
                      id="quantity"
                      type="number"
                      step="0.1"
                      value={newIngredient.quantity}
                      onChange={(e) => setNewIngredient(prev => ({ 
                        ...prev, 
                        quantity: parseFloat(e.target.value) || 0 
                      }))}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="unit">Unit</Label>
                    <Select 
                      value={newIngredient.unit} 
                      onValueChange={(value) => setNewIngredient(prev => ({ ...prev, unit: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="g">grams (g)</SelectItem>
                        <SelectItem value="kg">kilograms (kg)</SelectItem>
                        <SelectItem value="ml">milliliters (ml)</SelectItem>
                        <SelectItem value="l">liters (l)</SelectItem>
                        <SelectItem value="cup">cups</SelectItem>
                        <SelectItem value="tbsp">tablespoons</SelectItem>
                        <SelectItem value="tsp">teaspoons</SelectItem>
                        <SelectItem value="piece">pieces</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex items-end">
                    <Button 
                      type="button" 
                      onClick={addIngredient}
                      disabled={(!newIngredient.food_item_id || newIngredient.food_item_id === 'manual-entry') && !newIngredient.ingredient_name}
                      className="w-full"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Ingredients list */}
              {ingredients.length > 0 && (
                <div className="space-y-2">
                  <Label>Recipe Ingredients</Label>
                  {ingredients.map((ingredient, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <div className="font-medium">
                          {ingredient.food_item?.name || ingredient.ingredient_name}
                          {ingredient.food_item?.brand && (
                            <span className="text-sm text-muted-foreground ml-1">
                              ({ingredient.food_item.brand})
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {ingredient.quantity} {ingredient.unit}
                          {ingredient.food_item && (
                            <span className="ml-2">
                              • {((ingredient.food_item.calories_per_100g || 0) * ingredient.quantity / 100).toFixed(0)} cal
                            </span>
                          )}
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeIngredient(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Calculated nutrition */}
              {ingredients.some(i => i.food_item) && (
                <div className="border rounded-lg p-4 bg-primary/5">
                  <div className="flex items-center gap-2 mb-3">
                    <Calculator className="h-4 w-4 text-primary" />
                    <Label>Calculated Nutrition (per serving)</Label>
                  </div>
                  <div className="grid grid-cols-4 gap-4 text-sm">
                    <div className="text-center">
                      <div className="font-semibold text-primary">
                        {(calculatedNutrition.calories / (formData.servings || 1)).toFixed(0)}
                      </div>
                      <div className="text-muted-foreground">Calories</div>
                    </div>
                    <div className="text-center">
                      <div className="font-semibold text-primary">
                        {(calculatedNutrition.protein / (formData.servings || 1)).toFixed(1)}g
                      </div>
                      <div className="text-muted-foreground">Protein</div>
                    </div>
                    <div className="text-center">
                      <div className="font-semibold text-primary">
                        {(calculatedNutrition.carbs / (formData.servings || 1)).toFixed(1)}g
                      </div>
                      <div className="text-muted-foreground">Carbs</div>
                    </div>
                    <div className="text-center">
                      <div className="font-semibold text-primary">
                        {(calculatedNutrition.fat / (formData.servings || 1)).toFixed(1)}g
                      </div>
                      <div className="text-muted-foreground">Fat</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div>
            <Label>Meal Times</Label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {MEAL_TIMES.map((mealTime) => (
                <div key={mealTime.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={mealTime.value}
                    checked={formData.meal_times?.includes(mealTime.value)}
                    onCheckedChange={() => handleMealTimeToggle(mealTime.value)}
                  />
                  <Label htmlFor={mealTime.value}>{mealTime.label}</Label>
                </div>
              ))}
            </div>
          </div>

          <div>
            <Label>Tags</Label>
            <div className="flex flex-wrap gap-2 mt-2 mb-2">
              {formData.tags?.map((tag) => (
                <Badge key={tag} variant="outline" className="flex items-center gap-1">
                  {tag}
                  <X 
                    className="h-3 w-3 cursor-pointer" 
                    onClick={() => handleRemoveTag(tag)}
                  />
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder="Add a tag"
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
              />
              <Button type="button" onClick={handleAddTag} size="sm">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div>
            <Label htmlFor="instructions">Instructions</Label>
            <Textarea
              id="instructions"
              value={formData.instructions}
              onChange={(e) => setFormData(prev => ({ ...prev, instructions: e.target.value }))}
              placeholder="Step-by-step cooking instructions"
              rows={6}
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Saving...' : recipe?.id ? 'Update Recipe' : 'Create Recipe'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}