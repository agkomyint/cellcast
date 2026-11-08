import {studies,ATLAS} from '@/lib/atlas';
export async function GET(request:Request){try{return Response.json({studies:await studies(new URL(request.url).searchParams.has('refresh')),source:`${ATLAS}json/experiments`,retrievedAt:new Date().toISOString()})}catch(error){return Response.json({error:error instanceof Error?error.message:'Repository unavailable'},{status:502})}}
