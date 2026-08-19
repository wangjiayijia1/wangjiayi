
// ==================== DATA LOADING ====================
// Prices loaded from data.json (auto-updated by GitHub Actions daily)
let products = [];
let rawMaterials = [];
let intermediates = [];
let profitLines = [];
let peerPlants = [];
let defaultCosts = {h2:1.50, steam:220, power:0.55};
let costParams = {
  h2: parseFloat(localStorage.getItem('th_cost_h2')) || defaultCosts.h2,
  steam: parseFloat(localStorage.getItem('th_cost_steam')) || defaultCosts.steam,
  power: parseFloat(localStorage.getItem('th_cost_power')) || defaultCosts.power,
};
let priceData = null;

async function loadData(){
  try{
    const resp = await fetch('data.json');
    if(!resp.ok) throw new Error('HTTP '+resp.status);
    priceData = await resp.json();
    products = priceData.products || [];
    rawMaterials = priceData.rawMaterials || [];
    intermediates = priceData.intermediates || [];
    profitLines = priceData.profitLines || [];
    peerPlants = priceData.peerPlants || [];
    if(priceData.defaultCosts){
      defaultCosts = priceData.defaultCosts;
      costParams = {
        h2: parseFloat(localStorage.getItem('th_cost_h2')) || defaultCosts.h2,
        steam: parseFloat(localStorage.getItem('th_cost_steam')) || defaultCosts.steam,
        power: parseFloat(localStorage.getItem('th_cost_power')) || defaultCosts.power,
      };
    }
    const dsEl = document.querySelector('.data-source');
    if(dsEl && priceData.lastUpdate){
      dsEl.innerHTML = '\u6570\u636e\u6765\u6e90\uff1a\u751f\u610f\u793e(100ppi.com)<br>\u4ef7\u683c\u66f4\u65b0\u65f6\u95f4\uff1a' + priceData.lastUpdate + ' \u00b7 \u4ec5\u4f9b\u53c2\u8003\uff0c\u4e0d\u6784\u6210\u4ea4\u6613\u4f9d\u636e';
    }
    return true;
  }catch(err){
    console.error('Failed to load data.json:', err);
    const dateEl = document.getElementById('topDate');
    if(dateEl) dateEl.textContent = '\u26a0 \u6570\u636e\u52a0\u8f7d\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u5237\u65b0';
    return false;
  }
}

// ==================== PROFIT LINES ====================
// Loaded from data.json via loadData()

// ==================== PEER PLANTS ====================
// peerPlants loaded from data.json (declared above)
function renderPeerPlants(){
  const html=peerPlants.map(p=>{
    const tags=p.products.map(t=>'<span class="peer-product-tag">'+t+'</span>').join("");
    return '<div class="peer-card">'+
      '<div class="peer-card-head">'+
        '<div class="peer-name">'+p.name+'</div>'+
        '<div class="peer-location">'+p.location+'</div>'+
      '</div>'+
      '<div class="peer-products">'+tags+'</div>'+
      '<div class="peer-capacity">'+p.capacity+'</div>'+
      '<div class="peer-status">'+p.status+'</div>'+
      '<div class="peer-note">'+p.note+'</div>'+
    '</div>';
  }).join("");
  document.getElementById("peerGrid").innerHTML=html;
}

// ==================== CALCULATE PROFIT ====================
// utilityOverrides / otherCostOverrides: 每条产品线可手动覆盖公用工程综合成本 / 其他辅料成本
// key = productLine name, value = number (用户输入的覆盖值)
const utilityOverrides = {};
const otherCostOverrides = {};

function calcProfit(line){
  let rawCost=0;
  line.rawMaterials.forEach(rm=>{rawCost+=rm.qty*rm.price});
  const h2Cost=line.h2Qty*costParams.h2;
  const steamCost=line.steamQty*costParams.steam;
  const powerCost=line.powerQty*costParams.power;
  const hasOtherOverride=otherCostOverrides.hasOwnProperty(line.name);
  const otherCost=hasOtherOverride?otherCostOverrides[line.name]:line.otherCost;
  const byproduct=line.byproduct||0;
  const autoUtility=h2Cost+steamCost+powerCost;
  const hasOverride=utilityOverrides.hasOwnProperty(line.name);
  const utilityTotal=hasOverride?utilityOverrides[line.name]:autoUtility;
  const totalCost=rawCost+utilityTotal+otherCost-byproduct;
  const profit=line.productPrice-totalCost;
  return{profit,rawCost,h2Cost,steamCost,powerCost,utilityTotal,autoUtility,hasOverride,otherCost,hasOtherOverride,byproduct,totalCost};
}

function fmtMoney(n){
  const r=Math.round(n);
  return (r>0?"+":"")+r.toLocaleString();
}
function fmtCost(n){
  return "-"+Math.round(n).toLocaleString();
}

// ==================== GENERATE 30-DAY HISTORY ====================
function generateHistory(item){
  const history=[];
  const today=new Date();
  const cur=item.price;
  const totalChange=(item.weekPct/100)*(30/7);
  const startPrice=cur/(1+totalChange);
  for(let i=29;i>=0;i--){
    const d=new Date(today);
    d.setDate(d.getDate()-i);
    const progress=(29-i)/29;
    const base=startPrice+(cur-startPrice)*progress;
    const noise=(Math.sin(i*1.3+item.name.length*2)*0.4+Math.sin(i*2.7+item.name.length)*0.3+Math.sin(i*0.9)*0.3)*Math.max(cur*0.008,1);
    const price=Math.max(0,base+noise);
    history.push({date:(d.getMonth()+1)+"/"+d.getDate(),price:Math.round(price*100)/100});
  }
  history[history.length-1].price=cur;
  return history;
}

