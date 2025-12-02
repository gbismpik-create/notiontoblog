import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const notionSecret = Deno.env.get('NOTION_SECRET');
const NOTION_VERSION = '2022-06-28';

// Fetch all blocks recursively, including children
async function fetchAllBlocks(blockId: string, depth = 0): Promise<any[]> {
  if (depth > 10) return []; // Prevent infinite recursion
  
  const blocks: any[] = [];
  let cursor: string | undefined;
  
  do {
    const url = new URL(`https://api.notion.com/v1/blocks/${blockId}/children`);
    if (cursor) url.searchParams.set('start_cursor', cursor);
    
    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${notionSecret}`,
        'Notion-Version': NOTION_VERSION,
      },
    });
    
    if (!response.ok) {
      console.error(`Failed to fetch blocks for ${blockId}:`, await response.text());
      break;
    }
    
    const data = await response.json();
    
    for (const block of data.results) {
      // Recursively fetch children for blocks that have them
      if (block.has_children) {
        block.children = await fetchAllBlocks(block.id, depth + 1);
      }
      blocks.push(block);
    }
    
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);
  
  return blocks;
}

// Fetch synced block content
async function fetchSyncedBlockContent(syncedBlockId: string): Promise<any[]> {
  try {
    const response = await fetch(`https://api.notion.com/v1/blocks/${syncedBlockId}/children`, {
      headers: {
        'Authorization': `Bearer ${notionSecret}`,
        'Notion-Version': NOTION_VERSION,
      },
    });
    
    if (!response.ok) return [];
    const data = await response.json();
    return data.results || [];
  } catch (e) {
    console.error('Error fetching synced block:', e);
    return [];
  }
}

// Convert rich text with formatting
function convertRichText(richTextArray: any[]): string {
  if (!richTextArray || !Array.isArray(richTextArray)) return '';
  
  return richTextArray.map((rt: any) => {
    let text = rt.plain_text || '';
    
    // Escape HTML entities
    text = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    
    // Apply formatting
    if (rt.annotations) {
      if (rt.annotations.code) {
        text = `<code>${text}</code>`;
      }
      if (rt.annotations.bold) {
        text = `<strong>${text}</strong>`;
      }
      if (rt.annotations.italic) {
        text = `<em>${text}</em>`;
      }
      if (rt.annotations.strikethrough) {
        text = `<del>${text}</del>`;
      }
      if (rt.annotations.underline) {
        text = `<u>${text}</u>`;
      }
      if (rt.annotations.color && rt.annotations.color !== 'default') {
        const color = rt.annotations.color.replace('_background', '');
        if (rt.annotations.color.includes('_background')) {
          text = `<mark style="background-color: var(--notion-${color}, #${getColorHex(color)})">${text}</mark>`;
        } else {
          text = `<span style="color: var(--notion-${color}, #${getColorHex(color)})">${text}</span>`;
        }
      }
    }
    
    // Handle links
    if (rt.href) {
      text = `<a href="${rt.href}" target="_blank" rel="noopener noreferrer">${text}</a>`;
    }
    
    return text;
  }).join('');
}

function getColorHex(color: string): string {
  const colors: Record<string, string> = {
    gray: '9b9b9b',
    brown: '8b4513',
    orange: 'ff8c00',
    yellow: 'ffd700',
    green: '228b22',
    blue: '1e90ff',
    purple: '9370db',
    pink: 'ff69b4',
    red: 'dc143c',
  };
  return colors[color] || '000000';
}

// Get callout emoji or icon
function getCalloutIcon(block: any): string {
  const callout = block.callout;
  if (callout?.icon?.type === 'emoji') {
    return callout.icon.emoji;
  }
  if (callout?.icon?.type === 'external') {
    return `<img src="${callout.icon.external.url}" alt="icon" style="width:1.2em;height:1.2em;vertical-align:middle;" />`;
  }
  return '💡';
}

