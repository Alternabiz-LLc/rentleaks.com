import assert from "node:assert/strict";
import { test } from "node:test";
import { providerCampaigns, type Campaign } from "../src/lib/provider-sponsors";
test("provider campaigns require approval, dates, market relevance and safe destinations", () => {
 const now=Date.parse("2026-10-13T12:00:00Z");
 const good: Campaign={name:"Synthetic provider",headline:"Synthetic portfolio",href:"/operators.html",approved:true,startsAt:"2026-10-01",endsAt:"2026-11-01",homepage:true,cityIds:["nyc"],types:["room"]};
 assert.equal(providerCampaigns({city:"nyc",type:"room"},[good],now).length,1);
 for(const context of [{city:"boston",type:"room"},{city:"nyc",type:"furnished"},{}]) assert.equal(providerCampaigns(context,[good],now).length,0);
 for(const patch of [{approved:false},{endsAt:"2026-10-12"},{startsAt:"2026-10-14"},{href:"https://evil.example/"},{href:"javascript:alert(1)"},{href:"https://user:password@rentleaks.com/"}]) assert.equal(providerCampaigns({home:true},[{...good,...patch}],now).length,0);
 const list=Array.from({length:5},(_,i)=>({...good,name:String(i)}));
 assert.equal(providerCampaigns({home:true},list,now).length,3);
 assert.notDeepEqual(providerCampaigns({home:true},list,now),providerCampaigns({home:true},list,now+86400000));
});