// ==================== RENDER PRICE CARDS ====================
function renderPriceCard(item){
  const arrow=item.trend==="up"?"\u25B2":item.trend==="down"?"\u25BC":"\u2014";
  const changeColor=item.trend==="up"?"up":item.trend==="down"?"down":"flat";
  const weekColor=item.weekPct>0?"up":item.weekPct<0?"down":"flat";
  const weekArrow=item.weekPct>0?"\u25B2":item.weekPct<0?"\u25BC":"\u2014";
  const tagClass=item.tag==="product"?"pc-tag-product":item.tag==="raw"?"pc-tag-raw":"pc-tag-mid";
  const tagLabel=item.tag==="product"?"\u4ea7\u54c1":item.tag==="raw"?"\u539f\u6599":"\u4e2d\u95f4\u4f53";
  const changeStr=item.change>0?("+"+item.change):item.change<0?item.change:"0";
  const dataKey=item.name;
  let alertBadge="";
  if(item.alert){
    const aType=item.alert.type;
    let badgeIcon="\u26a0",badgeText="";
    if(aType==="surge"){badgeIcon="\u25B2";badgeText="\u5f02\u5e38\u6da8"}
    else if(aType==="crash"){badgeIcon="\u25BC";badgeText="\u5f02\u5e38\u8dcc"}
    else if(aType==="high"){badgeIcon="\u26a0";badgeText="\u4ef7\u683c\u5f02\u5e38"}
    alertBadge='<span class="pc-alert-badge '+aType+'">'+badgeIcon+' '+badgeText+'</span>';
  }
  return '<div class="price-card '+item.trend+'" data-key="'+dataKey+'">'+
    '<div class="pc-head"><div class="pc-name">'+item.name+alertBadge+'</div><div class="pc-tag '+tagClass+'">'+tagLabel+'</div></div>'+
    '<div class="pc-price">'+item.price.toLocaleString()+'<span>'+item.unit+'</span></div>'+
    '<div class="pc-change">'+
      '<div class="pc-change-item '+changeColor+'"><span class="pc-arrow">'+arrow+'</span>'+changeStr+' ('+(item.changePct>0?"+":"")+item.changePct+'%)</div>'+
      '<div class="pc-change-item '+weekColor+'">\u5468'+weekArrow+' '+(item.weekPct>0?"+":"")+item.weekPct+'%</div>'+
    '</div>'+
    '<div class="pc-formula">'+item.formula+'</div>'+
    '<div class="pc-hint">'+(item.alert?'\u70b9\u51fb\u67e5\u770b\u8d8b\u52bf\u53ca\u5f02\u5e38\u539f\u56e0':'\u70b9\u51fb\u67e5\u770b\u8d8b\u52bf')+' \u203a</div>'+
  '</div>';
}

function renderAllPriceCards(){
  document.getElementById("productGrid").innerHTML=products.map(renderPriceCard).join("");
  document.getElementById("rawGrid").innerHTML=rawMaterials.map(renderPriceCard).join("");
  document.getElementById("midGrid").innerHTML=intermediates.map(renderPriceCard).join("");
  document.getElementById("productCount").textContent="("+products.length+"\u79cd)";
  document.getElementById("rawCount").textContent="("+rawMaterials.length+"\u79cd)";
  document.getElementById("midCount").textContent="("+intermediates.length+"\u79cd)";
  const allItems=[...products,...rawMaterials,...intermediates];
  document.getElementById("upCount").textContent=allItems.filter(i=>i.trend==="up").length;
  document.getElementById("downCount").textContent=allItems.filter(i=>i.trend==="down").length;
  document.getElementById("flatCount").textContent=allItems.filter(i=>i.trend==="flat").length;
}

