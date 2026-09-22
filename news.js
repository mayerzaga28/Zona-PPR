import {getNews} from '../lib/data.js';
export default async function handler(req,res){try{const news=await getNews();res.setHeader('Cache-Control','public, s-maxage=1800, stale-while-revalidate=1800');res.status(200).json(news)}catch{res.status(503).json({error:'No se pudieron consultar las noticias.'})}}
