import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GOOGLE_VISION_API_KEY = Deno.env.get('GOOGLE_VISION_API_KEY');
    
    if (!GOOGLE_VISION_API_KEY) {
      // Fallback to OpenAI if Google Vision is not configured
      return await fallbackToOpenAI(req);
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

    console.log("Analyzing food photo with Google Vision:", imageUrl);

    // Convert image URL to base64 if it's a data URL, otherwise fetch it
    let base64Image: string;
    if (imageUrl.startsWith('data:image/')) {
      base64Image = imageUrl.split(',')[1];
    } else {
      const imageResponse = await fetch(imageUrl);
      const imageBuffer = await imageResponse.arrayBuffer();
      base64Image = btoa(String.fromCharCode(...new Uint8Array(imageBuffer)));
    }

    // Call Google Vision API for label detection and text detection
    const [labelResponse, textResponse] = await Promise.all([
      // Label Detection
      fetch(`https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_VISION_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [{
            image: {
              content: base64Image
            },
            features: [{
              type: 'LABEL_DETECTION',
              maxResults: 10
            }]
          }]
        }),
      }),
      
      // Text Detection (for product names/brands)
      fetch(`https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_VISION_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [{
            image: {
              content: base64Image
            },
            features: [{
              type: 'TEXT_DETECTION',
              maxResults: 5
            }]
          }]
        }),
      })
    ]);

    if (!labelResponse.ok || !textResponse.ok) {
      throw new Error(`Google Vision API error: ${labelResponse.status}`);
    }

    const [labelData, textData] = await Promise.all([
      labelResponse.json(),
      textResponse.json()
    ]);

    console.log("Google Vision label response:", labelData);
    console.log("Google Vision text response:", textData);

    // Process label detection results
    const labels = labelData.responses[0]?.labelAnnotations || [];
    const foodLabels = labels
      .filter((label: any) => label.score > 0.7) // High confidence only
      .map((label: any) => label.description.toLowerCase())
      .filter((label: string) => 
        // Filter for food-related labels
        ['food', 'ingredient', 'snack', 'beverage', 'fruit', 'vegetable', 'meat', 'dairy', 'grain', 'cereal', 'bread', 'pasta', 'sauce', 'spice'].some(foodWord => 
          label.includes(foodWord) || foodWord.includes(label)
        )
      );

    // Process text detection results
    const detectedText = textData.responses[0]?.textAnnotations || [];
    const brandNames = detectedText
      .slice(1) // Skip the first one which is usually the full text
      .map((text: any) => text.description)
      .filter((text: string) => 
        text.length > 2 && text.length < 30 && // Reasonable brand name length
        /^[A-Za-z\s&'-]+$/.test(text) // Only letters, spaces, and common brand characters
      );

    // Combine food labels and brand names for search terms
    const searchTerms = [
      ...foodLabels.slice(0, 3),
      ...brandNames.slice(0, 2),
      // Add some generic UK food terms if we don't have enough
      ...(foodLabels.length < 2 ? ['food', 'snack', 'meal'] : [])
    ].slice(0, 5); // Limit to 5 search terms

    const identifiedFoods = [
      ...foodLabels,
      ...brandNames.filter(name => name.length < 20) // Shorter names are more likely to be product names
    ].slice(0, 5);

    // Determine confidence based on number of food-related labels found
    let confidence: string;
    if (foodLabels.length >= 3) {
      confidence = 'high';
    } else if (foodLabels.length >= 1) {
      confidence = 'medium';
    } else {
      confidence = 'low';
    }

    const analysis = {
      identifiedFoods: identifiedFoods.length > 0 ? identifiedFoods : ['Food items detected'],
      confidence,
      searchTerms: searchTerms.length > 0 ? searchTerms : ['food', 'snack'],
      notes: `Google Vision detected ${labels.length} labels and ${detectedText.length} text elements. ${description ? `User context: ${description}` : ''}`
    };

    return new Response(JSON.stringify({ 
      success: true,
      analysis,
      provider: 'google-vision'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Error in Google Vision analysis:', error);
    
    // Fallback to OpenAI if Google Vision fails
    return await fallbackToOpenAI(req);
  }
});

async function fallbackToOpenAI(req: Request) {
  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    
    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ 
        success: false,
        error: "No AI services configured",
        analysis: {
          identifiedFoods: ["Food items"],
          confidence: "low",
          searchTerms: ["food", "snack", "meal"],
          notes: "AI analysis unavailable, using fallback search terms"
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const { imageUrl, description } = await req.json();

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
            content: `You are a food identification expert specializing in UK food products. Analyze the image and identify food items that can be found in UK food databases. Focus on packaged foods, branded products, and common UK grocery items. Return only valid JSON with this structure:
            {
              "identifiedFoods": ["specific food name 1", "specific food name 2"],
              "confidence": "high|medium|low",
              "searchTerms": ["search term 1", "search term 2", "search term 3"],
              "notes": "brief description of what you see"
            }
            
            Make search terms specific to UK food products and brands (e.g., "hovis bread", "walkers crisps", "cadbury chocolate", "tesco milk", etc.)`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Identify the UK food items in this image that could be found in a food database. Focus on packaged or branded products available in UK supermarkets. ${description ? `Additional context: ${description}` : ''}`
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

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ 
          success: false,
          error: "AI service temporarily unavailable due to quota limits",
          analysis: {
            identifiedFoods: ["Food items detected"],
            confidence: "low",
            searchTerms: ["bread", "milk", "cheese", "chicken", "pasta"],
            notes: "AI analysis unavailable, using common UK food search terms"
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }
      
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const analysisText = data.choices[0].message.content;

    try {
      const analysis = JSON.parse(analysisText);
      
      return new Response(JSON.stringify({ 
        success: true,
        analysis,
        provider: 'openai-fallback'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    } catch (parseError) {
      return new Response(JSON.stringify({ 
        success: true,
        analysis: {
          identifiedFoods: ["Food items detected"],
          confidence: "low",
          searchTerms: ["food", "snack", "meal"],
          notes: "AI analysis completed but response format was unexpected"
        },
        provider: 'openai-fallback'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

  } catch (error) {
    console.error('Error in OpenAI fallback:', error);
    
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message,
      analysis: {
        identifiedFoods: ["Food items"],
        confidence: "low", 
        searchTerms: ["food", "snack"],
        notes: "Analysis failed, using basic search terms"
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}