// ==================== RENDER PROFIT CARDS ====================
function renderProfitCards(){
  const html=profitLines.map(line=>{
    const r=calcProfit(line);
    const status=r.profit>=line.threshold?"profit":"loss";
    const maxBar=5000;
    const barWidth=Math.min(Math.abs(r.profit)/maxBar*100,100);
    const statusText=status==="profit"?"\u76c8\u5229":"\u4e8f\u635f";
    let calcRows='';
    calcRows+='<div class="row"><span class="label">\u4ea7\u54c1\u552e\u4ef7</span><span class="value">+'+line.productPrice.toLocaleString()+' \u5143/\u5428</span></div>';
    line.rawMaterials.forEach(rm=>{
      calcRows+='<div class="row"><span class="label">'+rm.label+' '+rm.qty+rm.unit+' x '+rm.price.toLocaleString()+'</span><span class="value">'+fmtCost(rm.qty*rm.price)+' \u5143</span></div>';
    });
    if(line.h2Qty>0) calcRows+='<div class="row"><span class="label">\u6c22\u6c14 '+line.h2Qty+' Nm3 x '+costParams.h2.toFixed(2)+'</span><span class="value editable">'+fmtCost(r.h2Cost)+' \u5143</span></div>';
    if(line.steamQty>0) calcRows+='<div class="row"><span class="label">\u84b8\u6c7d '+line.steamQty+' \u5428 x '+costParams.steam+'</span><span class="value editable">'+fmtCost(r.steamCost)+' \u5143</span></div>';
    else if(line.steamQty<0) calcRows+='<div class="row"><span class="label">\u526f\u4ea7\u84b8\u6c7d '+(-line.steamQty)+' \u5428 x '+costParams.steam+'</span><span class="value" style="color:var(--c-profit)">+'+Math.round(-r.steamCost).toLocaleString()+' \u5143</span></div>';
    if(line.powerQty>0) calcRows+='<div class="row"><span class="label">\u7535\u529b '+line.powerQty+' kWh x '+costParams.power.toFixed(2)+'</span><span class="value editable">'+fmtCost(r.powerCost)+' \u5143</span></div>';
    // 公用工程综合成本（可手动覆盖）
    const utilClass=r.hasOverride?'utility-input overridden':'utility-input';
    const utilVal=r.hasOverride?Math.round(r.utilityTotal):Math.round(r.autoUtility);
    calcRows+='<div class="row" style="border-top:1px solid rgba(45,61,80,.5);padding-top:4px;margin-top:2px"><span class="label" style="color:var(--c-accent);font-weight:600">\u2192 \u516c\u7528\u5de5\u7a0b\u7efc\u5408\u6210\u672c</span><span class="value"><input type="number" class="'+utilClass+'" data-line="'+line.name+'" value="'+utilVal+'" step="1" min="0" style="width:90px"> \u5143</span></div>';
    if(line.otherCost>0) {
      const oClass=r.hasOtherOverride?'utility-input overridden':'utility-input';
      const oVal=r.hasOtherOverride?Math.round(r.otherCost):Math.round(line.otherCost);
      calcRows+='<div class="row"><span class="label">\u5176\u4ed6\u8f85\u6599(\u50ac\u5316\u5242/\u6eb6\u5242\u7b49)</span><span class="value"><input type="number" class="'+oClass+'" data-line="'+line.name+'" data-type="other" value="'+oVal+'" step="1" min="0" style="width:90px"> \u5143</span></div>';
    }
    if(r.byproduct>0) calcRows+='<div class="row"><span class="label">'+(line.byproductLabel||"\u526f\u4ea7\u56de\u6536")+'</span><span class="value" style="color:var(--c-profit)">+'+r.byproduct.toLocaleString()+' \u5143</span></div>';
    calcRows+='<div class="sep"></div>';
    calcRows+='<div class="row"><span class="label">\u5428\u6bdb\u5229</span><span class="value" style="color:'+(status==='profit'?'var(--c-profit)':'var(--c-loss)')+';font-weight:800">'+fmtMoney(r.profit)+' \u5143/\u5428</span></div>';
    // 装置信息
    if(line.plant){
      calcRows+='<div class="plant-info">';
      calcRows+='<div class="plant-capacity">'+line.plant.capacity+'</div>';
      calcRows+='<div class="plant-unit">'+line.plant.unitName+'</div>';
      calcRows+='<div class="plant-row"><span class="pl-label">\u8fd0\u884c</span><span class="pl-text">'+line.plant.status+'</span></div>';
      calcRows+='<div class="plant-row"><span class="pl-label">\u4f18\u52bf</span><span class="pl-text">'+line.plant.advantage+'</span></div>';
      calcRows+='</div>';
    }
    return '<div class="profit-card '+status+'">'+
      '<div class="pc-status">'+statusText+'</div>'+
      '<div class="profit-head"><div class="profit-name">'+line.name+'</div></div>'+
      '<div class="profit-calc">'+calcRows+'</div>'+
      '<div class="profit-result"><span class="pr-label">\u5229\u6da6\u72b6\u6001</span><span class="pr-value">'+fmtMoney(r.profit)+'</span></div>'+
      '<div class="profit-bar"><div class="profit-bar-fill" style="width:'+barWidth+'%"></div></div>'+
      '<div class="profit-threshold">\u9884\u8b66\u9608\u503c: '+line.threshold+' \u5143/\u5428 \u00b7 \u5f53\u524d'+(r.profit<line.threshold?"\u5df2\u4f4e\u4e8e":"\u9ad8\u4e8e")+"\u9608\u503c"+(r.profit<line.threshold?" \u26a0":"")+'</div>'+
      (line.analysis?'<div class="profit-ai-hint">\u25b8 \u70b9\u51fb\u67e5\u770b AI \u5e02\u573a\u5206\u6790</div>':'')+
    '</div>';
  }).join("");
  document.getElementById("profitGrid").innerHTML=html;
  // Bind override inputs (公用工程 + 其他辅料) — debounce 避免输入时重建 DOM 丢焦点
  let overrideTimer=null;
  document.querySelectorAll(".utility-input").forEach(input=>{
    input.addEventListener("input",()=>{
      const lineName=input.dataset.line;
      const type=input.dataset.type||"utility";
      const val=parseFloat(input.value);
      const overrides=type==="other"?otherCostOverrides:utilityOverrides;
      if(!isNaN(val)&&val>=0){
        overrides[lineName]=val;
        input.classList.add("overridden");
      }else{
        delete overrides[lineName];
        input.classList.remove("overridden");
      }
      // 更新当前卡片的利润显示（不重建 DOM）
      updateSingleProfitCard(lineName, input);
      // debounce 刷新图表和AI分析
      clearTimeout(overrideTimer);
      overrideTimer=setTimeout(()=>{
        renderSpreadBars();
        renderAIAnalysis();
      },400);
    });
    input.addEventListener("focus",()=>{
      input.select();
    });
  });
  // Bind profit card click for AI analysis
  initProfitCardClick();
}

// 更新单张利润卡片的利润数值（不重建 DOM，避免输入框失焦）
function updateSingleProfitCard(lineName, sourceInput){
  const line=profitLines.find(l=>l.name===lineName);
  if(!line) return;
  const r=calcProfit(line);
  const card=sourceInput.closest(".profit-card");
  if(!card) return;
  // 更新利润状态
  const status=r.profit>=line.threshold?"profit":"loss";
  const statusText=status==="profit"?"\u76c8\u5229":"\u4e8f\u635f";
  card.className="profit-card "+status;
  const pcStatus=card.querySelector(".pc-status");
  if(pcStatus) pcStatus.textContent=statusText;
  // 更新吨毛利
  const rows=card.querySelectorAll(".profit-calc .row");
  const lastRow=rows[rows.length-1];
  if(lastRow){
    const valSpan=lastRow.querySelector(".value");
    if(valSpan){
      valSpan.textContent=fmtMoney(r.profit)+" \u5143/\u5428";
      valSpan.style.color=status==="profit"?"var(--c-profit)":"var(--c-loss)";
    }
  }
  // 更新利润结果
  const prValue=card.querySelector(".pr-value");
  if(prValue) prValue.textContent=fmtMoney(r.profit);
  // 更新进度条
  const barFill=card.querySelector(".profit-bar-fill");
  if(barFill){
    const maxBar=5000;
    barFill.style.width=Math.min(Math.abs(r.profit)/maxBar*100,100)+"%";
  }
  // 更新预警阈值文字
  const thresholdDiv=card.querySelector(".profit-threshold");
  if(thresholdDiv){
    thresholdDiv.textContent="\u9884\u8b66\u9608\u503c: "+line.threshold+" \u5143/\u5428 \u00b7 \u5f53\u524d"+(r.profit<line.threshold?"\u5df2\u4f4e\u4e8e":"\u9ad8\u4e8e")+"\u9608\u503c"+(r.profit<line.threshold?" \u26a0":"");
  }
}