// Convert a single block to HTML
function convertBlockToHtml(block: any, listContext: { type: string | null; items: string[] }): string {
  const type = block.type;
  const content = block[type];
  let html = '';
  
  switch (type) {
    case 'paragraph': {
      const text = convertRichText(content?.rich_text);
      if (text.trim() || block.children?.length) {
        html += `<p>${text}</p>\n`;
        if (block.children?.length) {
          html += `<div class="indent">${convertBlocksToHtml(block.children)}</div>\n`;
        }
      }
      break;
    }
    
    case 'heading_1': {
      const text = convertRichText(content?.rich_text);
      const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      html += `<h1 id="${id}">${text}</h1>\n`;
      if (block.children?.length) {
        html += convertBlocksToHtml(block.children);
      }
      break;
    }
    
    case 'heading_2': {
      const text = convertRichText(content?.rich_text);
      const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      html += `<h2 id="${id}">${text}</h2>\n`;
      if (block.children?.length) {
        html += convertBlocksToHtml(block.children);
      }
      break;
    }
    
    case 'heading_3': {
      const text = convertRichText(content?.rich_text);
      const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      html += `<h3 id="${id}">${text}</h3>\n`;
      if (block.children?.length) {
        html += convertBlocksToHtml(block.children);
      }
      break;
    }
    
    case 'bulleted_list_item': {
      const text = convertRichText(content?.rich_text);
      let itemHtml = text;
      if (block.children?.length) {
        itemHtml += convertBlocksToHtml(block.children);
      }
      listContext.items.push(`<li>${itemHtml}</li>`);
      if (listContext.type !== 'ul') {
        listContext.type = 'ul';
      }
      break;
    }
    
    case 'numbered_list_item': {
      const text = convertRichText(content?.rich_text);
      let itemHtml = text;
      if (block.children?.length) {
        itemHtml += convertBlocksToHtml(block.children);
      }
      listContext.items.push(`<li>${itemHtml}</li>`);
      if (listContext.type !== 'ol') {
        listContext.type = 'ol';
      }
      break;
    }
    
    case 'to_do': {
      const text = convertRichText(content?.rich_text);
      const checked = content?.checked ? 'checked' : '';
      html += `<div class="todo-item"><input type="checkbox" ${checked} disabled /><span>${text}</span></div>\n`;
      if (block.children?.length) {
        html += `<div class="indent">${convertBlocksToHtml(block.children)}</div>\n`;
      }
      break;
    }
    
    case 'toggle': {
      const text = convertRichText(content?.rich_text);
      html += `<details class="toggle">\n<summary>${text}</summary>\n`;
      if (block.children?.length) {
        html += `<div class="toggle-content">${convertBlocksToHtml(block.children)}</div>\n`;
      }
      html += `</details>\n`;
      break;
    }
    
    case 'callout': {
      const text = convertRichText(content?.rich_text);
      const icon = getCalloutIcon(block);
      const color = content?.color || 'default';
      html += `<aside class="callout callout-${color}">\n`;
      html += `<span class="callout-icon">${icon}</span>\n`;
      html += `<div class="callout-content">\n${text}\n`;
      if (block.children?.length) {
        html += convertBlocksToHtml(block.children);
      }
      html += `</div>\n</aside>\n`;
      break;
    }
    
    case 'quote': {
      const text = convertRichText(content?.rich_text);
      html += `<blockquote>${text}`;
      if (block.children?.length) {
        html += convertBlocksToHtml(block.children);
      }
      html += `</blockquote>\n`;
      break;
    }
    
    case 'code': {
      const text = convertRichText(content?.rich_text);
      const language = content?.language || 'plaintext';
      const caption = content?.caption?.length ? convertRichText(content.caption) : '';
      html += `<pre><code class="language-${language}">${text}</code></pre>\n`;
      if (caption) {
        html += `<figcaption class="code-caption">${caption}</figcaption>\n`;
      }
      break;
    }
    
    case 'image': {
      const imageUrl = content?.file?.url || content?.external?.url || '';
      const caption = content?.caption?.length ? convertRichText(content.caption) : '';
      const altText = caption || 'Image from Notion';
      html += `<figure class="image-container">\n`;
      html += `<img src="${imageUrl}" alt="${altText.replace(/"/g, '&quot;')}" loading="lazy" />\n`;
      if (caption) {
        html += `<figcaption>${caption}</figcaption>\n`;
      }
      html += `</figure>\n`;
      break;
    }
    
    case 'video': {
      const videoUrl = content?.file?.url || content?.external?.url || '';
      const caption = content?.caption?.length ? convertRichText(content.caption) : '';
      if (videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be')) {
        const videoId = videoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/)?.[1];
        if (videoId) {
          html += `<figure class="video-container">\n`;
          html += `<iframe src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen></iframe>\n`;
          if (caption) html += `<figcaption>${caption}</figcaption>\n`;
          html += `</figure>\n`;
        }
      } else {
        html += `<figure class="video-container">\n`;
        html += `<video controls src="${videoUrl}"></video>\n`;
        if (caption) html += `<figcaption>${caption}</figcaption>\n`;
        html += `</figure>\n`;
      }
      break;
    }
    
    case 'embed':
    case 'bookmark': {
      const url = content?.url || '';
      const caption = content?.caption?.length ? convertRichText(content.caption) : url;
      html += `<div class="embed-container">\n`;
      html += `<a href="${url}" target="_blank" rel="noopener noreferrer" class="bookmark">${caption}</a>\n`;
      html += `</div>\n`;
      break;
    }
    
    case 'divider': {
      html += `<hr />\n`;
      break;
    }
    
    case 'table': {
      html += `<div class="table-container">\n<table>\n`;
      if (block.children?.length) {
        const hasHeader = content?.has_column_header;
        block.children.forEach((row: any, index: number) => {
          if (row.type === 'table_row') {
            const cells = row.table_row.cells || [];
            const isHeader = hasHeader && index === 0;
            const tag = isHeader ? 'th' : 'td';
            const wrapper = isHeader ? 'thead' : (index === 1 && hasHeader ? 'tbody' : '');
            
            if (wrapper === 'thead') html += `<thead>\n`;
            if (wrapper === 'tbody') html += `<tbody>\n`;
            
            html += `<tr>\n`;
            cells.forEach((cell: any[]) => {
              const cellContent = convertRichText(cell);
              html += `<${tag}>${cellContent}</${tag}>\n`;
            });
            html += `</tr>\n`;
            
            if (isHeader) html += `</thead>\n`;
          }
        });
        if (content?.has_column_header && block.children.length > 1) {
          html += `</tbody>\n`;
        }
      }
      html += `</table>\n</div>\n`;
      break;
    }
    
    case 'table_row': {
      // Handled by parent table
      break;
    }
    
    case 'column_list': {
      const columnCount = block.children?.length || 1;
      html += `<div class="columns columns-${columnCount}">\n`;
      if (block.children?.length) {
        block.children.forEach((column: any) => {
          html += `<div class="column">\n`;
          if (column.children?.length) {
            html += convertBlocksToHtml(column.children);
          }
          html += `</div>\n`;
        });
      }
      html += `</div>\n`;
      break;
    }
    
    case 'column': {
      // Handled by parent column_list
      break;
    }
    
    case 'synced_block': {
      // For synced blocks, we already fetched children recursively
      if (block.children?.length) {
        html += convertBlocksToHtml(block.children);
      } else if (content?.synced_from?.block_id) {
        // Reference to another synced block - content should be in children
        html += `<!-- synced block reference: ${content.synced_from.block_id} -->\n`;
      }
      break;
    }
    
    case 'child_page': {
      const title = content?.title || 'Untitled';
      html += `<div class="child-page"><a href="#">📄 ${title}</a></div>\n`;
      break;
    }
    
    case 'child_database': {
      const title = content?.title || 'Database';
      html += `<div class="child-database"><span>📊 ${title}</span></div>\n`;
      break;
    }
    
    case 'equation': {
      const expression = content?.expression || '';
      html += `<div class="equation">${expression}</div>\n`;
      break;
    }
    
    case 'file':
    case 'pdf': {
      const fileUrl = content?.file?.url || content?.external?.url || '';
      const name = content?.name || fileUrl.split('/').pop() || 'File';
      const caption = content?.caption?.length ? convertRichText(content.caption) : '';
      html += `<div class="file-attachment">\n`;
      html += `<a href="${fileUrl}" target="_blank" rel="noopener noreferrer">📎 ${name}</a>\n`;
      if (caption) html += `<p class="file-caption">${caption}</p>\n`;
      html += `</div>\n`;
      break;
    }
    
    case 'audio': {
      const audioUrl = content?.file?.url || content?.external?.url || '';
      const caption = content?.caption?.length ? convertRichText(content.caption) : '';
      html += `<figure class="audio-container">\n`;
      html += `<audio controls src="${audioUrl}"></audio>\n`;
      if (caption) html += `<figcaption>${caption}</figcaption>\n`;
      html += `</figure>\n`;
      break;
    }
    
    case 'link_preview': {
      const url = content?.url || '';
      html += `<div class="link-preview"><a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a></div>\n`;
      break;
    }
    
    case 'table_of_contents': {
      html += `<nav class="table-of-contents"><p><em>[Table of Contents]</em></p></nav>\n`;
      break;
    }
    
    case 'breadcrumb': {
      html += `<nav class="breadcrumb"><p><em>[Breadcrumb]</em></p></nav>\n`;
      break;
    }
    
    default: {
      console.log(`Unhandled block type: ${type}`);
      if (block.children?.length) {
        html += convertBlocksToHtml(block.children);
      }
    }
  }
  
  return html;
}

