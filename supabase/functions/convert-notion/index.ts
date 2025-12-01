import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { notionUrl } = await req.json();
    
    if (!notionUrl) {
      return new Response(
        JSON.stringify({ error: 'Notion URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check export limit
    const { data: canExport } = await supabase.rpc('check_export_limit', { 
      p_user_id: user.id 
    });

    if (!canExport) {
      return new Response(
        JSON.stringify({ error: 'Export limit reached. Please upgrade your plan.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract page ID from Notion URL
    const pageId = extractNotionPageId(notionUrl);
    if (!pageId) {
      return new Response(
        JSON.stringify({ error: 'Invalid Notion URL format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch Notion page content
    const notionSecret = Deno.env.get('NOTION_SECRET');
    const notionResponse = await fetch(`https://api.notion.com/v1/blocks/${pageId}/children`, {
      headers: {
        'Authorization': `Bearer ${notionSecret}`,
        'Notion-Version': '2022-06-28',
      },
    });

    if (!notionResponse.ok) {
      console.error('Notion API error:', await notionResponse.text());
      return new Response(
        JSON.stringify({ error: 'Failed to fetch Notion page. Make sure the page is public or shared with your integration.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const notionData = await notionResponse.json();
    
    // Get page title
    const pageResponse = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
      headers: {
        'Authorization': `Bearer ${notionSecret}`,
        'Notion-Version': '2022-06-28',
      },
    });

    const pageData = await pageResponse.json();
    const rawTitle = extractTitle(pageData);

    // Convert Notion blocks to basic HTML
    const rawHtml = convertNotionToHtml(notionData.results);

    // Use Lovable AI to enhance the content
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'You are an expert SEO content optimizer. Transform raw HTML into clean, engaging blog content with proper semantic HTML structure, SEO-optimized meta information, and improved readability.'
          },
          {
            role: 'user',
            content: `Original title: ${rawTitle}\n\nRaw HTML:\n${rawHtml}\n\nPlease:\n1. Create an SEO-optimized title (max 60 chars)\n2. Generate a compelling meta description (max 160 chars)\n3. Create a URL-friendly slug\n4. Fix heading hierarchy (ensure single H1, proper H2-H3 structure)\n5. Make the text more engaging while keeping the original meaning\n6. Ensure all images have proper alt text\n7. Return as JSON with: { "title": "...", "description": "...", "slug": "...", "html": "..." }`
          }
        ],
      }),
    });

    if (!aiResponse.ok) {
      console.error('AI API error:', await aiResponse.text());
      return new Response(
        JSON.stringify({ error: 'Failed to process content with AI' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    let enhancedContent;
    
    try {
      const aiText = aiData.choices[0].message.content;
      const jsonMatch = aiText.match(/\{[\s\S]*\}/);
      enhancedContent = jsonMatch ? JSON.parse(jsonMatch[0]) : {
        title: rawTitle,
        description: rawTitle,
        slug: rawTitle.toLowerCase().replace(/\s+/g, '-'),
        html: rawHtml
      };
    } catch (e) {
      console.error('Failed to parse AI response:', e);
      enhancedContent = {
        title: rawTitle,
        description: rawTitle,
        slug: rawTitle.toLowerCase().replace(/\s+/g, '-'),
        html: rawHtml
      };
    }

    // Store export in database
    const { data: exportData, error: dbError } = await supabase
      .from('exports')
      .insert({
        user_id: user.id,
        notion_url: notionUrl,
        title: enhancedContent.title,
        html_content: enhancedContent.html,
        status: 'completed',
        frontmatter: {
          title: enhancedContent.title,
          description: enhancedContent.description,
          slug: enhancedContent.slug,
          date: new Date().toISOString(),
        }
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      return new Response(
        JSON.stringify({ error: 'Failed to save export' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        id: exportData.id,
        title: enhancedContent.title,
        description: enhancedContent.description,
        slug: enhancedContent.slug,
        html: enhancedContent.html,
        createdAt: exportData.created_at,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Conversion error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'An unexpected error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function extractNotionPageId(url: string): string | null {
  const patterns = [
    /notion\.so\/([a-f0-9]{32})/,
    /notion\.so\/.*-([a-f0-9]{32})/,
    /^([a-f0-9]{32})$/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
}

function extractTitle(pageData: any): string {
  try {
    const titleProperty = pageData.properties?.title || pageData.properties?.Title || pageData.properties?.Name;
    if (titleProperty?.title?.[0]?.plain_text) {
      return titleProperty.title[0].plain_text;
    }
  } catch (e) {
    console.error('Error extracting title:', e);
  }
  return 'Untitled';
}

function convertNotionToHtml(blocks: any[]): string {
  let html = '';

  for (const block of blocks) {
    const type = block.type;
    const content = block[type];

    switch (type) {
      case 'paragraph':
        const pText = content.rich_text?.map((t: any) => t.plain_text).join('') || '';
        if (pText.trim()) html += `<p>${pText}</p>\n`;
        break;

      case 'heading_1':
        const h1Text = content.rich_text?.map((t: any) => t.plain_text).join('') || '';
        html += `<h1>${h1Text}</h1>\n`;
        break;

      case 'heading_2':
        const h2Text = content.rich_text?.map((t: any) => t.plain_text).join('') || '';
        html += `<h2>${h2Text}</h2>\n`;
        break;

      case 'heading_3':
        const h3Text = content.rich_text?.map((t: any) => t.plain_text).join('') || '';
        html += `<h3>${h3Text}</h3>\n`;
        break;

      case 'bulleted_list_item':
        const liText = content.rich_text?.map((t: any) => t.plain_text).join('') || '';
        html += `<li>${liText}</li>\n`;
        break;

      case 'numbered_list_item':
        const numText = content.rich_text?.map((t: any) => t.plain_text).join('') || '';
        html += `<li>${numText}</li>\n`;
        break;

      case 'image':
        const imageUrl = content.file?.url || content.external?.url || '';
        html += `<img src="${imageUrl}" alt="Image from Notion" />\n`;
        break;

      case 'code':
        const codeText = content.rich_text?.map((t: any) => t.plain_text).join('') || '';
        html += `<pre><code>${codeText}</code></pre>\n`;
        break;

      case 'quote':
        const quoteText = content.rich_text?.map((t: any) => t.plain_text).join('') || '';
        html += `<blockquote>${quoteText}</blockquote>\n`;
        break;
    }
  }

  return html;
}