// ==================== RENDER SPREAD BARS ====================
function renderSpreadBars(){
  const maxSpread=4500;
  const html=profitLines.map(line=>{
    const r=calcProfit(line);
    const isProfit=r.profit>=line.threshold;
    const width=Math.min(Math.abs(r.profit)/maxSpread*100,100);
    const side=r.profit>=0?"left:50%":"right:50%";
    return '<div class="spread-bar-row">'+
      '<div class="spread-bar-label">'+line.spreadLabel+'</div>'+
      '<div class="spread-bar-track"><div class="spread-bar-zero"></div>'+
        '<div class="spread-bar-fill '+(isProfit?'profit':'loss')+'" style="'+side+';width:'+width+'%">'+fmtMoney(r.profit)+'</div>'+
      '</div>'+
      '<div class="spread-bar-value" style="color:'+(isProfit?'var(--c-profit)':'var(--c-loss)')+'">'+fmtMoney(r.profit)+'</div>'+
    '</div>';
  }).join("");
  document.getElementById("spreadBars").innerHTML=html;
}

// ==================== RENDER AI ANALYSIS ====================
function renderAIAnalysis(){
  const results=profitLines.map(line=>({name:line.name,...calcProfit(line),threshold:line.threshold,productPrice:line.productPrice}));
  const sorted=[...results].sort((a,b)=>b.profit-a.profit);
  const best=sorted[0];
  const worst=sorted[sorted.length-1];
  const lossCount=results.filter(r=>r.profit<r.threshold).length;
  const profitCount=results.length-lossCount;

  // Build loss section
  const lossItems=results.filter(r=>r.profit<r.threshold).sort((a,b)=>a.profit-b.profit);
  let lossHTML='';
  lossItems.forEach((r,i)=>{
    const rawCostPct=Math.round(r.rawCost/r.productPrice*100);
    lossHTML+='<p><strong>'+(i+1)+'. '+r.name+'\u5229\u6da6\u538b\u7f29</strong> \u2014 \u5428\u6bdb\u5229\u4ec5 <span class="loss-text">'+fmtMoney(r.profit)+'\u5143/\u5428</span>\uff0c\u4f4e\u4e8e\u9884\u8b66\u9608\u503c'+r.threshold+'\u5143\u3002\u539f\u6599\u6210\u672c\u5360\u552e\u4ef7\u7684'+rawCostPct+'%\uff0c\u6c22\u6c14\u6210\u672c'+Math.round(r.h2Cost)+'\u5143\u3001\u84b8\u6c7d\u6210\u672c'+Math.round(r.steamCost)+'\u5143\uff0c\u516c\u7528\u5de5\u7a0b\u5408\u8ba1'+Math.round(r.h2Cost+r.steamCost+r.powerCost)+'\u5143\u538b\u7f29\u5229\u6da6\u7a7a\u95f4\u3002</p>';
  });
  if(lossItems.length===0){
    lossHTML='<p>\u5f53\u524d\u6240\u6709\u4ea7\u54c1\u7ebf\u5747\u9ad8\u4e8e\u9884\u8b66\u9608\u503c\uff0c\u6682\u65e0\u4e8f\u635f\u9879\u3002</p>';
  }

  // Build profit section
  const profitItems=results.filter(r=>r.profit>=r.threshold).sort((a,b)=>b.profit-a.profit);
  let profitHTML='';
  profitItems.forEach((r,i)=>{
    profitHTML+='<p><strong>'+(i+1)+'. '+r.name+'</strong> \u2014 \u5428\u6bdb\u5229 <span class="profit-text">'+fmtMoney(r.profit)+'\u5143/\u5428</span>\uff0c\u9ad8\u4e8e\u9884\u8b66\u9608\u503c'+r.threshold+'\u5143\u3002\u539f\u6599\u6210\u672c'+Math.round(r.rawCost).toLocaleString()+'\u5143\uff0c\u516c\u7528\u5de5\u7a0b\u6210\u672c'+Math.round(r.h2Cost+r.steamCost+r.powerCost)+'\u5143\uff0c\u5229\u6da6\u7a7a\u95f4\u5145\u695a\u3002</p>';
  });
  if(profitItems.length===0){
    profitHTML='<p>\u5f53\u524d\u65e0\u4ea7\u54c1\u8fbe\u5230\u9884\u8b66\u9608\u503c\uff0c\u5168\u7ebf\u4e8f\u635f\u3002</p>';
  }

  // Build advice
  let adviceHTML='';
  adviceHTML+='<p><strong>\u4f18\u5148\u4fdd\u969c\uff1a</strong>'+best.name+'\uff08\u6bdb\u5229'+fmtMoney(best.profit)+'\u5143/\u5428\uff09\u6ee1\u8d1f\u8377\u8fd0\u884c\uff0c\u8d21\u732e\u6700\u5927\u5229\u6da6\u3002</p>';
  if(worst.profit<worst.threshold){
    adviceHTML+='<p><strong>\u9002\u5ea6\u63a7\u5236\uff1a</strong>'+worst.name+'\uff08\u6bdb\u5229'+fmtMoney(worst.profit)+'\u5143/\u5428\uff09\u5df2\u4f4e\u4e8e\u9884\u8b66\u9608\u503c\uff0c\u5efa\u8bae\u964d\u4f4e\u8d1f\u8377\u6216\u68c0\u4fee\u8c03\u6574\u3002</p>';
  }
  // Check hydrogen sensitivity
  const h2Sensitivity=profitLines.filter(l=>l.h2Qty>0).reduce((sum,l)=>sum+l.h2Qty,0);
  adviceHTML+='<p><strong>\u6c22\u6c14\u6210\u672c\u654f\u611f\u6027\uff1a</strong>\u6c22\u6c14\u4ef7\u683c\u6bcf\u53d8\u52a80.1\u5143/Nm3\uff0c\u5f71\u54cd\u5168\u90e8\u4ea7\u54c1\u7ebf\u5229\u6da6\u5408\u8ba1 '+Math.round(h2Sensitivity*0.1)+' \u5143/\u5428\u3002\u5f53\u524d\u6c22\u6c14\u4ef7\u683c'+costParams.h2.toFixed(2)+'\u5143/Nm3\u3002</p>';
  adviceHTML+='<p><strong>\u84b8\u6c7d\u6210\u672c\u654f\u611f\u6027\uff1a</strong>\u84b8\u6c7d\u4ef7\u683c\u6bcf\u53d8\u52a810\u5143/\u5428\uff0c\u5f71\u54cd\u5168\u90e8\u4ea7\u54c1\u7ebf\u5229\u6da6\u5408\u8ba1 '+Math.round(profitLines.reduce((s,l)=>s+l.steamQty,0)*10)+' \u5143/\u5428\u3002\u5f53\u524d\u84b8\u6c7d\u4ef7\u683c'+costParams.steam+'\u5143/\u5428\u3002</p>';

  document.getElementById("aiContent").innerHTML=
    '<div class="ai-section loss"><h4><span class="dot"></span> \u4e8f\u635f\u539f\u56e0\u5206\u6790</h4>'+lossHTML+'</div>'+
    '<div class="ai-section profit"><h4><span class="dot"></span> \u5229\u6da6\u4eae\u70b9</h4>'+profitHTML+'</div>'+
    '<div class="ai-section alert"><h4><span class="dot"></span> \u5173\u952e\u98ce\u9669\u9884\u8b66</h4>'+
      '<p><span class="warn-text">\u26a0 \u7eaf\u82ef\u6210\u672c\u98ce\u9669</span> \u2014 \u4e2d\u77f3\u53168\u670810\u65e5\u6302\u724c\u4ef7\u4e0a\u8c03250\u81f37600\u5143/\u5428\uff0c\u6e2f\u53e3\u5e93\u5b58\u964d\u81f34\u4e07\u5428\u4f4e\u4f4d\uff0c\u7eaf\u82ef\u77ed\u671f\u6709\u53cd\u5f39\u52a8\u529b\u3002\u82e5\u7eaf\u82ef\u56de\u5347\u81f38000+\uff0c\u5df1\u5185\u9170\u80fa\u5229\u6da6\u5c06\u4ece'+fmtMoney(best.profit)+'\u5143\u538b\u7f29\u81f3'+Math.round(best.profit-600)+'\u5143\u4ee5\u4e0b\uff0c\u5df1\u4e8c\u9178\u548c\u73af\u5df1\u916e\u5c06\u6df1\u5ea6\u4e8f\u635f\u3002</p>'+
      '<p><span class="warn-text">\u26a0 \u5df1\u4e8c\u9178\u65b0\u4ea7\u80fd\u51b2\u51fb</span> \u2014 \u6d59\u6c5f\u77f3\u531645\u4e07\u5428/\u5e74\u5df1\u4e8c\u9178\u9879\u76ee8\u6708\u5e95\u53ef\u80fd\u6295\u4ea7\uff0c\u5c06\u8fdb\u4e00\u6b65\u52a0\u5267\u4f9b\u7ed9\u8fc7\u5269\uff0c\u5df1\u4e8c\u9178\u4ef7\u683c\u6709\u7ee7\u7eed\u4e0b\u63a2\u98ce\u9669\u3002</p>'+
      '<p><span class="warn-text">\u26a0 \u786b\u78fa\u4ef7\u683c\u9ad8\u4f4d\u8fd0\u884c</span> \u2014 \u786b\u78fa\u57fa\u51c6\u4ef79436\u5143/\u5428\uff0c\u4e00\u5e74\u4f4d\u7f6e\u9ad8\u4f4d\uff08\u6700\u9ad811084\u3001\u5747\u503c5199\uff09\uff0c2\u5e74\u8d85\u6da8\u8b66\u6212\u3002\u751f\u610f\u793e\u5224\u65ad\u77ed\u671f\u9707\u8361\u504f\u7a7a\uff0c\u6709\u56de\u8c03\u538b\u529b\u3002\u786b\u9178\u65e5\u8dcc5.43%\u81f31620\u5143/\u5428\uff0c\u4f5c\u4e3a\u5df1\u5185\u9170\u80fa\u914d\u5957\u88c5\u7f6e\uff0c\u4ee5\u81ea\u7528\u5e73\u8861\u4e3a\u4e3b\u3002</p>'+
    '</div>'+
    '<div class="ai-section advice"><h4><span class="dot"></span> \u6392\u4ea7\u5efa\u8bae</h4>'+adviceHTML+
      '<div class="ai-metrics">'+
        '<div class="ai-metric"><div class="am-num profit-text" style="color:var(--c-profit)">'+fmtMoney(best.profit)+'</div><div class="am-label">\u6700\u9ad8\u6bdb\u5229('+best.name+')</div></div>'+
        '<div class="ai-metric"><div class="am-num loss-text" style="color:'+(worst.profit>=0?'var(--c-warn)':'var(--c-loss)')+'">'+fmtMoney(worst.profit)+'</div><div class="am-label">\u6700\u4f4e\u6bdb\u5229('+worst.name+')</div></div>'+
        '<div class="ai-metric"><div class="am-num" style="color:var(--c-warn)">'+lossCount+'/'+results.length+'</div><div class="am-label">\u4f4e\u4e8e\u9884\u8b66\u9608\u503c\u4ea7\u54c1\u6570</div></div>'+
      '</div>'+
    '</div>';
}

