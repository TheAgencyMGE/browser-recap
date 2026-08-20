import { getSessionsBetween, getDomainMeta } from '../lib/db.js';
import { summarizeSessions } from '../lib/analytics.js';
import { startOfDay, formatDuration, escapeHtml, localDayKey } from '../lib/utils.js';

const response=await chrome.runtime.sendMessage({type:'tracking:status'});
const settings=response?.settings||{};
const sessions=await getSessionsBetween(startOfDay(),Date.now()+1);
const pendingResult=await chrome.storage.local.get('browserRecapPendingSession');
const pending=pendingResult.browserRecapPendingSession;
if(pending?.domain&&settings.trackingEnabled){const now=Date.now();sessions.push({...pending,endTime:now,durationMs:Math.max(0,now-pending.startTime),dateKey:localDayKey(pending.startTime)});}
const meta=await getDomainMeta();
const summary=summarizeSessions(sessions,meta,startOfDay());
const status=document.querySelector('#status');status.classList.toggle('on',!!settings.trackingEnabled);status.textContent=settings.trackingEnabled?'Tracking active':'Tracking is paused';
const top=summary.topDomains[0];
document.querySelector('#today').innerHTML=`<div class="big">${formatDuration(summary.totalMs,true)}</div><div class="small">Today${top?` · top site: ${escapeHtml(top.domain)}`:''}</div>`;
const tracking=document.querySelector('#tracking');tracking.textContent=settings.trackingEnabled?'Pause tracking':(settings.consentedAt?'Start tracking':'Set up tracking');tracking.onclick=async()=>{if(!settings.consentedAt){await chrome.tabs.create({url:chrome.runtime.getURL('onboarding/index.html')});window.close();return;}await chrome.runtime.sendMessage({type:'tracking:set',enabled:!settings.trackingEnabled});window.close();};
document.querySelector('#open').onclick=()=>chrome.tabs.create({url:chrome.runtime.getURL('dashboard/index.html#overview')});
