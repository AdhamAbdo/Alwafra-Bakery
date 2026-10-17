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

interface TaskEmailRequest {
  to: string;
  employeeName: string;
  taskTitle: string;
  taskDescription?: string;
  department?: string;
  section?: string;
  priority: string;
  dueDate: string;
  status?: string;
  managerName: string;
  taskId?: string;
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("ar-EG", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body: TaskEmailRequest = await req.json();
    const { to, employeeName, taskTitle, taskDescription, department, section, priority, dueDate, status, managerName, taskId } = body;

    if (!to || !employeeName || !taskTitle) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Duplicate prevention: check if email already sent for this task in last 5 minutes
    if (taskId) {
      const { data: existing } = await supabase
        .from("email_logs")
        .select("id")
        .eq("email_type", "task_assigned")
        .eq("related_task_id", taskId)
        .gte("created_at", new Date(Date.now() - 5 * 60 * 1000).toISOString())
        .limit(1);

      if (existing && existing.length > 0) {
        return new Response(JSON.stringify({ success: true, message: "Duplicate prevented" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (!RESEND_API_KEY) {
      await supabase.from("email_logs").insert({
        recipient_email: to,
        email_type: "task_assigned",
        related_task_id: taskId || null,
        status: "failed",
        error_message: "RESEND_API_KEY not configured",
      });
      return new Response(JSON.stringify({ error: "Email service not configured" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const taskLink = taskId ? `${APP_URL}?task=${taskId}` : APP_URL;

    const html = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>تم تكليفك بمهمة جديدة – شركة الوفرة</title>
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
              <h2 style="color:#383C47;margin:0 0 20px;font-size:20px;">تم تكليفك بمهمة جديدة</h2>
              <p style="color:#5B5F6B;line-height:1.8;font-size:15px;margin:0 0 10px;">
                مرحباً ${employeeName}،
              </p>
              <p style="color:#5B5F6B;line-height:1.8;font-size:15px;margin:0 0 20px;">
                تم تكليفك بمهمة جديدة من قبل ${managerName}. إليك تفاصيل المهمة:
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#F7F8FA;border-radius:8px;margin:20px 0;">
                <tr>
                  <td style="padding:16px 20px;border-bottom:1px solid #E5E7EB;">
                    <span style="color:#8A8E99;font-size:13px;">اسم المهمة</span><br/>
                    <span style="color:#383C47;font-size:16px;font-weight:600;">${taskTitle}</span>
                  </td>
                </tr>
                ${taskDescription ? `
                <tr>
                  <td style="padding:16px 20px;border-bottom:1px solid #E5E7EB;">
                    <span style="color:#8A8E99;font-size:13px;">الوصف</span><br/>
                    <span style="color:#383C47;font-size:14px;line-height:1.6;">${taskDescription}</span>
                  </td>
                </tr>` : ''}
                ${section ? `
                <tr>
                  <td style="padding:16px 20px;border-bottom:1px solid #E5E7EB;">
                    <span style="color:#8A8E99;font-size:13px;">القسم</span><br/>
                    <span style="color:#383C47;font-size:15px;font-weight:600;">${section}${department ? ' / ' + department : ''}</span>
                  </td>
                </tr>` : ''}
                <tr>
                  <td style="padding:16px 20px;border-bottom:1px solid #E5E7EB;">
                    <span style="color:#8A8E99;font-size:13px;">الأولوية</span><br/>
                    <span style="color:#383C47;font-size:16px;font-weight:600;">${priority}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 20px;border-bottom:1px solid #E5E7EB;">
                    <span style="color:#8A8E99;font-size:13px;">تاريخ الاستحقاق</span><br/>
                    <span style="color:#383C47;font-size:16px;font-weight:600;">${formatDate(dueDate)}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 20px;">
                    <span style="color:#8A8E99;font-size:13px;">الحالة</span><br/>
                    <span style="color:#383C47;font-size:16px;font-weight:600;">${status || 'جديدة'}</span>
                  </td>
                </tr>
              </table>
              <div style="text-align:center;margin:30px 0;">
                <a href="${taskLink}" style="background:#FA593C;color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:8px;font-size:15px;font-weight:600;display:inline-block;">عرض المهمة</a>
              </div>
              <p style="color:#8A8E99;font-size:13px;line-height:1.6;margin:20px 0 0;">
                يمكنك الدخول إلى النظام للاطلاع على تفاصيل المهمة وتحديث حالتها.
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
        subject: "تم تكليفك بمهمة جديدة – شركة الوفرة",
        html,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Resend error:", errText);
      await supabase.from("email_logs").insert({
        recipient_email: to,
        email_type: "task_assigned",
        related_task_id: taskId || null,
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
      email_type: "task_assigned",
      related_task_id: taskId || null,
      status: "sent",
      provider_message_id: resData?.id || null,
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Task email error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
