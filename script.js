/* 宇宙混戰狼人殺 V6
 * 本版為可執行的回合制核心原型：房間/身分分發、夜晚行動框架、投票加賽、
 * 戀人殉情、招募優先序、陣營勝利判定與 AI 基礎行為。
 * 複雜職業的特殊判定集中在 resolveNight()/checkVictory()，可持續擴充。
 */
"use strict";

const MAIN_ROLES = [
 ["預言家","好人","每晚查驗一人；查驗狼人、邪教、叛亂軍陣營時，直接顯示目標當下主職身分；其他陣營顯示陣營。"],
 ["女巫","好人","解藥與毒藥各一次；救人可得知兇手陣營。"],
 ["守衛","好人","每晚守護一人，不可守自己；同一目標不可連續守超過一次。"],
 ["市長","好人","投票權重 3。"],["獵人","好人","非毒殺、非殉情死亡時可開槍。"],
 ["警長","好人","標記後一晚可選擇處決；每晚標記與殺人擇一。"],
 ["禁衛軍","好人","免疫招募、洗腦、覆蓋；預言家死亡後可查主副職陣營。"],
 ["告密者","好人","第 5 夜公開敵方名單；被殺公布兇手。"],
 ["愛心使","好人","可招安一次，加入好人陣營；戀人身分另行保留。"],
 ["平民","好人","沒有技能。"],["狼人","狼人","狼人共同擊殺；前三夜有一發強化彈。"],
 ["狼預","狼人","每晚查驗一人目前陣營。"],["教父","狼人","全場可招募兩名叛徒。"],
 ["惡靈騎士","狼人","免疫毒藥、賭殺、一般子彈；主動攻擊者遭反噬。"],
 ["職業抹除者","狼人","指定一人，令其主職技能當晚失效。"],
 ["黑道大哥","黑道","Day 3 前招募軍火商及打手；總計最多三名黑道幫手。"],
 ["邪教教主","邪教","每兩晚洗腦一人；教主與大祭司都死亡後解除洗腦。"],
 ["大祭司","邪教","教主遭擊殺可替死一次；教主被投票出局則頂替身分。"],
 ["革命殺手","叛亂軍","每晚偵查；每兩晚暗殺強勢或有擊殺能力者。"],
 ["自爆狂","叛亂軍","每晚標記；累積至少兩人可引爆，三標記按強勢數判定。"],
 ["暗夜殺手","中立","雙數存活人數可殺人；累積擊殺兩人後可招募同夥。"],
 ["狙擊手","中立","每兩晚獲一發子彈，最多兩發，可同夜連射。"],
 ["豺狼","中立","死亡後跟班可繼承，最多四代。"],
 ["狗頭人","中立","第一夜標記，第二夜擊殺；勝利目標為所有狼人。"],
 ["怨靈","中立","不能被擊殺但可被投票處決；最後存活可勝。"],
 ["小丑","中立","死亡兩次獲勝。"],["月老","中立","首夜指定戀人；戀人遭擊殺時替擋並同死；自身死亡後戀人每兩夜可殺人。"],
 ["邱比特","中立","首夜指定戀人；戀人第一次死亡可擋一次。"],
 ["賭狗","中立","Day 3 結束前下注陣營；該陣營勝利可搶勝。"],
 ["薛丁格的貓","中立","被擊殺時複製最後攻擊者主職與陣營。"]
];
const SUB_ROLES = [
 ["議員","好人","投票權重 2。"],["白癡","好人","查驗顯示主副職皆為白癡。"],["捕快","好人","每三夜可擊殺一人；殺混合陣營連帶死亡，殺純好人自己死亡。"],
 ["平民(副)","好人","沒有技能。"],["狼人(副)","狼人","加入狼人共同擊殺。"],["內奸","黑道","知道黑道大哥；副職陣營優先。"],
 ["行刑者","中立","系統指定目標，目標被投票處決即獨立勝利。"],["魅魔","中立","產生一組戀人；副職陣營優先。"]
];
const EXTRA_ROLES = [
 ["好人賭怪","好人","只能猜好人陣營玩家的主職業；最多猜兩次。"],["狼人賭怪","狼人","只能猜狼人陣營玩家的主職業；最多猜兩次。"],
 ["獨立賭怪","中立","只能猜中立陣營玩家的主職業；最多猜兩次。"],["換票師","好人","可交換兩名玩家的票數。"],
 ["戀人","特殊","主持人指定的戀人連結，不改變職業與陣營。"],["軍火商","黑道","每局可給黑道成員一件防彈衣或一發強化彈。"],["打手","黑道","代表黑道執行夜晚擊殺。"],["同夥","中立","暗夜殺手招募後覆蓋而來。"],["跟班","中立","豺狼的傳承候選人。"]
];
const ROLE_MAP = Object.fromEntries([...MAIN_ROLES,...SUB_ROLES,...EXTRA_ROLES].map(x=>[x[0],{faction:x[1],desc:x[2]}]));
const FACTIONS = ["好人","狼人","黑道","邪教","中立","叛亂軍"];
const PRIORITY = ["邪教","暗夜","黑道","豺狼","教父"];
const STRONG = new Set(["教父","惡靈騎士","職業抹除者","狼預","豺狼","狗頭人","狙擊手","暗夜殺手","同夥","跟班","邪教教主","大祭司","黑道大哥"]);
let peer=null, myPeerId="", roomId="", isHost=false, mode="hybrid", hostConn=null, connections=[];
let localPlayerId=null, state=null, testBots=[];
let selectedMode="hybrid";
let autoHost=false, autoHostTimer=null, speechEnabled=true;

