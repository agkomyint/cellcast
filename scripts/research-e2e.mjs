import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
const base=process.env.CELLCAST_URL||'http://127.0.0.1:3001';
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1280,height:800},acceptDownloads:true});
const page=await context.newPage();
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const evidence={comparisons:[],models:[],scroll:[],viewports:[],errors};
const assert=(condition,message)=>{if(!condition)throw Error(message)};
const nav=async(name)=>{await page.getByRole('button',{name,exact:true}).click();await page.getByRole('main',{name,exact:true}).waitFor()};
const waitScroll=async(pane,test)=>page.waitForFunction(({selector,test})=>{const e=document.querySelector(selector);return test==='positive'?e.scrollTop>20:e.scrollTop===0},{selector:pane,test},{timeout:5000});
const chooseGene=async(gene)=>{await page.getByRole('combobox',{name:'Choose gene',exact:true}).click({timeout:45000});await page.getByRole('textbox',{name:'Search genes',exact:true}).fill(gene);await page.getByRole('option').filter({hasText:gene}).first().click({timeout:30000})};
const compare=async(gene)=>{await chooseGene(gene);await page.getByRole('button',{name:/^(Compare expression|Test perturbation response)$/}).click({timeout:45000});await page.locator(`.comparison-results[data-gene="${gene}"]`).waitFor({timeout:45000});evidence.comparisons.push({gene,study:await page.locator('.comparison-results').getAttribute('data-study'),results:await page.locator('.comparison-results').innerText()})};
const openStudy=async(id,kingdom)=>{await nav('Dataset Explorer');await page.getByRole('combobox',{name:'Filter kingdom',exact:true}).selectOption(kingdom);await page.getByRole('combobox',{name:'Filter species',exact:true}).selectOption('all');await page.getByRole('textbox',{name:'Search Studies',exact:true}).fill(id);const row=page.getByRole('row').filter({hasText:id});await row.getByRole('button',{name:'Open study',exact:true}).click();await page.getByRole('combobox',{name:'Experiment dataset',exact:true}).waitFor();await page.waitForFunction(id=>document.querySelector('[aria-label="Experiment dataset"]').value===id,id,{timeout:15000})};
try{
 await mkdir('docs/evidence',{recursive:true});
 await page.goto(base,{waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:/^(Compare expression|Test perturbation response)$/}).click({timeout:45000});
 await page.locator('.comparison-results').waitFor({timeout:45000});
 console.log('Real comparison loaded');
 await compare('AT3G18780');
 await chooseGene('AT1G99999');await page.getByRole('button',{name:/^(Compare expression|Test perturbation response)$/}).click();await page.locator('.repository-error').waitFor({timeout:45000});evidence.invalidGene=await page.locator('.repository-error').innerText();assert(/Gene ID not found/.test(evidence.invalidGene),'Unknown gene was not rejected');await compare('AT1G01010');
 await page.locator('.workspace-scroll').evaluate(e=>e.scrollTop=0);const header=await page.locator('.topbar').boundingBox();const box=await page.locator('canvas').boundingBox();await page.mouse.move(box.x+box.width/2,Math.min(650,box.y+box.height/2));await page.mouse.wheel(0,500);await waitScroll('.workspace-scroll','positive');const plotWheel=await page.locator('.workspace-scroll').evaluate(e=>e.scrollTop);assert((await page.locator('.topbar').boundingBox()).y===header.y,'Navigation moved with workspace');evidence.scroll.push({case:'wheel over plot',scrollTop:plotWheel,headerY:header.y});
 await page.getByRole('tab',{name:'Cell table',exact:true}).click();const tablePane=page.getByLabel('Experiment cells scroll area',{exact:true});await tablePane.evaluate(e=>{e.scrollTop=600;e.scrollLeft=80});await page.getByRole('button',{name:'Zoom in Experiment cells',exact:true}).click();assert(await page.getByLabel('Experiment cells zoom',{exact:true}).innerText()==='110%','Table zoom did not change');const before=await tablePane.evaluate(e=>e.scrollTop);await nav('Dataset Explorer');await page.getByRole('table',{name:'Studies',exact:true}).waitFor();assert(await page.getByLabel('Studies zoom',{exact:true}).innerText()==='100%','Table zoom leaked across pages');await nav('Experiment Lab');await tablePane.waitFor({timeout:45000});await page.waitForFunction(()=>document.querySelector('[aria-label="Experiment cells scroll area"]').scrollTop>400);evidence.scroll.push({case:'table state restored after navigation',before,after:await tablePane.evaluate(e=>e.scrollTop),zoom:await page.getByLabel('Experiment cells zoom',{exact:true}).innerText()});
 await page.reload({waitUntil:'domcontentloaded'});await tablePane.waitFor({timeout:45000});await page.waitForFunction(()=>document.querySelector('[aria-label="Experiment cells scroll area"]').scrollTop>400);assert(await page.getByLabel('Experiment cells zoom',{exact:true}).innerText()==='110%','Table zoom did not survive reload');
 await nav('Research History');await page.getByRole('button',{name:'Reopen',exact:true}).first().click();await page.locator('.comparison-results').waitFor({timeout:45000});console.log('Comparison history and table state passed');
 await openStudy('E-CURD-81','plants');await compare('Os01g0100100');
 await openStudy('E-MTAB-7606','animals');await compare('ENSG00000141510');console.log('Arabidopsis, rice and human comparisons passed');
 await openStudy('E-ENAD-30','plants');await compare('AT3G18780');assert((await page.locator('.comparison-heading').innerText()).includes('Observed perturbation response'),'Treatment response mode not recognized');assert(await page.getByRole('combobox',{name:'Group A',exact:true}).inputValue()==='None','Untreated group was not selected as control');
 await openStudy('E-GEOD-123013','plants');await page.getByRole('combobox',{name:'Experiment type',exact:true}).selectOption('perturbation');await page.getByRole('combobox',{name:'Group cells by',exact:true}).selectOption('genotype');await page.getByRole('combobox',{name:'Group B',exact:true}).selectOption('Rhd6 mutant',{timeout:45000});await compare('AT3G18780');
 await openStudy('E-MTAB-6075','animals');await compare('ENSG00000115415');assert((await page.locator('.comparison-heading').innerText()).includes('Observed perturbation response'),'Human treatment labels missing');console.log('Plant chemical, Rhd6 mutant, and human LPS perturbation responses passed');
 await nav('Model Library');
 for(const model of ['scplant','scgpt']){
  await page.getByRole('button',{name:model==='scplant'?/scPlantLLM Arabidopsis/:/scGPT Human/}).click();
  const profiles=await (await page.request.get(`${base}/models/${model}-real-profiles.json`)).json();
  for(let i=0;i<3;i++){
   await page.getByRole('combobox',{name:'Model source cell',exact:true}).selectOption(String(i));await page.getByRole('button',{name:'Run model',exact:true}).click({timeout:45000});await page.locator(`.model-result[data-model="${model}"][data-cell="${profiles.profiles[i].id}"]`).waitFor({timeout:45000});evidence.models.push({model,cell:profiles.profiles[i].id,result:await page.locator('.model-result-header').innerText()});
  }
  await page.getByRole('button',{name:'Zoom in Model output',exact:true}).click();await page.getByText('Inspect input measurements',{exact:true}).click();assert(await page.getByLabel('Model inputs zoom',{exact:true}).innerText()==='100%','Input and output table zoom leaked');
 }
 console.log('Six actual browser model runs passed');
 const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Export',exact:true}).click();const download=await downloadPromise;await download.saveAs('docs/evidence/model-output-export.json');
 await page.reload({waitUntil:'domcontentloaded'});await page.locator('.model-result[data-model="scgpt"]').waitFor({timeout:15000});assert(/Saved result restored/.test(await page.locator('.model-status').innerText()),'Model result was not restored');
 await openStudy('E-CURD-4','plants');await page.getByRole('tab',{name:'Cell landscape',exact:true}).click();
 for(const width of [1440,1280,768,375]){
  await page.setViewportSize({width,height:900});
  for(const section of ['Experiment Lab','Dataset Explorer','Model Library','Research History']){
   await nav(section);await page.locator('.workspace-scroll').evaluate(e=>{e.scrollTop=0});const fit=await page.evaluate(()=>({width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,windowScroll:scrollY,headerY:document.querySelector('.topbar').getBoundingClientRect().top}));assert(!fit.overflow&&fit.windowScroll===0,`${section} frame overflow at ${width}`);evidence.viewports.push({section,...fit});await page.screenshot({path:`docs/evidence/research-${section.toLowerCase().replaceAll(' ','-')}-${width}.png`});
  }
 }
 assert(!errors.length,errors.join('\n'));await writeFile('docs/evidence/research-e2e.json',JSON.stringify(evidence,null,2));console.log('All research flows, four pages and four viewports passed');
}catch(error){await page.screenshot({path:'docs/evidence/research-failure.png'}).catch(()=>{});await writeFile('docs/evidence/research-failure.json',JSON.stringify({error:String(error),...evidence},null,2));throw error}finally{await browser.close()}