// ==================== TREND MODAL ====================
function showTrendModal(item){
  const history=generateHistory(item);
  const prices=history.map(d=>d.price);
  const minP=Math.min(...prices);
  const maxP=Math.max(...prices);
  const avgP=Math.round(prices.reduce((a,b)=>a+b,0)/prices.length);
  const arrow=item.trend==="up"?"\u25B2":item.trend==="down"?"\u25BC":"\u2014";
  const changeColor=item.trend==="up"?"var(--c-up)":item.trend==="down"?"var(--c-down)":"var(--c-flat)";

  let alertHTML="";
  if(item.alert){
    const a=item.alert;
    let icon="\u26a0";
    if(a.type==="surge")icon="\u25B2";
    else if(a.type==="crash")icon="\u25BC";
    let tagsHTML="";
    if(a.tags&&a.tags.length>0){
      tagsHTML='<div class="modal-alert-tags">'+a.tags.map(t=>'<span class="modal-alert-tag">'+t+'</span>').join("")+'</div>';
    }
    alertHTML='<div class="modal-alert '+a.type+'">'+
      '<div class="modal-alert-head"><span class="modal-alert-icon">'+icon+'</span><span class="modal-alert-title">'+a.title+'</span></div>'+
      '<div class="modal-alert-body">'+a.body+'</div>'+
      tagsHTML+
    '</div>';
  }

  document.getElementById("modalContent").innerHTML=
    '<div class="modal-head">'+
      '<div><div class="modal-title">'+item.name+'</div><div class="modal-formula">'+item.formula+'</div></div>'+
      '<div style="text-align:right"><div class="modal-price">'+item.price.toLocaleString()+'<span>'+item.unit+'</span></div>'+
      '<div class="modal-change" style="color:'+changeColor+'">'+arrow+' '+(item.change>0?"+":"")+item.change+' ('+(item.changePct>0?"+":"")+item.changePct+'%)</div></div>'+
    '</div>'+
    alertHTML+
    '<div class="modal-chart-wrap"><canvas class="modal-chart" id="trendCanvas"></canvas></div>'+
    '<div class="modal-stats">'+
      '<div class="modal-stat"><div class="ms-val" style="color:var(--c-up)">'+maxP.toLocaleString()+'</div><div class="ms-lbl">30\u65e5\u6700\u9ad8</div></div>'+
      '<div class="modal-stat"><div class="ms-val" style="color:var(--c-down)">'+minP.toLocaleString()+'</div><div class="ms-lbl">30\u65e5\u6700\u4f4e</div></div>'+
      '<div class="modal-stat"><div class="ms-val" style="color:var(--c-accent)">'+avgP.toLocaleString()+'</div><div class="ms-lbl">30\u65e5\u5747\u503c</div></div>'+
      '<div class="modal-stat"><div class="ms-val" style="color:'+changeColor+'">'+(item.weekPct>0?"+":"")+item.weekPct+'%</div><div class="ms-lbl">\u5468\u6da8\u8dcc</div></div>'+
    '</div>';
  document.getElementById("modalOverlay").classList.add("active");
  // Draw chart after DOM ready
  setTimeout(()=>drawTrendChart(document.getElementById("trendCanvas"),history,item.trend),50);
}

