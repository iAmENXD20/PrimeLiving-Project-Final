import nodemailer from "nodemailer";
import { env } from "../config/env";

const transporter =
  env.SMTP_USER && env.SMTP_PASS
    ? nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: env.SMTP_USER,
          pass: env.SMTP_PASS,
        },
      })
    : null;

interface EmailPayload {
  to: string | string[];
  subject: string;
  html: string;
}

export async function sendEmail(payload: EmailPayload): Promise<void> {
  if (!transporter) {
    console.warn("[Email] SMTP not configured — skipping email send.");
    return;
  }

  const recipients = Array.isArray(payload.to) ? payload.to.filter(Boolean) : [payload.to].filter(Boolean);
  if (recipients.length === 0) return;

  try {
    await transporter.sendMail({
      from: `"PrimeLiving" <${env.SMTP_USER}>`,
      to: recipients.join(", "),
      subject: payload.subject,
      html: payload.html,
    });
    console.log(`[Email] Sent to ${recipients.join(", ")}: ${payload.subject}`);
  } catch (error) {
    console.error("[Email] Failed to send:", error);
  }
}

export function maintenanceRequestEmailHtml({
  tenantName,
  title,
  description,
  priority,
  unit,
}: {
  tenantName: string;
  title: string;
  description: string;
  priority: string;
  unit?: string;
}): string {
  const priorityColor =
    priority === "urgent"
      ? "#dc2626"
      : priority === "high"
        ? "#ea580c"
        : priority === "medium"
          ? "#d97706"
          : "#16a34a";

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; background: #f8fafc; border-radius: 12px;">
      <div style="background: #0f766e; color: white; padding: 16px 20px; border-radius: 8px 8px 0 0; text-align: center;">
        <h2 style="margin: 0; font-size: 18px;">🔧 New Maintenance Request</h2>
      </div>
      <div style="background: white; padding: 20px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
        <p style="margin: 0 0 12px; color: #475569;"><strong>${tenantName}</strong> submitted a new maintenance request.</p>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-size: 13px; width: 90px;">Subject</td>
            <td style="padding: 8px 0; color: #1e293b; font-weight: 500;">${title}</td>
          </tr>
          ${unit ? `<tr><td style="padding: 8px 0; color: #64748b; font-size: 13px;">Unit</td><td style="padding: 8px 0; color: #1e293b;">${unit}</td></tr>` : ""}
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-size: 13px;">Priority</td>
            <td style="padding: 8px 0;"><span style="background: ${priorityColor}; color: white; padding: 2px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; text-transform: uppercase;">${priority}</span></td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-size: 13px; vertical-align: top;">Description</td>
            <td style="padding: 8px 0; color: #334155; font-size: 14px;">${description}</td>
          </tr>
        </table>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 16px 0;" />
        <p style="margin: 0; color: #94a3b8; font-size: 12px; text-align: center;">PrimeLiving Property Management</p>
      </div>
    </div>
  `;
}