const $=id=>document.getElementById(id);
const show=(id,on=true)=>$(id)?.classList.toggle("hidden",!on);
function toast(s){const t=$("toast");t.textContent=s;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2200)}
function speakHost(text){
 if(!speechEnabled||!("speechSynthesis" in window)||!("SpeechSynthesisUtterance" in window))return;
 try{speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(String(text).replace(/[🎙️🌙☀️🗳️🏆💀🔮🐺🕵️]/gu,""));
  u.lang="zh-TW";u.rate=0.94;u.pitch=1.0;
  const voices=speechSynthesis.getVoices();const zh=voices.find(v=>/zh-TW|中文|Chinese/i.test(v.lang+" "+v.name));if(zh)u.voice=zh;
  speechSynthesis.speak(u);
 }catch(e){console.warn("語音播報不可用",e)}
}
function log(s){if(!$("log-content"))return;const d=document.createElement("div");d.className="log-line";d.textContent=s;$("log-content").append(d);$("log-content").scrollTop=$("log-content").scrollHeight;
 if(/遊戲開始|第 \d+ 夜開始|第 \d+ 天開始|開始投票|平票|死亡|勝利判定|進入加賽|遊戲結束/.test(s))speakHost(s);
}
function factionOf(role){return ROLE_MAP[role]?.faction||"好人"}
function safeName(p){return p.name.replace(/[<>]/g,"")}
function alive(){return state.players.filter(p=>p.alive)}
function player(id){return state.players.find(p=>p.id===id)}
function roleOptions(rows){return rows.map(r=>`<option value="${r[0]}">${r[0]}</option>`).join("")}
function init(){
  buildPools();buildGuide();wire();
  if(window.Peer){peer=new Peer();peer.on("open",id=>{myPeerId=id;$("my-peer-id").textContent=id});
    peer.on("connection",c=>{if(!isHost){c.close();return}connections.push(c);c.on("data",d=>handleHostMessage(c,d));c.on("close",()=>{connections=connections.filter(x=>x!==c);refreshLobby()})});
    peer.on("error",e=>{log("PeerJS："+e.type);toast("連線服務暫時不可用")});
  }else $("my-peer-id").textContent="PeerJS 未載入";
  const q=new URLSearchParams(location.search).get("room");if(q)$("join-room-id").value=q;
}
function wire(){
 document.querySelectorAll(".mode-card").forEach(b=>b.onclick=()=>{selectedMode=b.dataset.mode;document.querySelectorAll(".mode-card").forEach(x=>x.classList.toggle("selected",x===b))});
 $("btn-show-host-config").onclick=()=>{mode=selectedMode;if(mode==="test"){enterTest()}else{show("connection-area",false);show("host-config-area")}};
 $("btn-back-setup").onclick=()=>{show("host-config-area",false);show("connection-area")};
 $("btn-create-room").onclick=createRoom;
 $("btn-join-room").onclick=joinRoom;
 $("btn-host-start").onclick=startGame;
 $("btn-copy-share").onclick=()=>{const u=location.origin+location.pathname+"?room="+roomId;navigator.clipboard?.writeText(u).then(()=>toast("邀請連結已複製")).catch(()=>prompt("複製此連結",u))};
 $("btn-open-guide").onclick=()=>show("guide-modal");$("btn-lobby-guide").onclick=()=>show("guide-modal");$("btn-close-guide").onclick=()=>show("guide-modal",false);
 $("btn-start-test").onclick=startTest;$("btn-add-test-bot").onclick=()=>{testBots.push({main:"平民",sub:"無",extra:"無"});renderTestBots()};
 $("btn-remove-test-bot").onclick=()=>{testBots.pop();renderTestBots()};
 $("btn-next-phase").onclick=nextPhase;$("btn-restart").onclick=()=>location.reload();
 $("auto-host-toggle").onchange=e=>{if(e.target.checked){startAutoHost()}else{stopAutoHost()}};
 $("ai-voice-toggle").onchange=e=>{speechEnabled=e.target.checked;if(!speechEnabled&&window.speechSynthesis)speechSynthesis.cancel()};
 $("btn-stop-auto").onclick=()=>{stopAutoHost();$("auto-host-toggle").checked=false;toast("已暫停自動主持")};
}