// Convert array of blocks to HTML with proper list wrapping
function convertBlocksToHtml(blocks: any[]): string {
  let html = '';
  let listContext: { type: string | null; items: string[] } = { type: null, items: [] };
  
  const flushList = () => {
    if (listContext.items.length > 0) {
      const tag = listContext.type || 'ul';
      html += `<${tag}>\n${listContext.items.join('\n')}\n</${tag}>\n`;
      listContext = { type: null, items: [] };
    }
  };
  
  for (const block of blocks) {
    const type = block.type;
    const isListItem = type === 'bulleted_list_item' || type === 'numbered_list_item';
    
    if (!isListItem && listContext.items.length > 0) {
      flushList();
    }
    
    const blockHtml = convertBlockToHtml(block, listContext);
    
    if (!isListItem) {
      html += blockHtml;
    }
  }
  
  // Flush any remaining list items
  flushList();
  
  return html;
}

// Generate CSS for the exported HTML
function generateStyles(): string {
  return `
<style>
  .indent { margin-left: 1.5em; }
  .toggle { margin: 1em 0; border: 1px solid #e0e0e0; border-radius: 4px; }
  .toggle summary { padding: 0.75em 1em; cursor: pointer; font-weight: 500; }
  .toggle summary:hover { background: #f5f5f5; }
  .toggle-content { padding: 0.5em 1em 1em; border-top: 1px solid #e0e0e0; }
  .callout { display: flex; gap: 0.75em; padding: 1em; margin: 1em 0; border-radius: 4px; background: #f7f6f3; }
  .callout-icon { font-size: 1.2em; }
  .callout-content { flex: 1; }
  .callout-gray_background { background: #f1f1ef; }
  .callout-brown_background { background: #f4eeee; }
  .callout-orange_background { background: #fbecdd; }
  .callout-yellow_background { background: #fbf3db; }
  .callout-green_background { background: #edf3ec; }
  .callout-blue_background { background: #e7f3f8; }
  .callout-purple_background { background: #f4f0f7; }
  .callout-pink_background { background: #f9f0f3; }
  .callout-red_background { background: #fdebec; }
  .image-container { margin: 1.5em 0; text-align: center; }
  .image-container img { max-width: 100%; height: auto; border-radius: 4px; }
  .image-container figcaption { margin-top: 0.5em; font-size: 0.9em; color: #666; }
  .video-container { margin: 1.5em 0; }
  .video-container iframe, .video-container video { width: 100%; aspect-ratio: 16/9; border-radius: 4px; }
  .table-container { overflow-x: auto; margin: 1.5em 0; }
  .table-container table { width: 100%; border-collapse: collapse; }
  .table-container th, .table-container td { padding: 0.5em 1em; border: 1px solid #e0e0e0; text-align: left; }
  .table-container th { background: #f5f5f5; font-weight: 600; }
  .columns { display: flex; gap: 1.5em; margin: 1em 0; }
  .column { flex: 1; min-width: 0; }
  .todo-item { display: flex; align-items: flex-start; gap: 0.5em; margin: 0.5em 0; }
  .todo-item input { margin-top: 0.25em; }
  blockquote { margin: 1em 0; padding-left: 1em; border-left: 3px solid #e0e0e0; color: #555; }
  pre { background: #f5f5f5; padding: 1em; border-radius: 4px; overflow-x: auto; }
  code { font-family: 'SF Mono', Monaco, 'Andale Mono', monospace; font-size: 0.9em; }
  p code { background: #f0f0f0; padding: 0.2em 0.4em; border-radius: 3px; }
  .code-caption { margin-top: 0.5em; font-size: 0.85em; color: #666; }
  .embed-container, .bookmark { margin: 1em 0; }
  .bookmark { display: block; padding: 1em; border: 1px solid #e0e0e0; border-radius: 4px; text-decoration: none; color: inherit; }
  .bookmark:hover { background: #f5f5f5; }
  .child-page, .child-database { padding: 0.5em; margin: 0.5em 0; background: #f7f6f3; border-radius: 4px; }
  .file-attachment { margin: 1em 0; }
  .equation { font-family: 'Times New Roman', serif; font-size: 1.1em; margin: 1em 0; }
  hr { border: none; border-top: 1px solid #e0e0e0; margin: 2em 0; }
  @media (max-width: 768px) { .columns { flex-direction: column; } }
</style>`;
}

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

    console.log(`Fetching Notion page: ${pageId}`);

    // Fetch all blocks recursively
    const blocks = await fetchAllBlocks(pageId);
    console.log(`Fetched ${blocks.length} top-level blocks`);
    
    // Get page title and properties
    const pageResponse = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
      headers: {
        'Authorization': `Bearer ${notionSecret}`,
        'Notion-Version': NOTION_VERSION,
      },
    });

    if (!pageResponse.ok) {
      console.error('Failed to fetch page:', await pageResponse.text());
      return new Response(
        JSON.stringify({ error: 'Failed to fetch Notion page. Make sure the page is shared with your integration.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const pageData = await pageResponse.json();
    const rawTitle = extractTitle(pageData);
    const pageIcon = extractIcon(pageData);

    // Convert blocks to HTML
    const bodyHtml = convertBlocksToHtml(blocks);
    const styles = generateStyles();
    
    // Build complete HTML with title
    let rawHtml = styles + '\n';
    if (pageIcon) {
      rawHtml += `<div class="page-icon" style="font-size:3em;margin-bottom:0.5em;">${pageIcon}</div>\n`;
    }
    rawHtml += `<h1>${rawTitle}</h1>\n`;
    rawHtml += bodyHtml;

    console.log(`Generated HTML: ${rawHtml.length} characters`);

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
            content: `You are an expert SEO content optimizer. Your task is to:
1. Preserve ALL HTML structure, formatting, and content exactly as provided
2. Generate SEO metadata only
3. Do NOT modify the HTML content itself - keep it exactly as is
4. Return valid JSON only`
          },
          {
            role: 'user',
            content: `Original title: ${rawTitle}

HTML Content (DO NOT MODIFY, keep exactly as is):
${rawHtml}

Generate ONLY the following as JSON:
{
  "title": "SEO-optimized title max 60 chars",
  "description": "Compelling meta description max 160 chars",
  "slug": "url-friendly-slug",
  "html": "[THE EXACT HTML ABOVE - DO NOT CHANGE IT]"
}

IMPORTANT: The "html" field must contain the EXACT same HTML as provided above. Do not modify, clean, or alter it in any way.`
          }
        ],
      }),
    });

    let enhancedContent;
    
    if (!aiResponse.ok) {
      console.error('AI API error:', await aiResponse.text());
      // Fall back to raw content
      enhancedContent = {
        title: rawTitle,
        description: rawTitle.slice(0, 160),
        slug: rawTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
        html: rawHtml
      };
    } else {
      const aiData = await aiResponse.json();
      try {
        const aiText = aiData.choices[0].message.content;
        const jsonMatch = aiText.match(/\{[\s\S]*\}/);
        const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
        
        enhancedContent = {
          title: parsed?.title || rawTitle,
          description: parsed?.description || rawTitle.slice(0, 160),
          slug: parsed?.slug || rawTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
          html: rawHtml // Always use our converted HTML, not AI's version
        };
      } catch (e) {
        console.error('Failed to parse AI response:', e);
        enhancedContent = {
          title: rawTitle,
          description: rawTitle.slice(0, 160),
          slug: rawTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
          html: rawHtml
        };
      }
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

    console.log(`Export saved: ${exportData.id}`);

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
  // Handle various Notion URL formats
  const patterns = [
    /([a-f0-9]{32})(?:\?|$)/i,
    /([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i,
    /notion\.so\/(?:[^\/]+\/)?(?:[^-]+-)?([a-f0-9]{32})/i,
    /notion\.site\/(?:[^\/]+\/)?(?:[^-]+-)?([a-f0-9]{32})/i,
    /^([a-f0-9]{32})$/i,
  ];

  // Remove dashes from URL for matching
  const cleanUrl = url.replace(/-/g, '');

  for (const pattern of patterns) {
    const match = url.match(pattern) || cleanUrl.match(pattern);
    if (match) {
      // Return ID without dashes
      return match[1].replace(/-/g, '');
    }
  }

  return null;
}

function extractTitle(pageData: any): string {
  try {
    // Try different property names
    const props = pageData.properties || {};
    for (const key of Object.keys(props)) {
      const prop = props[key];
      if (prop?.type === 'title' && prop?.title?.[0]?.plain_text) {
        return prop.title.map((t: any) => t.plain_text).join('');
      }
    }
    
    // Try page title from parent
    if (pageData.parent?.type === 'page_id') {
      return 'Untitled';
    }
  } catch (e) {
    console.error('Error extracting title:', e);
  }
  return 'Untitled';
}

function extractIcon(pageData: any): string {
  try {
    if (pageData.icon?.type === 'emoji') {
      return pageData.icon.emoji;
    }
  } catch (e) {
    console.error('Error extracting icon:', e);
  }
  return '';
}
