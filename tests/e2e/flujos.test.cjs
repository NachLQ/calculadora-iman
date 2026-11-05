const {test}=require('node:test'),assert=require('node:assert/strict');const {fixture}=require('./fixture.cjs');
test('calculadora: CRUD, precio, leads, conversión y borrado en cascada',async()=>{
 const f=await fixture();try{
  const calc=await f.json('post','/api/calculadoras',{nombre:'Obra E2E',precio_base:100,margen_rango_porcentaje:10});
  await f.json('put',`/api/calculadoras/${calc.id}`,{nombre:'Obra editada'});assert.equal((await f.json('get',`/api/calculadoras/${calc.id}`)).nombre,'Obra editada');
  const price=await f.json('post',`/api/calculadora/${calc.slug}/calcular`,{configuracion:{}});assert.equal(price.precio_min,90);assert.equal(price.precio_max,110);
  const visit=await f.json('post',`/api/calculadora/${calc.slug}/visita`,{});
  const lead=await f.json('post',`/api/calculadora/${calc.slug}/lead`,{nombre:'Cliente prueba',email:'cliente@example.invalid',configuracion:{},visita_id:visit.visita_id});
  assert.equal(lead.precio_min,90);assert.equal(lead.precio_max,110);
  await f.json('put',`/api/leads/${lead.lead_id}`,{estado:'contactado'});
  const leads=await f.json('get',`/api/leads?calculadora_id=${calc.id}`);assert.equal(leads[0].estado,'contactado');
  const stored=await f.json('get',`/api/calculadoras/${calc.id}`);assert.equal(stored.stats.visitas,1);assert.equal(stored.stats.leads,1);assert.equal(stored.stats.conversion,100);
  const sel=await f.json('post',`/api/calculadoras/${calc.id}/pasos`,{titulo:'Tipo de obra',tipo:'seleccion_unica',opciones:[{etiqueta:'Reforma integral'}]});
  await f.json('post',`/api/calculadora/${calc.slug}/lead`,{nombre:'Con opciones',email:'otro@example.invalid',configuracion:{[sel.id]:sel.opciones[0].id}});
  const conOpc=(await f.json('get',`/api/leads?calculadora_id=${calc.id}`)).find(l=>l.nombre==='Con opciones');assert.deepEqual(conOpc.respuestas,[{pregunta:'Tipo de obra',respuesta:'Reforma integral'}]);
  await f.json('delete',`/api/calculadoras/${calc.id}/pasos/${sel.id}`);
  const step=await f.json('post',`/api/calculadoras/${calc.id}/pasos`,{titulo:'Cantidad',tipo:'numero',num_min:1,num_max:10});
  await f.json('put',`/api/calculadoras/${calc.id}/pasos/${step.id}`,{titulo:'Metros'});assert.equal((await f.json('get',`/api/calculadoras/${calc.id}`)).pasos[0].titulo,'Metros');
  await f.json('delete',`/api/calculadoras/${calc.id}/pasos/${step.id}`);assert.equal((await f.json('get',`/api/calculadoras/${calc.id}`)).pasos.length,0);
  const multi=await f.json('post',`/api/calculadoras/${calc.id}/pasos`,{titulo:'Extras',tipo:'seleccion_multiple',opciones:[{etiqueta:'Visita'},{etiqueta:'Material'}]});
  const cero=await f.json('post',`/api/calculadoras/${calc.id}/pasos`,{titulo:'Cantidad cero',tipo:'numero',num_min:0,num_max:10});
  const texto=await f.json('post',`/api/calculadoras/${calc.id}/pasos`,{titulo:'Notas',tipo:'texto'});
  await f.json('post',`/api/calculadora/${calc.slug}/lead`,{nombre:'Respuestas completas',email:'respuestas@example.invalid',configuracion:{[multi.id]:multi.opciones.map(o=>o.id),[cero.id]:0,[texto.id]:'Zona centro'}});
  const readable=(await f.json('get',`/api/leads?calculadora_id=${calc.id}`)).find(l=>l.nombre==='Respuestas completas');assert.deepEqual(readable.respuestas,[{pregunta:'Extras',respuesta:'Visita, Material'},{pregunta:'Cantidad cero',respuesta:'0'},{pregunta:'Notas',respuesta:'Zona centro'}]);
  await f.json('delete',`/api/calculadoras/${calc.id}`);assert.equal((await f.api.get(`/api/calculadoras/${calc.id}`)).status(),404);assert.equal((await f.json('get',`/api/leads?calculadora_id=${calc.id}`)).length,0);
 }finally{await f.close();}
});
