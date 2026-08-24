import { chromium } from "playwright";
const WEB="http://localhost:3000";
const ORG="01a01186-c964-7000-b6d7-0d3db40c5aa1";
function log(m){console.log(`[resp] ${m}`);}
async function main(){
  const b=await chromium.launch();
  const ctx=await b.newContext({viewport:{width:390,height:844}});
  const p=await ctx.newPage();
  const errs=[];
  p.on("console",m=>{if(m.type()==="error")errs.push(m.text());});
  await p.goto(`${WEB}/auth/signin`);
  await p.fill("#email","owner@example.org");await p.fill("#password","development-only-password-1234");
  await p.click('button[type="submit"]');await p.waitForTimeout(2500);

  const routes=[
    "/", "/challenges", "/organizations", "/results",
    "/app","/app/challenges","/app/my-challenges","/app/teams","/app/submissions","/app/results",
    "/app/inbox","/app/support","/app/profile","/app/settings",
    `/org/${ORG}`,`/org/${ORG}/challenges`,`/org/${ORG}/members`,`/org/${ORG}/invitations`,
    `/org/${ORG}/join-codes`,`/org/${ORG}/join-requests`,`/org/${ORG}/analytics`,`/org/${ORG}/exports`,
    `/org/${ORG}/settings`,`/org/${ORG}/audit`,`/org/${ORG}/forms`,`/org/${ORG}/portfolio`,
  ];
  let overflow=0;
  for(const r of routes){
    await p.goto(`${WEB}${r}`);await p.waitForTimeout(1200);
    const res=await p.evaluate(()=>({
      sw:document.documentElement.scrollWidth,
      cw:document.documentElement.clientWidth,
    }));
    const bad=res.sw>res.cw+2;
    if(bad){overflow++;log(`OVERFLOW ${r}: scrollWidth=${res.sw} clientWidth=${res.cw}`);}
  }
  log(`Routes checked: ${routes.length}, horizontal overflow: ${overflow}`);
  log(`Console errors: ${errs.length}`);
  [...new Set(errs)].slice(0,8).forEach(e=>log("  "+e));
  await b.close();
}
main().catch(e=>{console.error(e);process.exit(1);});
