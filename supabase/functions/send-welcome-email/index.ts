import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "noreply@alwafra.com";
const APP_URL = Deno.env.get("APP_URL") || "https://alwafra.vercel.app";

interface WelcomeEmailRequest {
  to: string;
  employeeName: string;
  username: string;
  password: string;
  employeeId?: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { to, employeeName, username, password, employeeId }: WelcomeEmailRequest = await req.json();

    if (!to || !employeeName || !username) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create Supabase client with service role for email_logs
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check for duplicate email (idempotency)
    const { data: existing } = await supabase
      .from("email_logs")
      .select("id")
      .eq("recipient_email", to)
      .eq("email_type", "employee_welcome")
      .gte("created_at", new Date(Date.now() - 5 * 60 * 1000).toISOString())
      .limit(1);

    if (existing && existing.length > 0) {
      return new Response(JSON.stringify({ success: true, message: "Duplicate prevented" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!RESEND_API_KEY) {
      await supabase.from("email_logs").insert({
        recipient_email: to,
        email_type: "employee_welcome",
        related_employee_id: employeeId || null,
        status: "failed",
        error_message: "RESEND_API_KEY not configured",
      });
      return new Response(JSON.stringify({ error: "Email service not configured" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const html = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>مرحباً بك في شركة الوفرة – بيانات الدخول</title>
</head>
<body style="margin:0;padding:0;font-family:'Tajawal','Segoe UI',Tahoma,sans-serif;background:#F7F8FA;direction:rtl;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F7F8FA;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
          <tr>
            <td style="background:#FA593C;padding:30px 40px;text-align:center;">
              <h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:700;">شركة الوفرة</h1>
              <p style="color:#FFE6DF;margin:8px 0 0;font-size:14px;">نظام إدارة الموظفين والمهام</p>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <h2 style="color:#383C47;margin:0 0 20px;font-size:20px;">مرحباً ${employeeName}،</h2>
              <p style="color:#5B5F6B;line-height:1.8;font-size:15px;margin:0 0 20px;">
                يسعدنا انضمامك إلى فريق شركة الوفرة. تم إنشاء حسابك على نظام إدارة الموظفين والمهام.
              </p>
              <p style="color:#5B5F6B;line-height:1.8;font-size:15px;margin:0 0 20px;">
                يمكنك الآن تسجيل الدخول باستخدام البيانات التالية:
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#F7F8FA;border-radius:8px;margin:20px 0;">
                <tr>
                  <td style="padding:16px 20px;border-bottom:1px solid #E5E7EB;">
                    <span style="color:#8A8E99;font-size:13px;">اسم المستخدم</span><br/>
                    <span style="color:#383C47;font-size:16px;font-weight:600;">${username}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 20px;border-bottom:1px solid #E5E7EB;">
                    <span style="color:#8A8E99;font-size:13px;">البريد الإلكتروني للدخول</span><br/>
                    <span style="color:#383C47;font-size:16px;font-weight:600;">${username}@alwafra.internal</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 20px;">
                    <span style="color:#8A8E99;font-size:13px;">كلمة المرور</span><br/>
                    <span style="color:#383C47;font-size:16px;font-weight:600;font-family:monospace;">${password}</span>
                  </td>
                </tr>
              </table>
              <div style="text-align:center;margin:30px 0;">
                <a href="${APP_URL}" style="background:#FA593C;color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:8px;font-size:15px;font-weight:600;display:inline-block;">تسجيل الدخول</a>
              </div>
              <p style="color:#8A8E99;font-size:13px;line-height:1.6;margin:20px 0 0;">
                يرجى تغيير كلمة المرور بعد أول تسجيل دخول. احرص على الحفاظ على بيانات الدخول وعدم مشاركتها مع أي شخص.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#F7F8FA;padding:20px 40px;text-align:center;">
              <p style="color:#A8ABB3;font-size:12px;margin:0;">© ${new Date().getFullYear()} شركة الوفرة. جميع الحقوق محفوظة.</p>
              <p style="color:#C8C9CC;font-size:11px;margin:5px 0 0;">هذه رسالة تلقائية، يرجى عدم الرد عليها.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: `شركة الوفرة <${FROM_EMAIL}>`,
        to: [to],
        subject: "مرحباً بك في شركة الوفرة – بيانات الدخول",
        html,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Resend error:", errText);
      await supabase.from("email_logs").insert({
        recipient_email: to,
        email_type: "employee_welcome",
        related_employee_id: employeeId || null,
        status: "failed",
        error_message: errText,
      });
      return new Response(JSON.stringify({ error: "Failed to send email" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resData = await res.json();
    await supabase.from("email_logs").insert({
      recipient_email: to,
      email_type: "employee_welcome",
      related_employee_id: employeeId || null,
      status: "sent",
      provider_message_id: resData?.id || null,
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Welcome email error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