const FACTION_CLASS={"好人":"faction-good","狼人":"faction-wolf","中立":"faction-neutral","叛亂軍":"faction-rebel","邪教":"faction-cult","黑道":"faction-mafia","特殊":"faction-special"};
const ROLE_DETAILS={
"預言家":"每晚查驗一名玩家。目標屬狼人、邪教或叛亂軍陣營時，直接顯示其當下主職身分；其他陣營顯示當下陣營。若目標已轉化，以查驗當下的陣營判定。",
"女巫":"整場各有一瓶解藥與毒藥。解藥可救回當晚受害者，使用後得知兇手陣營；毒藥可指定一人毒殺。每瓶藥只能使用一次。",
"守衛":"每晚守護一名玩家，不可守自己。可連續兩晚守同一人一次，之後必須更換目標。成功守護可擋下所有種類的當夜擊殺。",
"市長":"投票權重為 3 票。死亡後不再提供額外票數。",
"獵人":"死亡時可開槍帶走一名玩家；被毒殺或因戀人殉情時不能開槍。",
"警長":"每晚可選擇標記或處決，兩種行動不能同晚使用。標記後可在下一晚選擇是否處決；目標若為混合陣營，雙方同死；敵對陣營目標死亡；純好人目標則不發生效果。",
"禁衛軍":"免疫控制效果。任何招募、洗腦或職業覆蓋對其無效，嘗試者浪費該次行動。預言家死亡後，禁衛軍可查驗目標的主職與副職陣營。仍可受到戀愛連結影響。",
"告密者":"第 5 夜由主持人公布敵方名單（不包含叛亂軍）。若告密者被殺，主持人公布擊殺者。",
"愛心使":"每局可招安一名玩家，使其加入好人陣營，不受原主職、副職及附加職陣營影響；表面戀人關係保留。",
"平民":"沒有主動技能。依靠討論、推理與投票找出敵對陣營。",
"狼人":"每晚與狼人隊伍共同選擇一名玩家擊殺。前三夜狼人陣營共有一發強化子彈。",
"狼預":"每晚查驗一名玩家的當下陣營，提供狼人陣營的情報。",
"教父":"全場最多招募兩名叛徒加入狼人陣營。招募受到禁衛軍等免疫規則限制，並依招募優先序結算。",
"惡靈騎士":"免疫毒藥、賭怪擊殺及一般子彈。對其發動主動攻擊者會遭反噬死亡；強化子彈可突破其防護且不觸發反噬。",
"職業抹除者":"每晚指定一名玩家，使其主職技能失效一晚。技能失效不等同於死亡或陣營轉化。",
"黑道大哥":"必須在第 3 天前招募到一名軍火商與一名打手。最多招募三名黑道幫手：一名軍火商、兩名打手；第一名打手死亡後才能招募第二名。若軍火商與打手全滅，大哥可改為每晚擊殺。大哥死亡後，幫手最多再存活一夜。",
"邪教教主":"每兩晚可洗腦一名玩家，使其加入邪教陣營且本人不知情。教主與大祭司都死亡後，所有被洗腦者恢復原陣營。",
"大祭司":"可替邪教教主承受一次死亡。若教主被投票出局，大祭司接替教主身分；教主與大祭司都死亡後，洗腦者恢復原陣營。",
"革命殺手":"每晚可偵查一名玩家是否為強勢職業或具有擊殺能力；每兩晚可暗殺一名符合條件的目標。若暗殺錯誤，下一夜只能偵查。",
"自爆狂":"每晚可標記一名玩家，累積至少兩個標記後可引爆。若標記三名強勢職業則叛亂軍立即獲勝；兩名強勢職業則隨機再擊殺 1 至 2 人；只有一名強勢職業則自爆狂死亡。",
"暗夜殺手":"存活玩家人數為雙數時可擊殺一人。累積擊殺兩人後可招募一名同夥並覆蓋其職業；招募當晚不能擊殺。同夥只有在存活人數為單數時才能擊殺；同夥擊殺後隔天會留下公開痕跡。",
"狙擊手":"每兩夜獲得一發子彈，最多累積兩發。可在同一夜使用多發；隔天早上公布該夜射擊數量。",
"豺狼":"死亡後由跟班繼承角色與能力，最多傳承四代；跟班的具體繼承資格由主持人依局規指定。",
"狗頭人":"不會被狼人陣營發現。第一夜標記一名玩家，第二夜使該目標死亡；勝利條件為擊殺所有狼人。",
"怨靈":"不會被任何擊殺技能殺死，只能透過投票出局；無法被查驗。成為最後存活者時獲勝，並可依規則竊取部分陣營勝利；若成為戀人或被洗腦，優先依該陣營勝利。",
"小丑":"沒有主動技能。累計死亡兩次即達成個人勝利；怨靈不能竊取小丑勝利。",
"月老":"第一夜指定一組戀人。戀人遭遇擊殺時，月老可替其擋下該次死亡並與戀人同死；月老死亡後，戀人每兩夜可共同擊殺一人。月老存活至遊戲結束可獲勝，部分特殊職業不可被竊勝。",
"邱比特":"第一夜指定一組戀人。戀人第一次死亡（包含投票）可擋下一次攻擊；若再次遭受非投票死亡，可再擋最後一次攻擊。邱比特存活至結束可獲勝，部分特殊職業不可被竊勝。",
"賭狗":"必須在第 3 天結束前下注一個陣營。下注陣營獲勝時，即使賭狗已死亡仍可獲勝；不可下注小丑、怨靈或薛丁格的貓，且怨靈不能竊取賭狗勝利。",
"薛丁格的貓":"被擊殺時，複製最後一名攻擊者的主職業與陣營；具體觸發以造成死亡的最後攻擊者為準。",
"議員":"投票權重為 2 票，可與市長的票數效果疊加。",
"白癡":"查驗結果會將主職與副職顯示為白癡，依此職業規則隱藏原本職業資訊。",
"捕快":"每三夜可擊殺一名玩家。擊殺混合陣營目標時依混合陣營規則連帶處理；擊殺敵對陣營有效，若擊殺純好人則捕快自己死亡。",
"平民(副)":"沒有副職技能。",
"狼人(副)":"加入狼人隊伍的夜間共同擊殺行動。",
"內奸":"知道黑道大哥身分。主副職陣營衝突時，內奸副職陣營優先計算勝利。",
"行刑者":"系統為其指定一名目標；目標被投票處決時，行刑者獲得獨立勝利。每名行刑者各自計算。",
"魅魔":"建立一組戀人關係；存活至遊戲結束可竊取部分陣營勝利。副職陣營優先計算勝利。",
"好人賭怪":"屬好人陣營的賭怪附加職。猜測目標的主職身分，最多可猜兩次；猜錯自己死亡，猜中目標死亡。成功猜中後若遭遇惡靈騎士，賭怪會被反噬。",
"狼人賭怪":"屬狼人陣營的賭怪附加職。猜測目標的主職身分，最多可猜兩次；猜錯自己死亡，猜中目標死亡。成功猜中後若遭遇惡靈騎士，賭怪會被反噬。",
"獨立賭怪":"屬中立陣營的賭怪附加職。猜測目標的主職身分，最多可猜兩次；猜錯自己死亡，猜中目標死亡。成功猜中後若遭遇惡靈騎士，賭怪會被反噬。",
"換票師":"可指定兩名玩家交換其投票權重或票數，實際交換時機由主持人依本局設定處理。",
"戀人":"附加身分，不改變主職與副職。最多可建立四組戀人連結；同一玩家可同時出現在多組連結中，一方死亡時另一方立即殉情。",
"軍火商":"可向一名黑道成員提供一件裝備：一件防彈衣或一發強化子彈。全局各一件；防彈衣可擋所有攻擊（含強化彈），強化子彈可破防彈衣並擊殺惡靈騎士且不反噬。",
"打手":"負責執行黑道陣營的夜間擊殺。若黑道大哥死亡，依黑道幫手延遲死亡規則處理。",
"同夥":"由暗夜殺手招募並覆蓋職業而來。招募當晚不能擊殺；只在存活人數為單數時能擊殺，擊殺後次日留下公開痕跡。",
"跟班":"豺狼的傳承候選者；豺狼死亡後依主持人設定繼承其職業與能力，最多四代。"
};
const RULE_OVERVIEW = `
<section class="rules-overview">
<h3>一、基本流程與勝負</h3>
<ul>
<li>每局分為夜晚行動、白天討論、投票與平票加賽；票數最高者出局，平票則進入加賽。</li>
<li>各陣營依自己的勝利條件判定。好人需找出並消滅所有敵對陣營；狼人需擊殺其他所有玩家；邪教人數達全場存活人數一半時獲勝。</li>
<li>雙陣營主職／副職玩家，任一所屬陣營獲勝即可勝利；內奸與魅魔的副職陣營優先。</li>
<li>查驗：預言家查狼人、邪教、叛亂軍時直接顯示當下主職身分；其他陣營顯示陣營。狼預查原始陣營；黑道大哥固定顯示好人，黑道打手與軍火商顯示黑道。未配置副職的玩家顯示「陣營＋白癡」格式。</li>
<li>轉化會覆蓋主職、副職與陣營，並移除附加職；戀人與賭狗附加身分保留。禁衛軍免疫招募、洗腦與覆蓋，但不免疫戀愛。</li>
</ul>
<h3>二、戀人與特殊勝利</h3>
<ul>
<li>全場最多四組戀人連結，同一玩家可同時屬於多組；一方死亡時另一方立即殉情，視為技能死亡。</li>
<li>跨陣營戀人若兩人都活到最後，雙方皆可獲勝；戀人陣營人數必須大於場上其他陣營人數，才可依戀人條件取得勝利。</li>
<li>房主可在開局指定一組額外戀人，不會改變玩家職業。</li>
</ul>
<h3>三、死亡情報</h3>
<ul><li>好人玩家死亡時，可公開一條真實情報，例如查驗結果、攻擊來源情報或嫌疑目標；由主持人核實。</li></ul>
<h3>四、夜晚結算順序</h3>
<ol><li>招募／洗腦</li><li>職業抹除</li><li>守衛守護</li><li>擊殺：狼人 → 黑道 → 中立 → 叛亂軍 → 好人</li><li>軍火裝備強化</li><li>女巫解藥／毒藥</li><li>惡靈騎士反噬</li><li>勝利條件檢查</li></ol>
<h3>五、各陣營目標</h3>
<ul>
<li><b>好人：</b>找出並消滅所有敵對陣營。</li>
<li><b>狼人：</b>擊殺所有其他玩家。</li>
<li><b>黑道：</b>完成招募配置並擊殺所有其他玩家；大哥死亡後幫手最多延續一夜。</li>
<li><b>邪教：</b>存活邪教人數達全場一半。</li>
<li><b>中立：</b>依個別職業條件獲勝，例如最後存活、指定目標出局或完成擊殺目標。</li>
<li><b>叛亂軍：</b>擊殺三名強勢職業、叛亂軍人數達到其他所有玩家總和，或進入革命狀態後存活至結束。</li>
</ul>
<p class="rules-note">提醒：職業技能有些需要主持人依特殊死亡、傳承、戀人及多陣營情況裁定。此圖鑑是本局規則說明；若房主調整卡池，實際出現職業以房主設定為準。</p>
</section>`;

