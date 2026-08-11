import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { validateTelegramInitData } from "../src/lib/telegram.ts";
function signed(token:string,now:number){const p=new URLSearchParams({auth_date:String(now),query_id:"q",user:JSON.stringify({id:42,first_name:"Ada"})});const check=[...p].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}=${v}`).join("\n");const secret=createHmac("sha256","WebAppData").update(token).digest();p.set("hash",createHmac("sha256",secret).update(check).digest("hex"));return p.toString()}
test("validates signed Telegram initData",()=>assert.equal(validateTelegramInitData(signed("token",1000),"token",60,1000).user.id,42));
test("rejects stale initData",()=>assert.throws(()=>validateTelegramInitData(signed("token",900),"token",60,1000),/Expired/));
test("rejects tampering",()=>assert.throws(()=>validateTelegramInitData(signed("token",1000).replace("Ada","Eve"),"token",60,1000),/signature/));
