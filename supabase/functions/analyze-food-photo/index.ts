import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not set');
    }

    const { imageUrl, description } = await req.json();

    if (!imageUrl) {
      return new Response(
        JSON.stringify({ 
          error: "Missing required field: imageUrl is required" 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    console.log("Analyzing food photo:", imageUrl);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a food identification expert. Analyze the image and identify food items that can be found in the Open Food Facts database. Focus on packaged foods, branded products, and items with barcodes. Return only valid JSON with this structure:
            {
              "identifiedFoods": ["specific food name 1", "specific food name 2"],
              "confidence": "high|medium|low",
              "searchTerms": ["search term 1", "search term 2", "search term 3"],
              "notes": "brief description of what you see"
            }
            
            Make search terms specific and likely to find results in Open Food Facts (e.g., "oats", "cereal", "pasta", "bread", "milk", etc.)`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Identify the food items in this image that could be found in a food database. Focus on packaged or branded products. ${description ? `Additional context: ${description}` : ''}`
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageUrl
                }
              }
            ]
          }
        ],
        max_tokens: 300,
        temperature: 0.3
      }),
    });

    const data = await response.json();
    console.log("OpenAI response:", data);

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} - ${data.error?.message || 'Unknown error'}`);
    }

    const analysisText = data.choices[0].message.content;
    console.log("Analysis text:", analysisText);

    try {
      // Parse the JSON response from OpenAI
      const analysis = JSON.parse(analysisText);
      
      return new Response(JSON.stringify({ 
        success: true,
        analysis 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    } catch (parseError) {
      console.error("Error parsing OpenAI response:", parseError);
      
      // Fallback: extract food terms from the response text
      const fallbackTerms = ["oats", "cereal", "bread", "milk", "pasta"];
      
      return new Response(JSON.stringify({ 
        success: true,
        analysis: {
          identifiedFoods: ["Unknown food items"],
          confidence: "low",
          searchTerms: fallbackTerms,
          notes: "AI analysis completed but response format was unexpected"
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

  } catch (error) {
    console.error('Error in analyze-food-photo function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});