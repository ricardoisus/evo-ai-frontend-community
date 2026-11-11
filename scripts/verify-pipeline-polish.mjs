process.on('uncaughtException', () => { console.error('Falha no navegador local; detalhes HTTP omitidos. Etapa:', globalThis.captureStep); process.exit(1); });
process.on('unhandledRejection', () => { console.error('Falha de captura; detalhes HTTP omitidos. Etapa:', globalThis.captureStep); process.exit(1); });
import { chromium } from '@playwright/test';
import fs from 'node:fs';
// Runs against the isolated synthetic local stack. No production hosts are allowed.
const baseURL=process.env.EVO_LOCAL_BASE_URL || 'http://127.0.0.1:5174';
const pipelineId=process.env.EVO_LOCAL_PIPELINE_ID;
if(!['127.0.0.1','localhost'].includes(new URL(baseURL).hostname)||!pipelineId||!process.env.EVO_LOCAL_LOGIN_FILE) throw new Error('Use a local URL, EVO_LOCAL_PIPELINE_ID and EVO_LOCAL_LOGIN_FILE');
const login=JSON.parse(fs.readFileSync(process.env.EVO_LOCAL_LOGIN_FILE,'utf8'));
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900}});
page.on('response',r=>{if(r.status()>=400) console.log('HTTP_ERROR',r.status(),new URL(r.url()).pathname);});

page.on('pageerror',()=>console.log('PAGE_ERROR: navegador local; detalhes omitidos'));
await page.route('**/*', async route=>{const url=new URL(route.request().url()); if(!['127.0.0.1','localhost'].includes(url.hostname)&&url.protocol!=='data:') return route.abort(); if(['3010','3011'].includes(url.port)) { try { const response=await route.fetch(); return await route.fulfill({response}); } catch { return route.abort().catch(() => {}); } } return route.continue(); });
await page.addInitScript(() => localStorage.setItem('i18nextLng','pt-BR'));
await page.goto(`${baseURL}/login`);
await page.locator('input[type=email]').fill(login.email);
await page.locator('input[type=password]').fill(login.password);
await page.locator('button[type=submit]').click();
await page.waitForTimeout(1800);

await page.goto(`${baseURL}/pipelines/${pipelineId}`);
await page.locator('.deal-card-shell').first().waitFor();
// Make reruns independent of the previous synthetic session's saved configuration.
await page.getByRole('button',{name:'Personalizar cartões',exact:true}).click();
await page.getByRole('button',{name:'Restaurar padrão',exact:true}).click();
if(await page.getByRole('button',{name:'Salvar',exact:true}).isEnabled()) {
  await page.getByRole('button',{name:'Salvar',exact:true}).click();
  await page.getByRole('dialog').waitFor({state:'hidden'});
} else await page.getByRole('button',{name:'Cancelar',exact:true}).click();
const out=process.env.EVO_SCREENSHOT_DIR || 'tmp/pipeline-card-configuration'; fs.mkdirSync(out,{recursive:true});


