/* ITX Shop production starter: Supabase Auth + Postgres + RLS.
   Configure config.js and run supabase.sql before using. */
const cfg = window.ITX_CONFIG || {};
const configured = cfg.SUPABASE_URL && !cfg.SUPABASE_URL.includes("YOUR-PROJECT") &&
  cfg.SUPABASE_ANON_KEY && !cfg.SUPABASE_ANON_KEY.includes("YOUR_SUPABASE");
const db = configured && window.supabase ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;
const $ = id => document.getElementById(id);
const money = n => "৳ " + Number(n || 0).toLocaleString("en-BD");
let products = [], cart = [], currentUser = null, isAdmin = false, authMode = "signin";
const catName = x => x || "অন্যান্য";
function toast(msg){const t=$("toast");t.textContent=msg;t.classList.add("show");clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.remove("show"),3000)}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function showModal(html){$("modalContent").innerHTML=html;$("modalBackdrop").classList.remove("hidden")}
function closeModal(){$("modalBackdrop").classList.add("hidden")}
function placeholderEmoji(category){const s=String(category||"").toLowerCase();if(/fashion|cloth|dress|জামা|কাপড়/.test(s))return "👕";if(/food|grocery|খাবার/.test(s))return "🛒";if(/home|ঘর/.test(s))return "🏠";return "📦"}
function renderProducts(){
 const q=$("searchInput").value.trim().toLowerCase(), cat=$("categoryFilter").value;
 const cats=[...new Set(products.map(p=>p.category).filter(Boolean))];
 const filter=$("categoryFilter"); const prev=filter.value;
 filter.innerHTML='<option value="all">সব ক্যাটাগরি</option>'+cats.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');
 if(cats.includes(prev))filter.value=prev;
 const list=products.filter(p=>(filter.value==="all"||p.category===filter.value)&&(`${p.name} ${p.category||""} ${p.description||""}`).toLowerCase().includes(q));
 $("productGrid").innerHTML=list.map(p=>`<article class="product-card"><div class="product-image">${Number(p.stock_quantity)===0?'<span class="tag">স্টক শেষ</span>':''}${p.image_url?`<img src="${esc(p.image_url)}" alt="${esc(p.name)}" loading="lazy" style="width:100%;height:100%;object-fit:cover">`:`<span class="emoji">${placeholderEmoji(p.category)}</span>`}</div><div class="product-info"><span class="product-category">${esc(catName(p.category))} · স্টক ${Number(p.stock_quantity)||0}</span><h3>${esc(p.name)}</h3><p style="font-size:12px;color:#718078;min-height:20px">${esc((p.description||"").slice(0,75))}</p><div class="product-bottom"><span class="price">${money(p.price)}</span><button class="add-btn" data-add="${esc(p.id)}" ${Number(p.stock_quantity)<=0?"disabled":""} aria-label="কার্টে যোগ করুন">+</button></div></div></article>`).join("");
 $("emptyState").classList.toggle("hidden",list.length!==0);
}
async function loadProducts(){
 if(!db){products=demoProducts();renderProducts();$("authStatus").textContent="Supabase সংযুক্ত নয়। config.js ও SQL সেটআপ করুন।";return}
 const {data,error}=await db.from("products").select("id,name,description,price,category,image_url,stock_quantity,is_active").eq("is_active",true).order("created_at",{ascending:false});
 if(error){console.error(error);toast("পণ্য লোড করা যায়নি—Supabase সেটআপ যাচাই করুন।");return}
 products=data||[];renderProducts();
 const {data:n}=await db.from("store_notices").select("message").eq("is_published",true).order("created_at",{ascending:false}).limit(1).maybeSingle();
 if(n?.message)$("noticeText").textContent=n.message;
}
function demoProducts(){return [
{id:"d1",name:"Wireless Headphone",price:1290,category:"ইলেকট্রনিক্স",description:"দৈনন্দিন ব্যবহারের জন্য",stock_quantity:8},
{id:"d2",name:"Classic Wrist Watch",price:1890,category:"ফ্যাশন",description:"স্টাইলিশ ঘড়ি",stock_quantity:5},
{id:"d3",name:"Everyday Backpack",price:990,category:"ফ্যাশন",description:"প্রতিদিনের ব্যাগ",stock_quantity:12},
{id:"d4",name:"Smart Desk Lamp",price:750,category:"হোম",description:"ঘরের জন্য স্মার্ট ল্যাম্প",stock_quantity:6}
]}
function updateCart(){const count=cart.reduce((n,x)=>n+x.qty,0);$("cartCount").textContent=count}
$("productGrid").addEventListener("click",e=>{const b=e.target.closest("[data-add]");if(!b)return;const p=products.find(x=>String(x.id)===b.dataset.add);if(!p)return;const it=cart.find(x=>String(x.id)===String(p.id));if(it)it.qty=Math.min(it.qty+1,Number(p.stock_quantity)||1);else cart.push({id:p.id,name:p.name,price:Number(p.price),qty:1,stock:Number(p.stock_quantity)||1});updateCart();toast("কার্টে যোগ হয়েছে: "+p.name)});
$("searchForm").addEventListener("submit",e=>{e.preventDefault();renderProducts();$("products").scrollIntoView({behavior:"smooth"})});
$("searchInput").addEventListener("input",renderProducts);$("categoryFilter").addEventListener("change",renderProducts);
function showCart(){if(!cart.length){showModal("<h2>আপনার কার্ট</h2><p>কার্ট এখনো খালি।</p><button class='primary-btn' onclick='closeModal()'>শপিং চালিয়ে যান</button>");return}
 const total=cart.reduce((s,x)=>s+x.price*x.qty,0);
 showModal(`<h2>আপনার কার্ট</h2>${cart.map(x=>`<div class="cart-line"><span>${esc(x.name)} × ${x.qty}<br><small><button data-qty="${esc(x.id)}" data-delta="-1">−</button> <button data-qty="${esc(x.id)}" data-delta="1">+</button> <button data-remove="${esc(x.id)}">বাদ দিন</button></small></span><b>${money(x.price*x.qty)}</b></div>`).join("")}<div class="cart-total"><span>মোট</span><span>${money(total)}</span></div><button class="primary-btn" onclick="closeModal();document.getElementById('checkoutForm').scrollIntoView({behavior:'smooth'})">চেকআউট করুন</button>`)}
