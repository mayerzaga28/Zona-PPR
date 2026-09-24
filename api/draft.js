import {getDraft} from '../lib/data.js';
export default async function handler(req,res){try{res.setHeader('Cache-Control','public, s-maxage=300');res.status(200).json(await getDraft())}catch{res.status(503).json({error:'No se pudo consultar el ADP de temporada. Inténtalo de nuevo.'})}}