const metrics=[];
const contrast=(a,b)=>{const lum=c=>c.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);const [low,high]=[lum(a),lum(b)].sort((x,y)=>x-y);return (high+.05)/(low+.05);};
const setPortuguese=async()=>{await page.evaluate(async()=>{const {default:i18n}=await import('/src/i18n/config.ts');await i18n.changeLanguage('pt-BR');});await page.waitForTimeout(300);};
await setPortuguese();
globalThis.captureStep='loop';
for(const width of [1440,390]) for(const theme of ['light','dark']) {
 await page.setViewportSize({width,height:width===390?844:900});
 await page.evaluate(theme=>document.documentElement.classList.toggle('dark',theme==='dark'),theme);
 await page.waitForTimeout(200);
 globalThis.captureStep=`metrics-${width}-${theme}`;
 const m=await page.evaluate(()=>{
  const root=document.querySelector('.pipeline-board-root'), title=document.querySelector('.deal-title'), header=document.querySelector('.kanban-header-summary').parentElement.parentElement;
  const kpis=document.querySelector('.kanban-kpis');
  const cta=document.querySelector('.kanban-add-button');
  return {headerHeight:header.getBoundingClientRect().height,firstCardTop:title.closest('.deal-card-shell').getBoundingClientRect().top,columns:[...document.querySelectorAll('.kanban-column')].map(e=>e.getBoundingClientRect().width),kpiColor:getComputedStyle(kpis).color,ctaColor:getComputedStyle(cta).color,ctaBackground:getComputedStyle(cta).backgroundColor,rootWidth:root.getBoundingClientRect().width,searchWidth:document.querySelector('.kanban-search').getBoundingClientRect().width};
 });
 if(m.columns.some(w=>Math.abs(w-304)>1)) throw new Error('columns');
 if(width===1440&&m.headerHeight>120) throw new Error('desktop header');
 if(width===390&&m.firstCardTop>180) throw new Error('mobile header');
 if(contrast(m.ctaColor,m.ctaBackground)<4.5) throw new Error('CTA contrast');
 metrics.push({width,theme,...m,ctaContrast:contrast(m.ctaColor,m.ctaBackground)});
 await page.screenshot({path:`${out}/u4-depois-toolbar-${width}-${theme}.png`});
 globalThis.captureStep=`filter-${width}-${theme}`;
 await page.getByRole('button',{name:'Filtros',exact:true}).click();
 await page.getByPlaceholder('Canal, origem ou UTM').fill('SEM_ORIGEM_U4');
 await page.getByRole('button',{name:'Aplicar',exact:true}).click();
 await page.locator('.kanban-stage-empty').first().waitFor();
 if(await page.locator('.deal-card-shell').count()) throw new Error('origin filter');
 const emptyColors=await page.locator('.kanban-stage-empty').first().evaluate(e=>({text:getComputedStyle(e).color,link:getComputedStyle(e.querySelector('button')).color,bg:getComputedStyle(e.closest('.kanban-column-surface')).backgroundColor}));
 const ratios={text:contrast(emptyColors.text,emptyColors.bg),link:contrast(emptyColors.link,emptyColors.bg)};
 if(Object.values(ratios).some(r=>r<4.5))throw new Error('empty contrast');
 metrics[metrics.length-1].emptyContrast=ratios;
 await page.screenshot({path:`${out}/u4-depois-vazio-${width}-${theme}.png`});
 if(await page.getByRole('button',{name:'Limpar filtros',exact:true}).count()!==1) throw new Error('duplicate clear');
 await page.getByRole('button',{name:'Limpar filtros',exact:true}).click();
 await page.locator('.deal-card-shell').first().waitFor();
 // Keyboard focus on search, customise and create actions.
 globalThis.captureStep=`keyboard-${width}-${theme}`;
 const search=page.locator('.kanban-search input');
 if(width===390) await page.getByRole('button',{name:'Buscar negócios',exact:true}).click();
 await search.focus();
 const outline=await search.evaluate(e=>getComputedStyle(e).outlineWidth);
 if(outline!=='2px') throw new Error('search focus');
 if(width===390) await page.getByRole('button',{name:'Fechar busca',exact:true}).click();
 await page.getByRole('button',{name:'Personalizar cartões',exact:true}).focus();
 await page.keyboard.press('Enter');await page.getByRole('dialog').waitFor();
 await page.getByRole('button',{name:'Cancelar',exact:true}).click();
 if(await page.evaluate(()=>document.activeElement?.getAttribute('aria-label'))!=='Personalizar cartões') throw new Error('focus return');
 await page.getByRole('button',{name:'Adicionar negócio',exact:true}).first().click();
 await page.getByRole('dialog').waitFor();await page.keyboard.press('Escape');
}
await page.setViewportSize({width:1440,height:900});
await page.evaluate(()=>document.documentElement.classList.remove('dark'));
// Live GET response is retained, preserving actual payload; no fake loading DOM.
globalThis.captureStep='loading';
let release; const gate=new Promise(resolve=>{release=resolve;});
const endpoint=`**/api/v1/pipelines/${pipelineId}`;
await page.route(endpoint, async route=>{ if(route.request().method()==='GET') await gate;await route.fallback(); });
await page.reload({waitUntil:'domcontentloaded'});
await page.getByRole('status',{name:'Carregando quadro',exact:true}).waitFor();
const count=await page.locator('.board-loading-columns .kanban-column').count();
if(count!==6) throw new Error('cached stage count');
await page.screenshot({path:`${out}/u4-depois-carregando.png`});
await page.emulateMedia({reducedMotion:'reduce'});
if(await page.locator('.board-loading i').first().evaluate(e=>getComputedStyle(e).animationName)!=='none') throw new Error('reduced motion');
release();await page.locator('.deal-card-shell').first().waitFor();await page.unroute(endpoint);await setPortuguese();
await page.route(endpoint, async route=>route.request().method()==='GET'?route.fulfill({status:503,json:{message:'Falha sintética'}}):route.fallback());
await page.reload();await page.getByRole('button',{name:'Tentar novamente',exact:true}).waitFor();await setPortuguese();
await page.screenshot({path:`${out}/u4-depois-erro-retry.png`});
await page.unroute(endpoint);
await page.getByRole('button',{name:'Tentar novamente',exact:true}).click();await page.locator('.deal-card-shell').first().waitFor();
// Screenshot a null owner supplied only to this local read request; no server mutation.
await page.route(endpoint, async route=>{
 if(route.request().method()!=='GET') return route.fallback();
 try {const response=await route.fetch();const body=await response.json();
 const clearOwners=value=>{if(!value||typeof value!=='object')return;if('owner' in value)value.owner=null;if('assignee' in value)value.assignee=null;for(const child of Object.values(value))clearOwners(child);};clearOwners(body);
 return await route.fulfill({response,json:body});}catch{return route.abort().catch(() => {});}
});
await page.reload();await page.locator('.deal-card-shell').first().waitFor();await setPortuguese();
await page.getByText('Sem responsável',{exact:true}).first().waitFor();
await page.screenshot({path:`${out}/u4-depois-sem-responsavel.png`});await page.unroute(endpoint);
// Empty pipeline with no stages is also local read substitution, no deletion.
await page.route(endpoint, async route=>{
 if(route.request().method()!=='GET')return route.fallback();
 try {const response=await route.fetch();const body=await response.json();const empty=value=>{if(!value||typeof value!=='object')return;if(Array.isArray(value.stages))value.stages=[];for(const child of Object.values(value))empty(child);};empty(body);return await route.fulfill({response,json:body});}catch{return route.abort().catch(() => {});}
});
globalThis.captureStep='no-stages';
await page.reload();await page.getByRole('heading',{name:'Crie a primeira etapa',exact:true}).waitFor();await setPortuguese();
await page.screenshot({path:`${out}/u4-depois-sem-etapas.png`});
await page.unroute(endpoint);
fs.writeFileSync(`${out}/u4-medicoes.json`,JSON.stringify({metrics,cachedStageCount:count,originFilter:true,singleClear:true,focusReturn:true,retry:true,reducedMotion:true,unassigned:true},null,2));
await page.waitForTimeout(300);await page.unrouteAll({behavior:'ignoreErrors'});await browser.close();console.log('U4 verificado: toolbar, filtros, teclado, esqueleto, retry e sem responsável.');
