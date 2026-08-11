import {NextRequest,NextResponse} from "next/server";import {requireAdmin} from "@/lib/admin-auth";
export async function POST(req:NextRequest){try{const {admin,telegram}=await requireAdmin(req);return NextResponse.json({data:{admin,telegram}})}catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Unauthorized"},{status:401})}}