$("modalContent").addEventListener("click",e=>{const q=e.target.closest("[data-qty]"),r=e.target.closest("[data-remove]");if(q){const x=cart.find(i=>String(i.id)===q.dataset.qty);if(x){x.qty+=Number(q.dataset.delta);if(x.qty<1)cart=cart.filter(i=>i!==x);if(x.qty>x.stock)x.qty=x.stock}updateCart();showCart()}if(r){cart=cart.filter(i=>String(i.id)!==r.dataset.remove);updateCart();showCart()}});
$("cartOpen").addEventListener("click",showCart);
$("modalClose").addEventListener("click",closeModal);$("modalBackdrop").addEventListener("click",e=>{if(e.target===$("modalBackdrop"))closeModal()});document.addEventListener("keydown",e=>{if(e.key==="Escape")closeModal()});
function setAuthMode(mode){authMode=mode;$("authHeading").textContent=mode==="signup"?"নতুন অ্যাকাউন্ট তৈরি করুন":"অ্যাকাউন্টে প্রবেশ";$("authNameWrap").classList.toggle("hidden",mode!=="signup");$("signInBtn").classList.toggle("hidden",mode==="signup");$("signUpBtn").textContent=mode==="signup"?"রেজিস্ট্রেশন":"নতুন অ্যাকাউন্ট"}
$("signUpBtn").addEventListener("click",()=>{if(authMode==="signin"){setAuthMode("signup");$("authPassword").setAttribute("autocomplete","new-password");return} $("authForm").requestSubmit()});
$("authForm").addEventListener("submit",async e=>{e.preventDefault();if(!db){toast("প্রথমে config.js-এ Supabase URL ও anon key সেট করুন।");return}
 const email=$("authEmail").value.trim(),password=$("authPassword").value;
 if(authMode==="signup"){const {data,error}=await db.auth.signUp({email,password,options:{data:{full_name:$("authName").value.trim()}}});if(error){toast(error.message);return}toast(data.session?"অ্যাকাউন্ট তৈরি হয়েছে।":"ইমেইল যাচাইয়ের জন্য আপনার ইনবক্স দেখুন।");if(data.session)await refreshSession()}
 else {const {error}=await db.auth.signInWithPassword({email,password});if(error){toast(error.message);return}toast("লগইন সফল");await refreshSession()}
});
$("signInBtn").addEventListener("click",()=>{setAuthMode("signin")});
$("signOutBtn").addEventListener("click",async()=>{if(db)await db.auth.signOut();currentUser=null;isAdmin=false;updateAuthUI();toast("লগআউট হয়েছে")});
async function refreshSession(){if(!db){updateAuthUI();return}const {data}=await db.auth.getSession();currentUser=data.session?.user||null;isAdmin=false;
 if(currentUser){const {data:profile}=await db.from("profiles").select("role,full_name").eq("id",currentUser.id).maybeSingle();isAdmin=profile?.role==="admin";if(profile?.full_name&&!$("customerName").value)$("customerName").value=profile.full_name}
 updateAuthUI();if(isAdmin)loadAdminOrders()}