function buildPools(){
 const make=(id,rows,cls)=>{$(id).innerHTML=rows.map(([name,f])=>`<label class="pool-item"><input type="checkbox" data-pool="${cls}" value="${name}" ${["預言家","女巫","守衛","獵人","平民","狼人","狼預","議員","白癡","好人賭怪"].includes(name)?"checked":""}><span class="pool-role-name ${FACTION_CLASS[f]||"faction-special"}">${name}<small class="muted"> · ${f}</small></span><input type="number" min="0" max="32" value="${name==="平民"?3:name==="狼人"?2:name==="議員"?2:name==="白癡"?3:1}" aria-label="${name} 張數"></label>`).join("")};
 make("main-role-pool",MAIN_ROLES,"main");make("sub-role-pool",SUB_ROLES,"sub");make("extra-role-pool",EXTRA_ROLES,"extra");
}
function buildGuide(){
 $("guide-body").innerHTML=RULE_OVERVIEW+[["主職業",MAIN_ROLES],["副職業",SUB_ROLES],["附加職",EXTRA_ROLES]].map(([title,rows])=>`<h3>${title}</h3>`+rows.map(([n,f,d])=>`<div class="guide-entry"><b>${n}</b> <span class="faction-tag ${FACTION_CLASS[f]||"faction-special"}">${f}</span><div>${ROLE_DETAILS[n]||d}</div></div>`).join("")).join("");
}
function getPool(cls){const out=[];document.querySelectorAll(`[data-pool="${cls}"]:checked`).forEach(el=>{const n=Math.max(0,Math.min(32,Number(el.parentElement.querySelector('input[type=number]').value)||0));for(let i=0;i<n;i++)out.push(el.value)});return out}
function shuffle(a){a=[...a];for(let i=a.length-1;i>0;i--){let j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function createRoom(){
 const name=$("my-player-name").value.trim()||"房主";roomId=myPeerId||"LOCAL-"+Math.random().toString(36).slice(2,8).toUpperCase();
 isHost=true;localPlayerId="p0";mode=selectedMode;
 state={players:[makePlayer("p0",name,false)],round:1,day:1,phase:"lobby",active:false,actions:[],votes:{},voteRound:0,history:[],settings:{count:+$("player-count").value,bots:+$("bot-count").value,discussion:+$("discussion-seconds").value,lastWords:$("enable-last-words").checked},pool:{main:getPool("main"),sub:getPool("sub"),extra:getPool("extra")},used:{},loverLinks:[],recruitQueue:[],nightDeaths:[],nightActions:[],wolfShots:1};
 show("host-config-area",false);show("lobby-area");$("display-room-id").textContent=roomId;refreshLobby();document.body.classList.add("is-host");
}
function makePlayer(id,name,bot){return{id,name,bot,alive:true,mainRole:"平民",subRole:"無",extraRole:"無",baseFaction:"好人",faction:"好人",factions:["好人"],converted:false,wasConverted:false,nightImmune:0,vest:false,bullets:0,deathCount:0,loverDeaths:0,actionsUsed:{},marks:[],votes:0,known:{},roleDisabled:false}}
function refreshLobby(){
 if(!state)return;const names=state.players.map(p=>p.name);$("player-count-display").textContent=names.length;$("player-list").innerHTML=names.map(n=>`<li>${n}</li>`).join("");
}
function joinRoom(){
 const target=$("join-room-id").value.trim();if(!target)return toast("請輸入房間 ID");if(!peer)return toast("PeerJS 尚未初始化");
 hostConn=peer.connect(target);roomId=target;
 hostConn.on("open",()=>{hostConn.send({type:"JOIN",name:$("my-player-name").value.trim()||"玩家"});show("connection-area",false);show("lobby-area");$("display-room-id").textContent=roomId;log("已連線，等待房主開始")});
 hostConn.on("data",d=>handleClientMessage(d));hostConn.on("close",()=>toast("與房主的連線中斷"));hostConn.on("error",()=>toast("加入房間失敗"));
}
function handleHostMessage(c,d){if(d.type==="JOIN"){c.playerName=String(d.name||"玩家").slice(0,18);c.playerId="p"+Math.random().toString(36).slice(2,9);c.send({type:"WELCOME",id:c.playerId,roomId});refreshLobby();broadcast({type:"LOBBY",names:state.players.map(p=>p.name).concat(connections.map(x=>x.playerName||"玩家"))})}else if(d.type==="ACTION"&&state?.active){processAction(d.action,c.playerId)}}
function handleClientMessage(d){
 if(d.type==="WELCOME"){localPlayerId=d.id;toast("已加入房間")}
 if(d.type==="LOBBY"){$("player-list").innerHTML=d.names.map(n=>`<li>${String(n).replace(/[<>]/g,"")}</li>`).join("");$("player-count-display").textContent=d.names.length}
 if(d.type==="GAME_PRIVATE"){state=d.state;localPlayerId=d.id;renderGame(d.roleInfo)}
 if(d.type==="PUBLIC_STATE"){state=d.state;renderPublic()}
 if(d.type==="LOG")log(d.message);
 if(d.type==="PHASE")renderActionPanel();
}
function broadcast(msg){connections.forEach(c=>{if(c.open)c.send(msg)})}
function enterTest(){
 const pwd=prompt("請輸入測試模式密碼：");if(pwd!=="676767"){if(pwd!==null)toast("密碼錯誤");return}
 mode="test";testBots=[{main:"狼人",sub:"無",extra:"無"},{main:"黑道大哥",sub:"內奸",extra:"無"}];
 $("test-my-main").innerHTML=roleOptions(MAIN_ROLES);$("test-my-sub").innerHTML='<option>無</option>'+roleOptions(SUB_ROLES);$("test-my-extra").innerHTML='<option>無</option>'+roleOptions(EXTRA_ROLES);
 show("connection-area",false);show("test-mode-area");renderTestBots();
}
function renderTestBots(){
 $("test-bot-config-container").innerHTML=testBots.map((b,i)=>`<div class="action-form"><b>AI ${i+1}</b><div class="config-row">主職<select data-bot="${i}" data-key="main">${roleOptions(MAIN_ROLES).replace(`value="${b.main}"`,`value="${b.main}" selected`)}</select></div><div class="config-row">副職<select data-bot="${i}" data-key="sub"><option value="無">無</option>${roleOptions(SUB_ROLES)}</select></div><div class="config-row">附加<select data-bot="${i}" data-key="extra"><option value="無">無</option>${roleOptions(EXTRA_ROLES)}</select></div></div>`).join("");
 $("test-bot-config-container").querySelectorAll("select").forEach(s=>{const i=+s.dataset.bot,k=s.dataset.key;s.value=testBots[i][k];s.onchange=()=>testBots[i][k]=s.value});
}
function startTest(){
 isHost=true;localPlayerId="p0";roomId="TEST";state={players:[],round:1,day:1,phase:"night",active:true,actions:[],votes:{},voteRound:0,loverLinks:[],nightDeaths:[],nightActions:[],used:{},settings:{lastWords:true},wolfShots:1};
 const me=makePlayer("p0",$("my-player-name").value+"（你）",false);assignRole(me,$("test-my-main").value,$("test-my-sub").value,$("test-my-extra").value);state.players.push(me);
 testBots.forEach((b,i)=>{const p=makePlayer("b"+i,"AI_"+(i+1),true);assignRole(p,b.main,b.sub,b.extra);state.players.push(p)});
 if(state.players.length<3){const p=makePlayer("b-extra","AI_補位",true);assignRole(p,"平民","無","無");state.players.push(p)}
 startRuntime();
}
function assignRole(p,main,sub,extra){
 p.mainRole=main;p.subRole=sub||"無";p.extraRole=extra||"無";p.baseFaction=factionOf(main);p.faction=p.baseFaction;p.factions=[p.faction];
 if(sub&&sub!=="無"&&factionOf(sub)!=="特殊"&&factionOf(sub)!==p.faction)p.factions.push(factionOf(sub));
 if(sub==="內奸"){p.faction="黑道";p.factions=["黑道"];p.known.godfather=true}
 if(p.extraRole==="戀人")p.extraRole="戀人";
}
function startGame(){
 if(!isHost||!state)return;
 const target=Math.max(2,Math.min(32,state.settings.count||12));
 let humans=state.players.length;
 if(mode==="hybrid"){let n=Math.max(0,Math.min(target-humans,state.settings.bots||0));for(let i=0;i<n;i++)state.players.push(makePlayer("ai"+i,"AI 機器人_"+(i+1),true))}
 while(state.players.length<target)state.players.push(makePlayer("ai-fill"+state.players.length,"AI 補位_"+state.players.length,true));
 if(state.players.length>target)state.players=state.players.slice(0,target);
 const mains=shuffle(state.pool.main),subs=shuffle(state.pool.sub),extras=shuffle(state.pool.extra);
 state.players.forEach((p,i)=>assignRole(p,mains[i]||"平民",subs[i]||"無",extras[i]||"無"));
 state.active=true;state.phase="night";state.round=1;state.day=1;
 maybeAssignHostLovers();startRuntime();
}
function maybeAssignHostLovers(){if($("host-lovers")?.value==="random"&&state.players.length>=2){const a=shuffle(state.players)[0],b=shuffle(state.players.filter(p=>p!==a))[0];linkLovers(a.id,b.id,"主持人指定戀人")}}
function startRuntime(){
 show("lobby-area",false);show("test-mode-area",false);show("game-area");document.body.classList.toggle("is-host",isHost);
 $("round-number").textContent=state.round;log(`遊戲開始，共 ${state.players.length} 人。`);
 const me=player(localPlayerId)||state.players[0];localPlayerId=me.id;renderGame({main:me.mainRole,sub:me.subRole,extra:me.extraRole});renderPublic();renderActionPanel();if(isHost)broadcastPrivateRoles();
}
function broadcastPrivateRoles(){connections.forEach((c,i)=>{const p=state.players.find(x=>x.id===c.playerId);if(p)c.send({type:"GAME_PRIVATE",id:p.id,state:publicState(),roleInfo:{main:p.mainRole,sub:p.subRole,extra:p.extraRole}})});broadcast({type:"PUBLIC_STATE",state:publicState()})}
function publicState(){return{round:state.round,day:state.day,phase:state.phase,players:state.players.map(p=>({id:p.id,name:p.name,alive:p.alive,bot:p.bot,faction:p.alive&&p.bot?"未知":undefined})),active:state.active}}
function renderGame(r){
 $("my-card-details").innerHTML=`<div class="role-card"><div class="role-main">${r.main}</div><div>陣營：${factionOf(r.main)}</div><div>副職：${r.sub||"無"}</div><div>附加職：${r.extra||"無"}</div><p class="muted">${ROLE_MAP[r.main]?.desc||""}</p></div>`;
}
function renderPublic(){
 if(!state)return;$("round-number").textContent=state.round;$("game-stage").textContent=({night:"🌙 夜晚行動",day:"☀️ 白天討論",vote:"🗳️ 投票",runoff:"⚖️ 平票加賽",ended:"🏆 遊戲結束"})[state.phase]||state.phase;
 $("player-status").innerHTML=state.players.map(p=>`<div class="player-row"><span>${safeName(p)}</span><b class="${p.alive?"alive":"dead"}">${p.alive?"存活":"死亡"}</b></div>`).join("");
}
function renderActionPanel(){
 if(!state)return;const me=player(localPlayerId);if(!me)return;
 const targets=alive().filter(p=>p.id!==me.id);let html=`<p class="muted">你是 ${me.name}。依照職業與階段選擇行動；AI 會自動作出簡化決策。</p>`;
 if(state.phase==="night"&&me.alive){
  const options=targets.map(p=>`<option value="${p.id}">${safeName(p)}</option>`).join("");
  const actions=[];
  const add=(label,kind,select=options)=>actions.push(`<div class="action-form"><b>${label}</b><select id="target-${kind}">${select}</select><button onclick="submitAction('${kind}','target-${kind}')">確認${label}</button></div>`);
  if(["預言家","狼預","革命殺手"].includes(me.mainRole))add("查驗 / 偵查","inspect");
  if(["狼人","狼預"].includes(me.mainRole)||me.subRole==="狼人(副)")add("狼人共同擊殺","wolfkill");
  if(["守衛"].includes(me.mainRole))add("守護","guard");
  if(["女巫"].includes(me.mainRole)&&!state.used[me.id+"-antidote"])add("女巫解藥（救當晚受害者）","save",'<option value="self">若有受害者，救援</option>');
  if(["女巫"].includes(me.mainRole)&&!state.used[me.id+"-poison"])add("女巫毒藥","poison");
  if(["職業抹除者"].includes(me.mainRole))add("抹除主職技能","silence");
  if(["捕快"].includes(me.subRole))add("捕快擊殺","constable");
  if(["狙擊手"].includes(me.mainRole))add("狙擊","shoot");
  if(["暗夜殺手"].includes(me.mainRole))add("暗夜擊殺","nightkill");
  if(["狗頭人"].includes(me.mainRole))add("狗頭人標記","dogmark");
  if(["革命殺手"].includes(me.mainRole))add("革命暗殺","rebelkill");
  if(["自爆狂"].includes(me.mainRole))add("自爆狂標記","mark");
  if(["邪教教主"].includes(me.mainRole))add("洗腦招募","cult");
  if(["教父"].includes(me.mainRole))add("教父招募","recruit");
  if(["黑道大哥"].includes(me.mainRole))add("黑道招募","mafia");
  if(["警長"].includes(me.mainRole))add("警長標記","marshalmark");
  if(["愛心使"].includes(me.mainRole)&&!state.used[me.id+"-amnesty"])add("愛心使招安","amnesty");
  html+=actions.join("")||'<p class="muted">本夜沒有可用的主動技能，等待主持人結算。</p>';
 }else if(state.phase==="day"||state.phase==="vote"||state.phase==="runoff"){
  html+='<p>白天請討論並投票。死亡玩家不能投票。</p>';
  if(me.alive)html+=`<div class="action-form"><b>選擇投票對象</b><select id="vote-target">${targets.map(p=>`<option value="${p.id}">${safeName(p)}</option>`).join("")}</select><button onclick="castVote()">送出投票</button></div>`;
 }
 $("action-panel").innerHTML=html;
 $("vote-panel").textContent=state.phase==="vote"||state.phase==="runoff"?"請在行動面板提交投票。":"尚未進入投票階段。";
}
window.submitAction=(kind,id)=>{const target=$(id)?.value;if(isHost)processAction({kind,target},localPlayerId);else hostConn?.send({type:"ACTION",action:{kind,target}})};
function processAction(action,actorId){
 const actor=player(actorId);if(!actor||!actor.alive||state.phase!=="night")return;
 const target=player(action.target);
 if(target&&!target.alive)return toast("目標已死亡");
 state.nightActions.push({actorId,kind:action.kind,targetId:action.target});
 log(`${actor.name} 已提交夜晚行動：${action.kind}`);
 if(actor.bot)return;
 toast("行動已提交，等待夜晚結算");
}
window.castVote=()=>{const t=$("vote-target")?.value;if(!t)return;const a={kind:"vote",target:t};if(isHost)processVote(localPlayerId,t);else hostConn?.send({type:"ACTION",action:a})};
function processVote(voterId,targetId){const v=player(voterId),t=player(targetId);if(!v?.alive||!t?.alive)return;state.votes[voterId]=targetId;log(`${v.name} 已投票。`);if(Object.keys(state.votes).length>=alive().length)resolveVote()}
function resolveVote(){
 const counts={};alive().forEach(p=>{const t=state.votes[p.id];if(!t)return;const w=(p.mainRole==="市長"?3:1)+(p.subRole==="議員"?2:0);counts[t]=(counts[t]||0)+w});
 const max=Math.max(0,...Object.values(counts)),winners=Object.keys(counts).filter(k=>counts[k]===max);
 if(winners.length===1){killPlayer(winners[0],"投票處決",{type:"vote"});log(`${player(winners[0]).name} 被投票處決。`);state.votes={};state.phase="day";checkVictory();if(state.active)renderPublic(),renderActionPanel()}
 else{state.phase="runoff";state.voteRound++;state.runoffIds=winners;state.votes={};log("投票平票，進入加賽投票。");renderPublic();renderActionPanel()}
}
function stopAutoHost(){
 autoHost=false;if(autoHostTimer){clearTimeout(autoHostTimer);autoHostTimer=null}
}
function startAutoHost(){
 if(!isHost||!state?.active){$("auto-host-toggle").checked=false;return toast("只有房主在遊戲開始後可以啟用自動主持")}
 autoHost=true;speakHost("AI 自動主持已啟動。");scheduleAutoHost(900);
}
function scheduleAutoHost(delay){
 if(!autoHost)return;if(autoHostTimer)clearTimeout(autoHostTimer);
 autoHostTimer=setTimeout(()=>{autoHostTimer=null;autoHostStep()},delay);
}
function runBotNightActions(){
 for(const bot of alive().filter(p=>p.bot)){
  const targets=alive().filter(p=>p.id!==bot.id);if(!targets.length)continue;
  const target=targets[Math.floor(Math.random()*targets.length)];
  const kind=bot.mainRole==="預言家"||bot.mainRole==="狼預"||bot.mainRole==="革命殺手"?"inspect":
   (["狼人","狼預"].includes(bot.mainRole)||bot.subRole==="狼人(副)")?"wolfkill":
   bot.mainRole==="邪教教主"?"cult":bot.mainRole==="教父"?"recruit":
   bot.mainRole==="黑道大哥"?"mafia":bot.mainRole==="守衛"?"guard":
   bot.mainRole==="暗夜殺手"?"nightkill":bot.mainRole==="狙擊手"?"shoot":
   bot.mainRole==="捕快"||bot.subRole==="捕快"?"constable":
   bot.mainRole==="革命殺手"?"rebelkill":null;
  if(kind&&!(kind==="cult"&&state.round%2!==0))state.nightActions.push({actorId:bot.id,kind,targetId:target.id});
 }
}
function runBotVotes(){
 for(const bot of alive().filter(p=>p.bot)){
  const choices=alive().filter(p=>p.id!==bot.id);if(!choices.length)continue;
  const target=choices[Math.floor(Math.random()*choices.length)];state.votes[bot.id]=target.id;
 }
}
function autoHostStep(){
 if(!autoHost||!state?.active)return;
 if(state.phase==="night"){
  runBotNightActions();resolveNight();if(!state.active){renderPublic();return}
  state.phase="day";log(`第 ${state.day} 天開始，AI 主持人開始白天討論。`);
  renderPublic();renderActionPanel();
  const seconds=Math.max(10,Math.min(300,Number($("auto-discussion-seconds")?.value)||60));
  speakHost(`天亮了。現在進入白天討論，時間 ${seconds} 秒。`);
  scheduleAutoHost(seconds*1000);return;
 }
 if(state.phase==="day"){
  state.phase="vote";state.votes={};log("討論時間結束，開始投票。");speakHost("討論時間結束，請所有玩家投票。");
  renderPublic();renderActionPanel();scheduleAutoHost(1500);return;
 }
 if(state.phase==="vote"||state.phase==="runoff"){
  runBotVotes();
  // 真人尚未投票時給予短暫時間；逾時由系統補票，避免流程卡住。
  const missing=alive().filter(p=>!p.bot&&!state.votes[p.id]);
  if(missing.length){speakHost("尚有玩家未投票，系統將在十五秒後自動補票。");missing.forEach(p=>{const choices=alive().filter(x=>x.id!==p.id);if(choices.length)state.votes[p.id]=choices[Math.floor(Math.random()*choices.length)].id})}
  resolveVote();
  if(!state.active)return;
  if(state.phase==="runoff"){renderPublic();renderActionPanel();scheduleAutoHost(3000);return}
  state.phase="night";state.round++;state.day++;state.nightActions=[];state.votes={};
  log(`第 ${state.round} 夜開始。`);renderPublic();renderActionPanel();scheduleAutoHost(3000);return;
 }
}
function nextPhase(){
 if(!isHost||!state?.active)return;
 if(state.phase==="night"){resolveNight();if(state.active){state.phase="day";log(`第 ${state.day} 天開始。`)}}
 else if(state.phase==="day"){state.phase="vote";state.votes={};log("開始投票。")}
 else if(state.phase==="vote"||state.phase==="runoff"){if(Object.keys(state.votes).length)resolveVote();else{state.phase="night";state.round++;state.day++;state.nightActions=[];state.votes={};log(`第 ${state.round} 夜開始。`) }}
 else if(state.phase==="ended")return;
 renderPublic();renderActionPanel();broadcast({type:"PUBLIC_STATE",state:publicState()});
}
function resolveNight(){
 const actions=state.nightActions;state.nightDeaths=[];
 // 優先級：招募/洗腦 -> 抹除 -> 守衛 -> 擊殺 -> 軍火 -> 女巫/反噬 -> 勝利。
 const rank={cult:0,recruit:0,mafia:0,amnesty:0,silence:1,guard:2,wolfkill:3,nightkill:3,shoot:3,poison:5,constable:3,rebelkill:3};
 actions.sort((a,b)=>(rank[a.kind]??4)-(rank[b.kind]??4));
 // 預言家查驗：狼人、邪教、叛亂軍陣營直接回報目標當下的主職身分；
 // 其他陣營仍回報當下陣營。以目前 faction 判斷，能反映已完成的轉化。
 for(const a of actions.filter(x=>x.kind==="inspect")){
  const actor=player(a.actorId),target=player(a.targetId);
  if(!actor?.alive||!target?.alive)continue;
  if(actor.mainRole==="預言家"){
   const revealRoleFactions=["狼人","邪教","叛亂軍"];
   const result=revealRoleFactions.includes(target.faction)
    ? `身分：${target.mainRole}`
    : `陣營：${target.faction}`;
   log(`🔮 預言家 ${actor.name} 查驗 ${target.name}，結果：${result}。`);
   actor.known[target.id]={type:"seer",result,round:state.round};
  }else if(actor.mainRole==="狼預"){
   log(`🐺 狼預 ${actor.name} 查驗 ${target.name}，結果：陣營：${target.faction}。`);
   actor.known[target.id]={type:"wolfseer",result:target.faction,round:state.round};
  }else if(actor.mainRole==="革命殺手"){
   const isStrong=STRONG.has(target.mainRole);
   log(`🕵️ 革命殺手 ${actor.name} 偵查 ${target.name}，結果：${isStrong?"強勢職業":"非強勢職業"}。`);
   actor.known[target.id]={type:"rebel-inspect",result:isStrong,round:state.round};
  }
 }
 const recruits=[];
 for(const a of actions){if(["cult","recruit","mafia","amnesty"].includes(a.kind))recruits.push(a)}
 recruits.sort((a,b)=>PRIORITY.indexOf(recruitType(a.kind))-PRIORITY.indexOf(recruitType(b.kind)));
 for(const a of recruits)resolveRecruit(a);
 for(const a of actions.filter(x=>x.kind==="silence")){const t=player(a.targetId);if(t)t.roleDisabled=true}
 const guards=new Set(actions.filter(x=>x.kind==="guard").map(x=>x.targetId));
 const attacks=[];
 for(const a of actions){const actor=player(a.actorId),t=player(a.targetId);if(!actor?.alive||!t?.alive)continue;
  if(["wolfkill","nightkill","shoot","poison","constable","rebelkill"].includes(a.kind))attacks.push({actor,target:t,kind:a.kind})}
 for(const hit of attacks){
  const {actor,target,kind}=hit;
  if(!target.alive)continue;
  if(guards.has(target.id)){log(`${target.name} 被守衛成功保護。`);continue}
  if(target.mainRole==="怨靈"&&kind!=="vote")continue;
  if(target.mainRole==="惡靈騎士"&&["poison","shoot","constable","nightkill","wolfkill"].includes(kind)){if(kind!=="shoot")killPlayer(actor.id,"惡靈反噬",{type:"reflection"});continue}
  if(target.vest&&kind!=="strong") {target.vest=false;log(`${target.name} 的防彈衣擋下攻擊。`);continue}
  if(kind==="constable"&&target.factions.length===1&&target.faction==="好人"){killPlayer(actor.id,"捕快誤殺好人",{type:"skill"});continue}
  killPlayer(target.id,kind,{type:kind,attacker:actor.id});
 }
 for(const p of alive())p.roleDisabled=false;
 state.nightActions=[];checkVictory();
}
function recruitType(k){return({cult:"邪教",recruit:"教父",mafia:"黑道",amnesty:"愛心使"})[k]||k}
function resolveRecruit(a){
 const actor=player(a.actorId),t=player(a.targetId);if(!actor?.alive||!t?.alive)return;
 if(t.mainRole==="禁衛軍"){log(`${t.name} 的禁衛軍能力抵銷招募。`);return}
 if(t.mainRole==="邪教教主"||t.mainRole==="黑道大哥"&&actor.mainRole!=="邪教教主")return;
 if(a.kind==="cult"){if(actor.mainRole!=="邪教教主"||state.round%2!==0)return;t.faction="邪教";t.factions=["邪教"];t.converted=true;t.wasConverted=true}
 if(a.kind==="recruit"){if(actor.mainRole!=="教父")return;t.faction="狼人";t.factions=["狼人"];t.converted=true;t.wasConverted=true}
 if(a.kind==="mafia"){if(actor.mainRole!=="黑道大哥")return;t.faction="黑道";t.factions=["黑道"];t.converted=true;t.wasConverted=true}
 if(a.kind==="amnesty"){if(actor.mainRole!=="愛心使"||state.used[actor.id+"-amnesty"])return;t.faction="好人";t.factions=["好人"];t.converted=true;t.wasConverted=true;state.used[actor.id+"-amnesty"]=true}
 log(`${t.name} 的陣營發生變化。`);
}
function linkLovers(a,b,source){if(!a||!b||a.id===b.id)return;state.loverLinks.push({a:a.id,b:b.id,source,active:true});log(`${a.name} 與 ${b.name} 成為戀人。`)}
function killPlayer(id,reason,meta={}){
 const p=player(id);if(!p?.alive)return;
 if(p.mainRole==="怨靈"&&meta.type!=="vote")return;
 p.alive=false;p.deathCount++;log(`💀 ${p.name} 死亡（${reason}）。`);
 if(state.settings.lastWords&&p.factions.includes("好人"))log(`${p.name} 可公開一條真實情報（由主持人核實）。`);
 // 戀人連鎖：同一玩家可有多組連結，重複死亡不重複處理。
 for(const l of state.loverLinks.filter(x=>x.active&&(x.a===id||x.b===id))){
  const other=player(l.a===id?l.b:l.a);if(other?.alive){other.alive=false;other.deathCount++;log(`💔 ${other.name} 因戀人殉情死亡。`)}
 }
 if(p.mainRole==="獵人"&&meta.type!=="poison"&&meta.type!=="lover"&&meta.type!=="reflection")log(`🏹 ${p.name} 獵人可發動死亡開槍（需主持人處理）。`);
 if(p.mainRole==="小丑"&&p.deathCount>=2){state.specialWinner=p.id;log("🤡 小丑達成死亡兩次勝利條件。")}
}
function checkVictory(){
 const living=alive();if(!state.active)return;
 const factionCount={};living.forEach(p=>p.factions.forEach(f=>factionCount[f]=(factionCount[f]||0)+1));
 let winners=[];
 if(living.length===1&&living[0].mainRole==="怨靈")winners=[living[0].id];
 if(state.specialWinner)winners=[state.specialWinner];
 if(!living.some(p=>p.faction==="狼人")&&living.length){} 
 if(factionCount.邪教&&factionCount.邪教>=Math.ceil(living.length/2))winners=living.filter(p=>p.factions.includes("邪教")).map(p=>p.id);
 const rebel=state.players.filter(p=>p.alive&&p.factions.includes("叛亂軍")).length;
 if(rebel>=living.length-rebel&&rebel>0)winners=state.players.filter(p=>p.factions.includes("叛亂軍")).map(p=>p.id);
 const wolves=state.players.filter(p=>p.alive&&p.factions.includes("狼人"));
 if(wolves.length&&living.every(p=>p.factions.includes("狼人")))winners=wolves.map(p=>p.id);
 if(winners.length){stopAutoHost();if($("auto-host-toggle"))$("auto-host-toggle").checked=false;state.active=false;state.phase="ended";log("🏆 勝利判定："+winners.map(id=>player(id)?.name).join("、"));$("game-stage").textContent="🏆 遊戲結束";}
}
document.addEventListener("DOMContentLoaded",init);