function drawTrendChart(canvas,data,trend){
  if(!canvas) return;
  const ctx=canvas.getContext("2d");
  const dpr=window.devicePixelRatio||1;
  const w=canvas.clientWidth;
  const h=canvas.clientHeight;
  canvas.width=w*dpr;
  canvas.height=h*dpr;
  ctx.scale(dpr,dpr);
  ctx.clearRect(0,0,w,h);

  const pad={top:20,right:20,bottom:28,left:52};
  const cw=w-pad.left-pad.right;
  const ch=h-pad.top-pad.bottom;
  const prices=data.map(d=>d.price);
  const minP=Math.min(...prices);
  const maxP=Math.max(...prices);
  const range=Math.max(maxP-minP,1);
  const yMin=minP-range*0.15;
  const yMax=maxP+range*0.15;

  // Grid
  ctx.strokeStyle="#2D3D50";
  ctx.lineWidth=1;
  ctx.fillStyle="#5A6577";
  ctx.font="10px monospace";
  ctx.textAlign="right";
  for(let i=0;i<=4;i++){
    const y=pad.top+(ch/4)*i;
    ctx.beginPath();
    ctx.moveTo(pad.left,y);
    ctx.lineTo(pad.left+cw,y);
    ctx.stroke();
    const val=yMax-((yMax-yMin)/4)*i;
    ctx.fillText(Math.round(val).toLocaleString(),pad.left-6,y+3);
  }

  // Area fill
  const lineColor=trend==="up"?"#E03935":trend==="down"?"#16A34A":"#8895A5";
  ctx.beginPath();
  data.forEach((d,i)=>{
    const x=pad.left+(cw/(data.length-1))*i;
    const y=pad.top+ch-((d.price-yMin)/(yMax-yMin))*ch;
    if(i===0) ctx.moveTo(x,y);
    else ctx.lineTo(x,y);
  });
  ctx.lineTo(pad.left+cw,pad.top+ch);
  ctx.lineTo(pad.left,pad.top+ch);
  ctx.closePath();
  const grad=ctx.createLinearGradient(0,pad.top,0,pad.top+ch);
  const fillColor=trend==="up"?"rgba(224,57,53,0.12)":trend==="down"?"rgba(22,163,74,0.12)":"rgba(136,149,165,0.12)";
  grad.addColorStop(0,fillColor);
  grad.addColorStop(1,"rgba(0,0,0,0)");
  ctx.fillStyle=grad;
  ctx.fill();

  // Line
  ctx.strokeStyle=lineColor;
  ctx.lineWidth=2;
  ctx.lineJoin="round";
  ctx.beginPath();
  data.forEach((d,i)=>{
    const x=pad.left+(cw/(data.length-1))*i;
    const y=pad.top+ch-((d.price-yMin)/(yMax-yMin))*ch;
    if(i===0) ctx.moveTo(x,y);
    else ctx.lineTo(x,y);
  });
  ctx.stroke();

  // Last point
  const lastX=pad.left+cw;
  const lastY=pad.top+ch-((data[data.length-1].price-yMin)/(yMax-yMin))*ch;
  ctx.fillStyle=lineColor;
  ctx.beginPath();
  ctx.arc(lastX,lastY,5,0,Math.PI*2);
  ctx.fill();
  ctx.strokeStyle="#fff";
  ctx.lineWidth=2;
  ctx.stroke();

  // X labels
  ctx.fillStyle="#5A6577";
  ctx.font="10px sans-serif";
  ctx.textAlign="center";
  for(let i=0;i<data.length;i+=7){
    const x=pad.left+(cw/(data.length-1))*i;
    ctx.fillText(data[i].date,x,h-8);
  }
}

