import { google } from "googleapis";
import nodemailer from "nodemailer";

async function getTransporter() {
  // Quick sanity check — fail loudly if env vars are missing instead of
  // letting Gmail return a cryptic 530 error
  const required = [
    "GMAIL_CLIENT_ID",
    "GMAIL_CLIENT_SECRET",
    "GMAIL_REFRESH_TOKEN",
    "EMAIL_USER",
  ];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing Gmail env vars: ${missing.join(", ")}`);
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    "https://developers.google.com/oauthplayground",
  );

  oauth2Client.setCredentials({
    refresh_token: process.env.GMAIL_REFRESH_TOKEN,
  });

  let accessToken;
  try {
    const tokenResponse = await oauth2Client.getAccessToken();
    accessToken = tokenResponse.token;
  } catch (err) {
    // This is the real error — surfaces invalid_grant, expired token, etc.
    console.error("[Gmail OAuth] Failed to get access token:", err.message);
    throw new Error(`Gmail OAuth token refresh failed: ${err.message}`);
  }

  if (!accessToken) {
    throw new Error(
      "Gmail OAuth returned an empty access token — refresh token may be invalid or revoked",
    );
  }

  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      type: "OAuth2",
      user: process.env.EMAIL_USER,
      clientId: process.env.GMAIL_CLIENT_ID,
      clientSecret: process.env.GMAIL_CLIENT_SECRET,
      refreshToken: process.env.GMAIL_REFRESH_TOKEN,
      accessToken,
    },
  });
}

export async function sendInvoiceEmail({
  to,
  invoiceNumber,
  projectName,
  total,
  currency,
  pdfBuffer,
  pdfFileName,
  replyTo,
}) {
  const transporter = await getTransporter();

  const subject = `Invoice ${invoiceNumber} from Flowdesk`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
      <div style="background: #1a1a1a; padding: 24px 32px;">
        <h1 style="color: #ffffff; font-size: 20px; margin: 0; letter-spacing: 1px;">FLOWDESK</h1>
      </div>
      <div style="padding: 32px;">
        <h2 style="font-size: 18px; margin-bottom: 8px;">You have a new invoice</h2>
        <p style="color: #666; margin-bottom: 24px;">
          Please find your invoice <strong>${invoiceNumber}</strong> attached to this email.
        </p>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
          <tr style="background: #f8f8f8;">
            <td style="padding: 12px 16px; font-size: 13px; color: #999; text-transform: uppercase; letter-spacing: 1px;">Project</td>
            <td style="padding: 12px 16px; font-size: 13px; font-weight: 600;">${projectName}</td>
          </tr>
          <tr>
            <td style="padding: 12px 16px; font-size: 13px; color: #999; text-transform: uppercase; letter-spacing: 1px;">Invoice</td>
            <td style="padding: 12px 16px; font-size: 13px; font-weight: 600;">${invoiceNumber}</td>
          </tr>
          <tr style="background: #f8f8f8;">
            <td style="padding: 12px 16px; font-size: 13px; color: #999; text-transform: uppercase; letter-spacing: 1px;">Amount Due</td>
            <td style="padding: 12px 16px; font-size: 16px; font-weight: 700; color: #1a1a1a;">${currency} ${Number(total).toFixed(2)}</td>
          </tr>
        </table>
        <p style="color: #666; font-size: 13px;">
          The invoice PDF is attached. Please process payment at your earliest convenience.
        </p>
      </div>
      <div style="background: #f8f8f8; padding: 16px 32px; text-align: center;">
        <p style="color: #999; font-size: 11px; margin: 0;">Sent via Flowdesk · Project Management for Freelancers</p>
      </div>
    </div>
  `;

  const mailOptions = {
    from: `Flowdesk <${process.env.EMAIL_USER}>`,
    to,
    replyTo: replyTo || process.env.EMAIL_USER,
    subject,
    html,
    attachments: pdfBuffer
      ? [
          {
            filename: pdfFileName || `${invoiceNumber}.pdf`,
            content: pdfBuffer,
            contentType: "application/pdf",
          },
        ]
      : [],
  };

  await transporter.sendMail(mailOptions);
}
