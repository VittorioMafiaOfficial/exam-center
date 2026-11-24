
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const respond = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    if (req.method !== "POST") {
      return respond({ error: "درخواست نامعتبر است." }, 405);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceKey) {
      return respond({ error: "تنظیمات سرور کامل نیست." }, 500);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return respond({ error: "ابتدا وارد حساب شوید." }, 401);
    }

    const token = authHeader.replace("Bearer ", "");

    const adminDb = createClient(supabaseUrl, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // بررسی هویت کاربر درخواست‌دهنده
    const { data: userData, error: userError } =
      await adminDb.auth.getUser(token);

    if (userError || !userData.user) {
      return respond({ error: "نشست کاربری معتبر نیست." }, 401);
    }

    // بررسی نقش مدیر
    const { data: profile, error: profileError } = await adminDb
      .from("profiles")
      .select("role")
      .eq("id", userData.user.id)
      .single();

    if (profileError || profile?.role !== "admin") {
      return respond({ error: "شما اجازه ساخت حساب ندارید." }, 403);
    }

    const body = await req.json();

    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const full_name = String(body.full_name || "").trim();
    const grade = Number(body.grade);

    if (
      !email ||
      !email.includes("@") ||
      password.length < 8 ||
      !full_name ||
      full_name.length > 100 ||
      ![10, 11, 12].includes(grade)
    ) {
      return respond({
        error: "اطلاعات واردشده معتبر نیست. رمز باید حداقل ۸ کاراکتر باشد.",
      }, 400);
    }

    // ساخت حساب احراز هویت
    const { data: newUser, error: createError } =
      await adminDb.auth.admin.createUser({
        email,
        password,
        email_confirm: false,
        user_metadata: { full_name },
      });

    if (createError || !newUser.user) {
      return respond({
        error: "ساخت حساب انجام نشد. ممکن است این ایمیل قبلاً ثبت شده باشد.",
      }, 400);
    }

    // ساخت پروفایل دانش‌آموز
    const { error: insertError } = await adminDb
      .from("profiles")
      .insert({
        id: newUser.user.id,
        email,
        full_name,
        role: "student",
        grade,
      });

    if (insertError) {
      // اگر ساخت پروفایل شکست خورد، حساب ناقص حذف شود
      await adminDb.auth.admin.deleteUser(newUser.user.id);

      return respond({ error: "ثبت پروفایل دانش‌آموز ناموفق بود." }, 500);
    }

    return respond({ success: true });
  } catch {
    return respond({ error: "خطای داخلی سرور رخ داد." }, 500);
  }
});