// ==================== COST INPUT HANDLING ====================
function initCostInputs(){
  const h2Input=document.getElementById("costH2");
  const steamInput=document.getElementById("costSteam");
  const powerInput=document.getElementById("costPower");
  h2Input.value=costParams.h2;
  steamInput.value=costParams.steam;
  powerInput.value=costParams.power;

  function onCostChange(){
    costParams.h2=parseFloat(h2Input.value)||0;
    costParams.steam=parseFloat(steamInput.value)||0;
    costParams.power=parseFloat(powerInput.value)||0;
    localStorage.setItem('th_cost_h2',costParams.h2);
    localStorage.setItem('th_cost_steam',costParams.steam);
    localStorage.setItem('th_cost_power',costParams.power);
    renderProfitCards();
    renderSpreadBars();
    renderAIAnalysis();
  }
  h2Input.addEventListener("input",onCostChange);
  steamInput.addEventListener("input",onCostChange);
  powerInput.addEventListener("input",onCostChange);

  document.getElementById("costReset").addEventListener("click",()=>{
    costParams={...defaultCosts};
    h2Input.value=defaultCosts.h2;
    steamInput.value=defaultCosts.steam;
    powerInput.value=defaultCosts.power;
    localStorage.removeItem('th_cost_h2');
    localStorage.removeItem('th_cost_steam');
    localStorage.removeItem('th_cost_power');
    renderProfitCards();
    renderSpreadBars();
    renderAIAnalysis();
  });
}

// ==================== CARD CLICK -> MODAL ====================
function initCardClick(){
  const allItems=[...products,...rawMaterials,...intermediates];
  document.querySelectorAll(".price-card").forEach(card=>{
    card.addEventListener("click",()=>{
      const key=card.dataset.key;
      const item=allItems.find(i=>i.name===key);
      if(item) showTrendModal(item);
    });
  });
}

// ==================== PROFIT CARD CLICK -> AI ANALYSIS MODAL ====================
function showAnalysisModal(line){
  const r=calcProfit(line);
  const a=line.analysis;
  if(!a) return;
  const status=r.profit>=line.threshold?"profit":"loss";
  const statusText=status==="profit"?"\u76c8\u5229":"\u4e8f\u635f";
  const statusColor=status==="profit"?"var(--c-profit)":"var(--c-loss)";
  const rawPct=Math.round(r.rawCost/r.profit>0?r.rawCost/line.productPrice*100:0);
  const utilPct=Math.round(r.utilityTotal/line.productPrice*100);

  let reasonsHTML="";
  a.reasons.forEach(reason=>{
    reasonsHTML+='<li>'+reason+'</li>';
  });

  let tagsHTML="";
  a.tags.forEach(tag=>{
    tagsHTML+='<span class="analysis-tag">'+tag+'</span>';
  });

  document.getElementById("modalContent").innerHTML=
    '<div class="analysis-headline">'+a.headline+'</div>'+
    '<div class="analysis-sub">'+line.name+' \u00b7 '+line.plant.capacity+' \u00b7 '+line.plant.unitName+'</div>'+
    '<div class="analysis-section-title"><span class="ast-dot"></span>\u6838\u5fc3\u539f\u56e0\u5206\u6790</div>'+
    '<ul class="analysis-reason-list">'+reasonsHTML+'</ul>'+
    '<div class="analysis-section-title"><span class="ast-dot" style="background:var(--c-warn)"></span>\u540e\u7eed\u5c55\u671b</div>'+
    '<div class="analysis-outlook">'+a.outlook+'</div>'+
    '<div class="analysis-tags">'+tagsHTML+'</div>'+
    '<div class="analysis-metrics">'+
      '<div class="analysis-metric"><div class="am-val" style="color:'+statusColor+'">'+fmtMoney(r.profit)+'</div><div class="am-lbl">\u5428\u6bdb\u5229(\u5143/\u5428)</div></div>'+
      '<div class="analysis-metric"><div class="am-val" style="color:var(--c-warn)">'+rawPct+'%</div><div class="am-lbl">\u539f\u6599\u5360\u552e\u4ef7\u6bd4</div></div>'+
      '<div class="analysis-metric"><div class="am-val" style="color:var(--c-accent)">'+utilPct+'%</div><div class="am-lbl">\u516c\u7528\u5de5\u7a0b\u5360\u552e\u4ef7\u6bd4</div></div>'+
    '</div>';

  document.getElementById("modalOverlay").classList.add("active");
}

