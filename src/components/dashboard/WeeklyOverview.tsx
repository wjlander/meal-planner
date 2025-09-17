import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, Users, Star } from "lucide-react";
import { Rating } from "@/components/ui/rating";
import { MealRatingDialog } from "@/components/meals/MealRatingDialog";
import { useState } from "react";

const weekPlan: any[] = [];

const getMealTypeColor = (type: string) => {
  switch (type) {
    case 'breakfast': return 'bg-gradient-secondary text-secondary-foreground';
    case 'lunch': return 'bg-gradient-primary text-primary-foreground';
    case 'dinner': return 'bg-gradient-accent text-accent-foreground';
    case 'snack': return 'bg-muted text-muted-foreground';
    default: return 'bg-muted text-muted-foreground';
  }
};

export function WeeklyOverview() {
  const [meals, setMeals] = useState(weekPlan);

  return (
    <Card>
      <CardHeader>
        <CardTitle>This Week's Meal Plan</CardTitle>
        <CardDescription>No meals planned yet - start by creating your first meal plan</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-center py-8">
          <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No meal plans yet</h3>
          <p className="text-muted-foreground mb-4">
            Create your first meal plan to see your weekly overview here
          </p>
          <Button onClick={() => window.location.href = '/planning'} className="bg-gradient-primary">
            <Plus className="h-4 w-4 mr-2" />
            Create Meal Plan
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}