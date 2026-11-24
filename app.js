// تنظیمات پروژه Supabase را در این قسمت قرار دهید.
const SUPABASE_URL = "https://thluimtxrmgoakwqjwkx.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_p_RaoQq00KWvvbmWMoyQng_0lpH6bef";
const configured = !SUPABASE_URL.startsWith("YOUR_") && !SUPABASE_ANON_KEY.startsWith("YOUR_");
const db = configured ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
let currentProfile = null;

const $ = (id) => document.getElementById(id);
const gradeName = (g) => ({10:"دهم",11:"یازدهم",12:"دوازدهم"}[g] || "—");

function showMessage(id, text, ok=false){ const el=$(id); el.textContent=text; el.style.color=ok?"#16804a":"#b42318"; }
function switchPage(page){
  document.querySelectorAll(".page").forEach(x=>x.classList.add("hidden"));
  $(page+"Page").classList.remove("hidden");
  document.querySelectorAll(".nav-link").forEach(x=>x.classList.toggle("active",x.dataset.page===page));
  $("pageTitle").textContent=({dashboard:"داشبورد",exams:"آزمون‌ها",results:"کارنامه‌ها",manage:"مدیریت"})[page];
}
document.querySelectorAll(".nav-link").forEach(b=>b.addEventListener("click",()=>switchPage(b.dataset.page)));
document.querySelectorAll("[data-goto]").forEach(b=>b.addEventListener("click",()=>switchPage(b.dataset.goto)));

function renderExam(exam){
  return `<article class="exam-card"><span class="tag">${exam.subject || "آزمون"} · پایه ${exam.grade==="all"?"همه":gradeName(exam.grade)}</span><h4>${escapeHtml(exam.title)}</h4><p>${exam.question_count} سؤال · ${exam.duration_minutes} دقیقه</p><button type="button" disabled title="امکان شرکت در آزمون در مرحله بعد فعال می‌شود">به‌زودی: شرکت در آزمون</button>${currentProfile?.role==="admin"?`<div class="id-line">شناسه: ${exam.id}</div>`:""}</article>`;
}
function escapeHtml(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}

async function loadData(){
  const {data: exams,error}=await db.from("exams").select("*").eq("published",true).order("created_at",{ascending:false});
  if(error){$("recentExams").innerHTML='<div class="empty">دریافت آزمون‌ها با خطا روبه‌رو شد.</div>';return;}
  const visible=(exams||[]).filter(e=>e.grade==="all" || Number(e.grade)===Number(currentProfile.grade));
  $("activeCount").textContent=visible.length;
  $("recentExams").innerHTML=visible.slice(0,3).map(renderExam).join("") || '<div class="empty">هنوز آزمونی برای پایه شما منتشر نشده است.</div>';
  $("examList").innerHTML=visible.map(renderExam).join("") || '<div class="empty">آزمونی وجود ندارد.</div>';
  if(currentProfile.role==="admin") $("adminExamList").innerHTML=(exams||[]).map(e=>`<div class="id-line">${escapeHtml(e.title)} — ${e.id}</div>`).join("") || "هنوز آزمونی ایجاد نشده است.";
  const {data: attempts}=await db.from("attempts").select("id,score,created_at,exams(title)").eq("student_id",currentProfile.id).order("created_at",{ascending:false});
  $("doneCount").textContent=(attempts||[]).length;
  $("resultList").innerHTML=`<table><thead><tr><th>آزمون</th><th>درصد</th><th>تاریخ</th></tr></thead><tbody>${(attempts||[]).map(a=>`<tr><td>${escapeHtml(a.exams?.title||"آزمون")}</td><td>${a.score??"—"}%</td><td>${new Date(a.created_at).toLocaleDateString("fa-IR")}</td></tr>`).join("")}</tbody></table>` || '<div class="empty">هنوز کارنامه‌ای ثبت نشده است.</div>';
}

async function enterApp(session){
  const {data,error}=await db.from("profiles").select("*").eq("id",session.user.id).single();
  if(error||!data){await db.auth.signOut();showMessage("loginMessage","پروفایل کاربری پیدا نشد. با مدیر سامانه تماس بگیرید.");return;}
  currentProfile=data;
  $("loginView").classList.add("hidden");$("appView").classList.remove("hidden");
  $("userName").textContent=data.full_name||session.user.email;
  $("userMeta").textContent=data.role==="admin"?"مدیر سامانه":`دانش‌آموز پایه ${gradeName(data.grade)}`;
  $("gradeStat").textContent=data.role==="admin"?"مدیر":gradeName(data.grade);
  document.querySelectorAll(".admin-only").forEach(x=>x.classList.toggle("hidden",data.role!=="admin"));
  await loadData();
}

$("loginForm").addEventListener("submit",async e=>{
  e.preventDefault();
  if(!configured){showMessage("loginMessage","ابتدا آدرس و کلید Supabase را در فایل app.js تنظیم کنید.");return;}
  showMessage("loginMessage","در حال ورود…",true);
  const {data,error}=await db.auth.signInWithPassword({email:$("email").value.trim(),password:$("password").value});
  if(error){showMessage("loginMessage","ورود ناموفق بود؛ ایمیل و رمز عبور را بررسی کنید.");return;}
  await enterApp(data.session);
});
$("logoutBtn").addEventListener("click",async()=>{await db.auth.signOut();location.reload();});

$("studentForm").addEventListener("submit",async e=>{
  e.preventDefault();showMessage("studentMessage","در حال ساخت حساب…",true);
  const {data:{session}}=await db.auth.getSession();
  const {data,error}=await db.functions.invoke("create-student",{body:{email:$("studentEmail").value.trim(),password:$("studentPassword").value,full_name:$("studentName").value.trim(),grade:Number($("studentGrade").value)}});
  if(error||data?.error){showMessage("studentMessage",data?.error||"ساخت حساب انجام نشد.");return;}
  showMessage("studentMessage","حساب دانش‌آموز با موفقیت ساخته شد.",true);e.target.reset();
});
$("examForm").addEventListener("submit",async e=>{
  e.preventDefault();showMessage("examMessage","در حال ذخیره…",true);
  const payload={title:$("examTitle").value.trim(),subject:$("examSubject").value,grade:$("examGrade").value,question_count:Number($("examQuestions").value),duration_minutes:Number($("examDuration").value),published:true,created_by:currentProfile.id};
  const {error}=await db.from("exams").insert(payload);
  if(error){showMessage("examMessage","ذخیره آزمون ناموفق بود: "+error.message);return;}
  showMessage("examMessage","آزمون ساخته شد. شناسه آن در فهرست مدیریت نمایش داده می‌شود.",true);e.target.reset();await loadData();
});

(async()=>{
  if(!configured){$("loginMessage").textContent="برای راه‌اندازی، فایل SETUP.md را مطالعه کنید.";return;}
  const {data:{session}}=await db.auth.getSession();
  if(session) await enterApp(session);
  db.auth.onAuthStateChange(async(_event,session)=>{if(session&&!currentProfile) await enterApp(session);});
})();