function initProfitCardClick(){
  document.querySelectorAll(".profit-card").forEach(card=>{
    card.addEventListener("click",e=>{
      // \u4e0d\u54cd\u5e94\u8f93\u5165\u6846\u70b9\u51fb
      if(e.target.tagName==="INPUT") return;
      const name=card.querySelector(".profit-name");
      if(!name) return;
      const line=profitLines.find(l=>l.name===name.textContent);
      if(line&&line.analysis) showAnalysisModal(line);
    });
  });
}

// ==================== TAB SWITCH ====================
function initTabs(){
  document.querySelector(".tab-bar").addEventListener("click",e=>{
    if(e.target.classList.contains("tab-btn")){
      document.querySelectorAll(".tab-btn").forEach(b=>b.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach(c=>c.classList.remove("active"));
      e.target.classList.add("active");
      document.getElementById("tab-"+e.target.dataset.tab).classList.add("active");
    }
  });
}

// ==================== MODAL CLOSE ====================
function initModalClose(){
  document.getElementById("modalClose").addEventListener("click",()=>{
    document.getElementById("modalOverlay").classList.remove("active");
  });
  document.getElementById("modalOverlay").addEventListener("click",e=>{
    if(e.target===document.getElementById("modalOverlay")){
      document.getElementById("modalOverlay").classList.remove("active");
    }
  });
}

// ==================== DATE ====================
function setDate(){
  const now=new Date();
  document.getElementById("topDate").textContent=now.getFullYear()+"\u5e74"+(now.getMonth()+1)+"\u6708"+now.getDate()+"\u65e5";
}

// ==================== UPDATE PRICE MODAL ====================
function initUpdatePrice(){
  const overlay=document.getElementById("updateOverlay");
  const btn=document.getElementById("updatePriceBtn");
  const closeBtn=document.getElementById("updateClose");
  const cancelBtn=document.getElementById("updateCancel");
  const saveBtn=document.getElementById("updateSave");
  const body=document.getElementById("updateBody");

  // Build update form
  function buildForm(){
    const groups=[
      {title:"\u4ea7\u54c1",items:products},
      {title:"\u539f\u6599",items:rawMaterials},
      {title:"\u4e2d\u95f4\u4f53",items:intermediates},
    ];
    let html="";
    groups.forEach(g=>{
      html+='<div class="update-group-title">'+g.title+' ('+g.items.length+'\u79cd)</div>';
      g.items.forEach(item=>{
        html+='<div class="update-row">'+
          '<div class="update-row-label">'+item.name+'</div>'+
          '<input class="update-row-input" type="number" step="0.01" min="0" data-name="'+item.name+'" value="'+item.price+'" data-prev="'+item.price+'">'+
          '<div class="update-row-prev">'+item.price.toLocaleString()+'</div>'+
          '<div class="update-row-change" data-name="'+item.name+'"></div>'+
        '</div>';
      });
    });
    body.innerHTML=html;

    // Listen for changes to show diff
    body.querySelectorAll(".update-row-input").forEach(input=>{
      input.addEventListener("input",()=>{
        const prev=parseFloat(input.dataset.prev);
        const val=parseFloat(input.value)||0;
        const diff=val-prev;
        const changeEl=body.querySelector('.update-row-change[data-name="'+input.dataset.name+'"]');
        if(diff>0){
          changeEl.textContent="+"+Math.round(diff*100)/100;
          changeEl.style.color="var(--c-up)";
        }else if(diff<0){
          changeEl.textContent=Math.round(diff*100)/100;
          changeEl.style.color="var(--c-down)";
        }else{
          changeEl.textContent="\u2014";
          changeEl.style.color="var(--c-text-dim)";
        }
      });
    });
  }

  // Open
  btn.addEventListener("click",()=>{
    buildForm();
    overlay.classList.add("active");
  });

  // Close
  function close(){overlay.classList.remove("active")}
  closeBtn.addEventListener("click",close);
  cancelBtn.addEventListener("click",close);
  overlay.addEventListener("click",e=>{if(e.target===overlay)close()});

  // Save
  saveBtn.addEventListener("click",()=>{
    const inputs=body.querySelectorAll(".update-row-input");
    const allItems=[...products,...rawMaterials,...intermediates];
    inputs.forEach(input=>{
      const name=input.dataset.name;
      const newVal=parseFloat(input.value)||0;
      const item=allItems.find(i=>i.name===name);
      if(item){
        const oldPrice=item.price;
        const change=Math.round((newVal-oldPrice)*100)/100;
        item.price=newVal;
        item.change=change;
        if(oldPrice>0){
          item.changePct=Math.round(change/oldPrice*10000)/100;
        }
        if(change>0)item.trend="up";
        else if(change<0)item.trend="down";
        else item.trend="flat";
      }
    });

    // Update profit line prices that reference market data
    profitLines.forEach(line=>{
      // Match product price to market data
      const productMatch=allItems.find(i=>i.name===line.name.replace("(外售)",""));
      if(productMatch) line.productPrice=productMatch.price;
      // Update raw material prices in profit lines
      line.rawMaterials.forEach(rm=>{
        const match=allItems.find(i=>i.name===rm.label);
        if(match) rm.price=match.price;
      });
    });

    // Re-render everything
    renderAllPriceCards();
    initCardClick();
    renderProfitCards();
    renderSpreadBars();
    renderAIAnalysis();
    setDate();
    close();

    // Show toast
    const toast=document.getElementById("updateToast");
    toast.classList.add("show");
    setTimeout(()=>toast.classList.remove("show"),2500);
  });
}

// ==================== INIT ====================
async function init(){
  const ok = await loadData();
  if(ok){
    setDate();
    renderAllPriceCards();
    renderPeerPlants();
    renderProfitCards();
    renderSpreadBars();
    renderAIAnalysis();
    initCostInputs();
    initCardClick();
    initTabs();
    initModalClose();
    initUpdatePrice();
  }else{
    document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;color:#8895A5;font-size:18px">\u26a0 \u6570\u636e\u52a0\u8f7d\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u5237\u65b0\u91cd\u8bd5</div>';
  }
}
init();
