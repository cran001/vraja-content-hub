import { query } from './db';
import { ApiError, indiaDate, pageNumber, uuid } from './api';
import { isSupportedLocale } from './dailyVerses';

export async function storyFeed(params: URLSearchParams, id?: string) {
  if (id) uuid(id);
  const locale=params.get('locale')??'en';
  if (!isSupportedLocale(locale)) throw new ApiError(400,'Invalid locale.');
  const page=pageNumber(params.get('page'),1);
  const limit=pageNumber(params.get('limit'),20,100);
  const revision=(await query("SELECT COALESCE(max(id),0)::text AS revision FROM content_audit WHERE entity_type IN ('books','book_pages')")).rows[0].revision;
  const snapshot=`${indiaDate()}:${revision}:${locale}:${limit}`;
  if ((page>1 && !params.get('snapshot')) || (params.has('snapshot') && params.get('snapshot')!==snapshot)) throw new ApiError(409,'Feed changed or snapshot is missing. Restart pagination and retain cached content.');
  const rows=(await query(`SELECT * FROM books WHERE is_story AND is_active AND publication_state='published'
    AND published_on<=$1::date AND ($2::uuid IS NULL OR id=$2) ORDER BY sort_order,published_on DESC,id LIMIT $3 OFFSET $4`,
  [indiaDate(),id??null,id?1:limit+1,id?0:(page-1)*limit])).rows;
  if (id && !rows.length) throw new ApiError(404,'Story unavailable. Retain bookmark and reading state.');
  const items=[];
  for (const row of rows.slice(0,limit)) {
    const hi=locale.split('-')[0]==='hi' && row.title_hi && row.summary_hi && row.story_body_hi;
    const body=hi?row.story_body_hi:row.story_body;
    const item={id:row.id,bookId:row.id,title:hi?row.title_hi:row.title,summary:hi?row.summary_hi:row.summary,
      body:id?body:undefined,locale:hi?'hi':'en',requestedLocale:locale,languageFallback:(hi?'hi':'en')!==locale,
      coverUrl:row.cover_url,themes:row.themes,deities:row.deities,scriptureReferences:row.scripture_references,
      readingMinutes:Math.max(1,Math.ceil(String(body??'').split(/\s+/).length/180)),readingDurationEstimated:true,
      version:row.revision,publishedOn:row.published_on,sortOrder:row.sort_order,updatedAt:row.updated_at,
      source:row.source_name,sourceUrl:row.source_url,provenance:row.provenance,rightsStatus:row.rights_status,
      pages:id?(await query('SELECT id,page_number,title,title_hi,body_text,body_text_hi,image_url,thumbnail_url FROM book_pages WHERE book_id=$1 AND is_active ORDER BY page_number,id',[id])).rows.map(page=>{
        const translated=locale.split('-')[0]==='hi'&&Boolean(page.title_hi&&page.body_text_hi);
        return {id:page.id,page_number:page.page_number,title:translated?page.title_hi:page.title,
          body_text:translated?page.body_text_hi:page.body_text,image_url:page.image_url,thumbnail_url:page.thumbnail_url,
          locale:translated?'hi':'en',languageFallback:(translated?'hi':'en')!==locale};
      }):undefined};
    items.push(item);
  }
  return id?items[0]:{items,page,limit,hasMore:rows.length>limit,snapshot,reconciliation:'complete-only-after-all-pages'};
}