function updateAuthUI(){$("signOutBtn").classList.toggle("hidden",!currentUser);$("authStatus").textContent=currentUser?`লগইন: ${currentUser.email}${isAdmin?" · Admin":""}`:(db?"লগইন করে অর্ডার দিতে পারবেন।":"Supabase config.js সেটআপ প্রয়োজন।");$("adminLocked").classList.toggle("hidden",isAdmin);$("adminTools").classList.toggle("hidden",!isAdmin);$("adminBadge").textContent=isAdmin?"ADMIN VERIFIED":"লগইন প্রয়োজন"}
$("paymentMethod").addEventListener("change",()=>{$("paymentRefWrap").classList.toggle("hidden",$("paymentMethod").value==="cod")});
$("checkoutForm").addEventListener("submit",async e=>{e.preventDefault();if(!db){toast("বাস্তব অর্ডারের জন্য Supabase সেটআপ করুন।");return}if(!currentUser){toast("অর্ডার দিতে আগে লগইন করুন।");$("account").scrollIntoView({behavior:"smooth"});return}if(!cart.length){toast("আগে কার্টে পণ্য যোগ করুন।");return}
 const method=$("paymentMethod").value,ref=$("paymentRef").value.trim();
 if(method!=="cod"&&!ref){toast("বিকাশ/নগদ পেমেন্টের Transaction ID দিন।");return}
 const payload={p_customer_name:$("customerName").value.trim(),p_customer_phone:$("customerPhone").value.trim(),p_shipping_address:$("customerAddress").value.trim(),p_payment_method:method,p_payment_reference:method==="cod"?null:ref,p_items:cart.map(x=>({product_id:x.id,quantity:x.qty}))};
 const btn=e.submitter;btn.disabled=true;btn.textContent="অর্ডার জমা হচ্ছে…";
 const {data,error}=await db.rpc("place_order",payload);btn.disabled=false;btn.textContent="অর্ডার কনফার্ম করুন";
 if(error){console.error(error);toast("অর্ডার ব্যর্থ: "+error.message);return}
 cart=[];updateCart();$("paymentRef").value="";toast("অর্ডার সফল! অর্ডার নম্বর: "+data);showModal(`<h2>অর্ডার গ্রহণ করা হয়েছে</h2><p>আপনার অর্ডার নম্বর: <b>${esc(data)}</b></p><p>অর্ডারের অবস্থা অ্যাডমিন যাচাই করার পর আপডেট হবে।</p><button class="primary-btn" onclick="closeModal()">ঠিক আছে</button>`);
});
$("addProductForm").addEventListener("submit",async e=>{e.preventDefault();if(!db||!isAdmin)return toast("অ্যাডমিন লগইন প্রয়োজন");const p={name:$("pName").value.trim(),price:Number($("pPrice").value),category:$("pCategory").value.trim(),image_url:$("pImage").value.trim()||null,description:$("pDescription").value.trim(),stock_quantity:Number($("pStock").value),is_active:true};const {error}=await db.from("products").insert(p);if(error)return toast("পণ্য যোগ হয়নি: "+error.message);e.target.reset();$("pStock").value=10;await loadProducts();toast("পণ্য যোগ হয়েছে")});
$("noticeForm").addEventListener("submit",async e=>{e.preventDefault();if(!db||!isAdmin)return toast("অ্যাডমিন লগইন প্রয়োজন");const {error}=await db.from("store_notices").insert({message:$("noticeInput").value.trim(),is_published:true});if(error)return toast("নোটিশ আপডেট হয়নি: "+error.message);$("noticeText").textContent=$("noticeInput").value.trim();toast("নোটিশ প্রকাশ হয়েছে")});
$("refreshOrders").addEventListener("click",loadAdminOrders);
async function loadAdminOrders(){if(!db||!isAdmin)return;const {data,error}=await db.from("orders").select("id,customer_name,customer_phone,shipping_address,total_amount,payment_method,payment_status,order_status,created_at").order("created_at",{ascending:false}).limit(50);if(error){$("adminOrders").textContent="অর্ডার লোড হয়নি: "+error.message;return}
 $("adminOrders").innerHTML=(data||[]).map(o=>`<div class="cart-line" style="align-items:flex-start"><div><b>#${esc(o.id)}</b> · ${esc(o.customer_name)}<br><small>${esc(o.customer_phone)} · ${esc(o.payment_method)} / ${esc(o.payment_status)}</small><br><small>${esc(o.shipping_address)}</small><br><small>অর্ডার: ${esc(o.order_status)}</small></div><div><b>${money(o.total_amount)}</b><br><select data-status="${esc(o.id)}"><option ${o.order_status==="pending"?"selected":""} value="pending">Pending</option><option ${o.order_status==="confirmed"?"selected":""} value="confirmed">Confirmed</option><option ${o.order_status==="shipped"?"selected":""} value="shipped">Shipped</option><option ${o.order_status==="delivered"?"selected":""} value="delivered">Delivered</option><option ${o.order_status==="cancelled"?"selected":""} value="cancelled">Cancelled</option></select><button data-save-status="${esc(o.id)}" class="primary-btn" style="padding:6px 9px;margin-top:5px">আপডেট</button></div></div>`).join("")||"এখনো কোনো অর্ডার নেই।";
}
$("adminOrders").addEventListener("click",async e=>{const b=e.target.closest("[data-save-status]");if(!b||!db||!isAdmin)return;const id=b.dataset.saveStatus,sel=$("adminOrders").querySelector(`[data-status="${CSS.escape(id)}"]`);const {error}=await db.from("orders").update({order_status:sel.value}).eq("id",id);if(error)return toast("স্ট্যাটাস আপডেট হয়নি: "+error.message);toast("অর্ডার স্ট্যাটাস আপডেট হয়েছে");loadAdminOrders()});
$("year").textContent=new Date().getFullYear();
(async()=>{if(!db){products=demoProducts();renderProducts();updateAuthUI();$("noticeText").textContent="ডেমো প্রিভিউ। বাস্তব অর্ডার চালু করতে Supabase সেটআপ করুন।";return}await loadProducts();await refreshSession();db.auth.onAuthStateChange(()=>setTimeout(refreshSession,0))})();
